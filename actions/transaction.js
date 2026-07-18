"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";
import { serializeAmount } from "@/lib/serialize";
import { GEMINI_MODEL, getFriendlyAIError } from "@/lib/gemini";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Intervals supported by the Prisma RecurringInterval enum.
const VALID_RECURRING_INTERVALS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"];

async function findSimilarTransactionCategory(description, userId) {
  // Look for the most recent transaction with a similar description
  // Using a simple case-insensitive contains match
  const similarTransaction = await db.transaction.findFirst({
    where: {
      userId: userId,
      description: {
        contains: description,
        mode: 'insensitive'
      }
    },
    orderBy: {
      date: 'desc'
    },
    select: {
      category: true
    }
  });

  return similarTransaction?.category || null;
}

// Bulk variant of findSimilarTransactionCategory. Runs ONE query for the whole
// import instead of one per description: firing N concurrent findFirst calls
// exhausts the Prisma connection pool (P2024), and each one is an unindexed
// ILIKE scan over the user's entire history.
async function buildCategoryMap(descriptions, userId) {
  const uniqueDescriptions = [
    ...new Set(descriptions.filter((d) => typeof d === "string" && d.trim())),
  ];
  if (uniqueDescriptions.length === 0) return {};

  // Most recent first, so the first match per description wins - same
  // precedence as the single-lookup path's `orderBy: { date: 'desc' }`.
  const history = await db.transaction.findMany({
    where: { userId, description: { not: null } },
    orderBy: { date: "desc" },
    select: { description: true, category: true },
    take: 1000,
  });
  if (history.length === 0) return {};

  const map = {};
  for (const desc of uniqueDescriptions) {
    const needle = desc.toLowerCase();
    const match = history.find((h) =>
      h.description.toLowerCase().includes(needle)
    );
    if (match) map[desc] = match.category;
  }

  return map;
}

