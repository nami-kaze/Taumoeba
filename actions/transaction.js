"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import aj from "@/lib/arcjet";
import { request } from "@arcjet/next";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const serializeAmount = (obj) => ({
  ...obj,
  amount: obj.amount.toNumber(),
});

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
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }
    const accountId = transactions[0]?.accountId; 
    if (!accountId) throw new Error("Invalid transactions: Missing accountId");

    const account = await db.account.findUnique({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      throw new Error("Account not found or unauthorized");
    }
    
    let newBalance = Number(account.balance);

    // First, get all unique descriptions to minimize database queries
    const uniqueDescriptions = [...new Set(transactions.map(t => t.description))];
    
    // Batch fetch similar categories for all unique descriptions
    const similarCategories = await Promise.all(
      uniqueDescriptions.map(desc => findSimilarTransactionCategory(desc, user.id))
    );
    
    // Create a map of description to category for quick lookup
    const categoryMap = Object.fromEntries(
      uniqueDescriptions.map((desc, index) => [desc, similarCategories[index]])
    );

    // Enhance transactions with categories
    const enhancedTransactions = transactions.map(transaction => ({
      ...transaction,
      category: categoryMap[transaction.description] || transaction.category
    }));

    // Calculate total balance change
    const totalBalanceChange = enhancedTransactions.reduce((sum, transaction) => {
      const change = transaction.type === "EXPENSE" ? -transaction.amount : transaction.amount;
      return sum + change;
    }, 0);

    // Process transactions in smaller batches to avoid timeout
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < enhancedTransactions.length; i += BATCH_SIZE) {
      batches.push(enhancedTransactions.slice(i, i + BATCH_SIZE));
    }

    // Create transactions and update account balance with increased timeout
    const newTransactions = await db.$transaction(async (tx) => {
      const createdTransactions = [];
      
      // Process each batch
      for (const batch of batches) {
        const batchResult = await tx.transaction.createMany({
          data: batch.map((transaction) => ({
            ...transaction,
            userId: user.id,
            nextRecurringDate:
              transaction.isRecurring && transaction.recurringInterval
                ? calculateNextRecurringDate(transaction.date, transaction.recurringInterval)
                : null,
          })),
        });
        createdTransactions.push(batchResult);
      }

      // Update account balance
      await tx.account.update({
        where: { id: accountId },
        data: { balance: newBalance + totalBalanceChange },
      });
      
      return createdTransactions;
    }, {
      timeout: 30000 // Increase timeout to 30 seconds
    });

    // Revalidate dashboard and account pages
    revalidatePath("/dashboard");
    revalidatePath(`/account/${accountId}`);

    return { success: true, data: newTransactions };
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

    const netBalanceChange = newBalanceChange - oldBalanceChange;

    // Update transaction and account balance in a transaction
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

      // Update account balance
      await tx.account.update({
        where: { id: data.accountId },
        data: {
          balance: {
            increment: netBalanceChange,
          },
        },
      });

      return updated;
    });

    revalidatePath("/dashboard");
    revalidatePath(`/account/${data.accountId}`);

    return { success: true, data: serializeAmount(transaction) };
  } catch (error) {
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
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

      If its not a recipt, return an empty object
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
    throw new Error("Failed to scan receipt");
  }
}

export async function importStatementTransactions(file){
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    // Convert ArrayBuffer to Base64
    const base64String = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `
      Analyze this bank statement file and extract all the transactions in JSON format. 
      Each transaction should have:
      - type (Income/Expense)
      - amount (Number)
      - category (STRICTLY One of: Salary, Freelance, Investments, Business, Rental, Other-income, Housing, Transportation, Groceries, Utilities, Entertainment, Food, Shopping, Healthcare, Education, Personal, Travel, Insurance, Gift, Bills, Other-expense)
      (If there is merchant category given already, that will be considered as superior in judging the category.)
      {The category should be chosen smartly:
        1. If the type is Income: the category should be chosen only from (Salary, Freelance, Investments, Business, Rental, Other-income)

      	2.	Pattern Matching for Keywords in Descriptions
	        •	"paytmqr" → Merchant Payment (likely shopping, groceries, food, or services)
	        •	"amazon","flipkart","myntra" → Shopping
	        •	"dominos", "burgerking" → Food & Dining
	        •	"noidametro", "uber" → Transportation
	        •	"bookmyshow", "spotify" → Entertainment
	        •	"hdfc/travel", "hotel","makemytrip" → Travel
	        •	"electricity", "gasbill" → Utilities
          •	"Spar","hypermarket","Almightly","spencers","departmental store","blinkit","bigbazaar" → Groceries

	      3.	Regular Expressions for Merchant Name Extraction
	        •	Identify merchants/business names within transaction details and map them to known business types.
	      4.	Smart Categorization for UPI Transactions
	        •	"UPIAR/XXXX/DR/MerchantName/Bank/paytmqrXXXX"
	        •	If the transaction involves an individual (e.g., random name + UPI), classify as "personal" or "peer transfer".
	        •	If its a known brand or QR code merchant, classify using the merchant type (food, shopping, utilities, etc.).
	      5.	Fallback Rule
	        •	If no clear classification is found, assign "other-expense" for debits and "other-income" for credits.    
      }
      - date (YYYY-MM-DD)
      - description (String) (Don't include particulars as description, Insight meaningful info from Particulars and give as Description. No transaction id as description allowed!!)
      - isRecurring (Boolean, default: false)
      - recurringInterval (One of: DAILY, WEEKLY, BI_WEEKLY, MONTHLY, QUARTERLY, YEARLY, or null. Only set if isRecurring is true)
      - nextRecurringDate (YYYY-MM-DD or null. Only set if isRecurring is true)

      Only respond with valid JSON in this exact format:
      [
        {
          "type": "Expense",
          "amount": 500.00,
          "account": "Bank of America - Checking",
          "category": "Groceries",
          "date": "2024-03-01",
          "description": "Walmart Purchase",
          "isRecurring": false
        },
        {
          "type": "Income",
          "amount": 2000.00,
          "account": "Bank of America - Savings",
          "category": "Salary",
          "date": "2024-03-01",
          "description": "Monthly Salary",
          "isRecurring": true,
          "recurringInterval": "MONTHLY"
        }
      ]

      If it's not a valid statement file, return an empty array: []
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
      return transactions.map(txn => ({
        type: txn.type.toUpperCase(),
        amount: parseFloat(txn.amount),
        account: txn.account,
        category: txn.category.toLowerCase(),
        date: new Date(txn.date),
        description: txn.description,
        isRecurring: txn.isRecurring || false,
        recurringInterval: txn.isRecurring ? txn.recurringInterval?.toUpperCase() : null,
      }));
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      console.error("Raw AI Response:", text);
      throw new Error("Invalid response format from Gemini");
    }
  } catch (error) {
    console.error("Error importing transactions:", error);
    throw new Error("Failed to import transactions");
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
  }

  return date;
}