// Create Transaction
export async function createTransaction(data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    // Get request data for ArcJet
    const req = await request();

    // Check rate limit
    const decision = await aj.protect(req, {
      userId,
      requested: 1, // Specify how many tokens to consume
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        const { remaining, reset } = decision.reason;
        console.error({
          code: "RATE_LIMIT_EXCEEDED",
          details: {
            remaining,
            resetInSeconds: reset,
          },
        });

        throw new Error("Too many requests. Please try again later.");
      }

      throw new Error("Request blocked");
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const account = await db.account.findUnique({
      where: {
        id: data.accountId,
        userId: user.id,
      },
    });

    if (!account) {
      throw new Error("Account not found");
    }

    // Check for similar transactions and their categories
    const previousCategory = await findSimilarTransactionCategory(data.description, user.id);
    if (previousCategory) {
      data.category = previousCategory;
    }

    // Calculate new balance
    const balanceChange = data.type === "EXPENSE" ? -data.amount : +data.amount;
    const newBalance = account.balance.toNumber() + balanceChange;

    // Create transaction and update account balance
    const transaction = await db.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          ...data,
          userId: user.id,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      await tx.account.update({
        where: { id: data.accountId },
        data: { balance: newBalance },
      });

      return newTransaction;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${transaction.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

export async function createBulkTransactions(transactions) {
  const startedAt = Date.now();
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }
    // Rows may target different accounts - the import dialog stamps one account
    // on every row, but the user can override individual rows afterwards.
    const accountIds = [...new Set(transactions.map((t) => t.accountId))];
    if (accountIds.some((id) => !id)) {
      throw new Error("Invalid transactions: Missing accountId");
    }

    const accounts = await db.account.findMany({
      where: { id: { in: accountIds }, userId: user.id },
    });

    if (accounts.length !== accountIds.length) {
      throw new Error("Account not found or unauthorized");
    }

    // One query for the whole import - see buildCategoryMap.
    const categoryMap = await buildCategoryMap(
      transactions.map((t) => t.description),
      user.id
    );

    // Enhance transactions with categories
    const enhancedTransactions = transactions.map(transaction => ({
      ...transaction,
      category: categoryMap[transaction.description] || transaction.category
    }));

    // Balance delta per account, so rows pointing at different accounts each
    // hit the right balance instead of all landing on the first row's account.
    const balanceDeltas = {};
    for (const transaction of enhancedTransactions) {
      const change =
        transaction.type === "EXPENSE" ? -transaction.amount : transaction.amount;
      balanceDeltas[transaction.accountId] =
        (balanceDeltas[transaction.accountId] || 0) + change;
    }

    const rows = enhancedTransactions.map((transaction) => {
      // `account` (a name string from the AI import) is not a scalar
      // column on Transaction — drop it so Prisma doesn't reject the row.
      const { account, ...txnData } = transaction;
      return {
        ...txnData,
        userId: user.id,
        // Bulk-imported transactions are never recurring — force the
        // flag off regardless of what the caller/AI supplied.
        isRecurring: false,
        recurringInterval: null,
        nextRecurringDate: null,
      };
    });

    // Chunked only to stay under Postgres' 65535 bind-parameter cap; at ~13
    // columns per row this leaves plenty of headroom.
    const BATCH_SIZE = 500;
    const operations = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      operations.push(
        db.transaction.createMany({ data: rows.slice(i, i + BATCH_SIZE) })
      );
    }

    // Everything before this index is a createMany; everything after is an
    // account update (whose raw result must not reach the client).
    const createManyCount = operations.length;

    // `increment` rather than read-then-write: the balance is computed by the
    // database, so a concurrent write can't be silently overwritten.
    for (const [id, delta] of Object.entries(balanceDeltas)) {
      if (!delta) continue;
      operations.push(
        db.account.update({
          where: { id },
          data: { balance: { increment: delta } },
        })
      );
    }

    // Batched (array) transaction, NOT interactive: the operations are sent
    // together instead of paying a network round trip per batch while an
    // interactive transaction's timeout runs down.
    const writeStarted = Date.now();
    const results = await db.$transaction(operations);
    console.log(
      `[bulk] ${rows.length} rows across ${accountIds.length} account(s): ` +
        `prep ${writeStarted - startedAt}ms, write ${Date.now() - writeStarted}ms`
    );

    // Only the createMany results ({ count }) are returned. The account.update
    // results are raw Account rows whose Decimal `balance` is not serializable
    // across the Server Action -> Client Component boundary.
    const created = results
      .slice(0, createManyCount)
      .reduce((sum, r) => sum + r.count, 0);

    // Revalidate dashboard and every account the import touched
    revalidatePath("/dashboard");
    for (const id of accountIds) {
      revalidatePath(`/account/${id}`);
    }

    return { success: true, count: created };
  } catch (error) {
    console.error("Bulk transaction error:", error);
    throw new Error(error.message);
  }
}

export async function getTransaction(id) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const transaction = await db.transaction.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!transaction) throw new Error("Transaction not found");

  return serializeAmount(transaction);
}

export async function updateTransaction(id, data) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Get original transaction to calculate balance change
    const originalTransaction = await db.transaction.findUnique({
      where: {
        id,
        userId: user.id,
      },
      include: {
        account: true,
      },
    });

    if (!originalTransaction) throw new Error("Transaction not found");

    // Calculate balance changes
    const oldBalanceChange =
      originalTransaction.type === "EXPENSE"
        ? -originalTransaction.amount.toNumber()
        : originalTransaction.amount.toNumber();

    const newBalanceChange =
      data.type === "EXPENSE" ? -data.amount : data.amount;

    const accountChanged = originalTransaction.accountId !== data.accountId;

    // Update transaction and account balance(s) in a transaction
    const transaction = await db.$transaction(async (tx) => {
      const updated = await tx.transaction.update({
        where: {
          id,
          userId: user.id,
        },
        data: {
          ...data,
          nextRecurringDate:
            data.isRecurring && data.recurringInterval
              ? calculateNextRecurringDate(data.date, data.recurringInterval)
              : null,
        },
      });

      if (accountChanged) {
        // Revert the original transaction's effect on the old account...
        await tx.account.update({
          where: { id: originalTransaction.accountId },
          data: { balance: { decrement: oldBalanceChange } },
        });
        // ...and apply the new transaction's effect on the new account.
        await tx.account.update({
          where: { id: data.accountId },
          data: { balance: { increment: newBalanceChange } },
        });
      } else {
        // Same account: apply only the net difference.
        await tx.account.update({
          where: { id: data.accountId },
          data: { balance: { increment: newBalanceChange - oldBalanceChange } },
        });
      }

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Edit up to 5 transactions at once. Each entry in `updates` is a full
// transaction payload plus its `id` (same shape updateTransaction expects).
// Balances are corrected per-account using the same revert-old / apply-new
// logic as updateTransaction, accumulated across all edits so several edits
// touching the same account still net out correctly.
const MAX_BULK_EDIT = 5;

export async function bulkUpdateTransactions(updates) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error("No transactions to update");
    }
    if (updates.length > MAX_BULK_EDIT) {
      throw new Error(`You can edit at most ${MAX_BULK_EDIT} transactions at once`);
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });
    if (!user) throw new Error("User not found");

    const ids = updates.map((u) => u.id);
    if (ids.some((id) => !id)) throw new Error("Missing transaction id");

    // Fetch originals (scoped to this user) so we can revert their old effect.
    const originals = await db.transaction.findMany({
      where: { id: { in: ids }, userId: user.id },
    });

    if (originals.length !== updates.length) {
      throw new Error("One or more transactions were not found");
    }
    const originalById = Object.fromEntries(originals.map((t) => [t.id, t]));

    // Accumulate net balance change per account across every edit.
    const accountDeltas = {};
    const addDelta = (accountId, delta) => {
      accountDeltas[accountId] = (accountDeltas[accountId] || 0) + delta;
    };

    const preparedUpdates = updates.map((update) => {
      const original = originalById[update.id];
      const amount = parseFloat(update.amount);
      if (Number.isNaN(amount)) throw new Error("Invalid amount");

      const oldEffect =
        original.type === "EXPENSE"
          ? -original.amount.toNumber()
          : original.amount.toNumber();
      const newEffect = update.type === "EXPENSE" ? -amount : amount;

      if (original.accountId !== update.accountId) {
        // Revert the old account, apply to the new account.
        addDelta(original.accountId, -oldEffect);
        addDelta(update.accountId, newEffect);
      } else {
        // Same account: apply only the net difference.
        addDelta(update.accountId, newEffect - oldEffect);
      }

      // Only intervals supported by the RecurringInterval enum are valid.
      const interval = update.recurringInterval?.toUpperCase();
      const validInterval = VALID_RECURRING_INTERVALS.includes(interval)
        ? interval
        : null;
      const isRecurring = Boolean(update.isRecurring) && validInterval !== null;

      return {
        id: update.id,
        data: {
          type: update.type,
          amount,
          description: update.description,
          date: new Date(update.date),
          accountId: update.accountId,
          category: update.category,
          isRecurring,
          recurringInterval: isRecurring ? validInterval : null,
          nextRecurringDate: isRecurring
            ? calculateNextRecurringDate(update.date, validInterval)
            : null,
        },
      };
    });

    const affectedAccountIds = new Set([
      ...originals.map((t) => t.accountId),
      ...updates.map((u) => u.accountId),
    ]);

    await db.$transaction(async (tx) => {
      for (const { id, data } of preparedUpdates) {
        await tx.transaction.update({
          where: { id, userId: user.id },
          data,
        });
      }

      for (const [accountId, delta] of Object.entries(accountDeltas)) {
        if (delta === 0) continue;
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { increment: delta } },
        });
      }
    });

    revalidatePath("/dashboard");
    for (const accountId of affectedAccountIds) {
      revalidatePath(`/account/${accountId}`);
    }

    return { success: true, count: preparedUpdates.length };
  } catch (error) {
    console.error("Bulk update error:", error);
    throw new Error(error.message);
  }
}

// Get User Transactions
export async function getUserTransactions(query = {}) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const transactions = await db.transaction.findMany({
      where: {
        userId: user.id,
        ...query,
      },
      include: {
        account: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return { success: true, data: transactions };
  } catch (error) {
    throw new Error(error.message);
  }
}

// Scan Receipt
export async function scanReceipt(file) {
  // Guard the AI endpoint: only authenticated users may spend Gemini quota.
  // Placed before the try so the reason isn't masked by the generic catch.
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to Base64
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
      Analyze this receipt image and extract the following information in JSON format:
      - Total amount (just the number)
      - Date (in ISO format)
      - Description or items purchased (brief summary)
      - Merchant/store name
      - Suggested category (one of: housing,transportation,groceries,utilities,entertainment,food,shopping,healthcare,education,personal,travel,insurance,gifts,bills,other-expenses)
      
      Only respond with valid JSON in this exact format:
      {
        "amount": number,
        "date": "ISO date string",
        "description": "string",
        "merchantName": "string",
        "category": "string"
      }

      If it's not a receipt, return an empty object
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    try {
      const data = JSON.parse(cleanedText);
      return {
        amount: parseFloat(data.amount),
        date: new Date(data.date),
        description: data.description,
        category: data.category,
        merchantName: data.merchantName,
      };
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      throw new Error("Invalid response format from Gemini");
    }
  } catch (error) {
    console.error("Error scanning receipt:", error);
    // Surface the real cause (429/quota, bad API key, etc.) to the UI toast.
    throw new Error(
      getFriendlyAIError(error, "Couldn't scan the receipt. Please try again with a clearer image.")
    );
  }
}

export async function importStatementTransactions(file){
  // Guard the AI endpoint: only authenticated users may spend Gemini quota.
  // Placed before the try so the reason isn't masked by the generic catch.
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to Base64
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
      Extract every transaction from this bank statement as a JSON array.

      Emit ONLY these five fields per transaction. Emit no other keys.
      - type: "Expense" for debits, "Income" for credits
      - amount: number, always positive
      - date: "YYYY-MM-DD"
      - category: exactly one value from the lists below
      - description: meaningful merchant/purpose text derived from the
        particulars. Never a raw transaction id, never the raw particulars.

      Income categories (use ONLY these exact values when type is Income):
      salary, freelance, investments, business, rental, banking-income,
      other-income

      Expense categories (use ONLY these exact values when type is Expense):
      housing, transportation, groceries, utilities, entertainment, food,
      shopping, healthcare, education, personal, travel, insurance, gifts,
      bills, banking-expense, investments-expense, other-expense

      Categorisation rules, in priority order:
      1. If the statement already states a merchant category, that wins.
      2. Keyword match on the particulars:
         amazon/flipkart/myntra -> shopping
         dominos/burgerking/swiggy/zomato -> food
         noidametro/uber/ola -> transportation
         bookmyshow/spotify/netflix -> entertainment
         hotel/makemytrip/irctc/"hdfc travel" -> travel
         electricity/gasbill/broadband -> utilities
         spar/hypermarket/almightly/spencers/blinkit/bigbazaar/"departmental store" -> groceries
      3. UPI strings (e.g. "UPIAR/XXXX/DR/MerchantName/Bank/paytmqrXXXX"):
         extract the merchant name and categorise by merchant type. A paytmqr
         merchant categorises by its business type; a transfer to an individual
         person's name -> personal.
      4. No clear match -> other-expense for debits, other-income for credits.

      Respond with raw JSON only - no markdown fences, no commentary:
      [
        {"type":"Expense","amount":500.00,"date":"2024-03-01","category":"groceries","description":"Walmart purchase"},
        {"type":"Income","amount":2000.00,"date":"2024-03-01","category":"salary","description":"Monthly salary"}
      ]

      If this is not a valid bank statement, return exactly: []
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      },
      prompt,
    ]);

    const response = await result.response;
    const text = response.text();
    let cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    try {
      const transactions = JSON.parse(cleanedText);
      // Imported transactions are never recurring - createBulkTransactions
      // forces those fields off - so the prompt no longer asks for them.
      return transactions.map((txn) => ({
        type: txn.type?.toUpperCase(),
        amount: parseFloat(txn.amount),
        category: txn.category?.toLowerCase(),
        date: new Date(txn.date),
        description: txn.description,
      }));
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      console.error("Raw AI Response:", text);
      throw new Error("Invalid response format from Gemini");
    }
  } catch (error) {
    console.error("Error importing transactions:", error);
    // Surface the real cause (429/quota, bad API key, etc.) to the UI toast.
    throw new Error(
      getFriendlyAIError(error, "Couldn't import the statement. Please try again.")
    );
  }
}

// Helper function to calculate next recurring date
function calculateNextRecurringDate(startDate, interval) {
  const date = new Date(startDate);

  switch (interval) {
    case "DAILY":
      date.setDate(date.getDate() + 1);
      break;
    case "WEEKLY":
      date.setDate(date.getDate() + 7);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + 1);
      break;
    case "YEARLY":
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      // Unknown/unsupported interval — don't fabricate a schedule.
      return null;
  }

  return date;
}
