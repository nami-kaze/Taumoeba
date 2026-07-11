import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

// Wrap a value for safe CSV output (RFC 4180): quote the field if it contains
// a comma, quote, or newline, and escape embedded quotes by doubling them.
function csvCell(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Only allow a short, safe slug from the client-provided label so it can't be
// used to inject characters into the Content-Disposition filename.
function safeLabel(label) {
  if (!label) return "";
  return label.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
}

export async function GET(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({ where: { clerkUserId: userId } });
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const accountsParam = searchParams.get("accounts"); // comma-separated ids, or "all"/empty
    const from = searchParams.get("from"); // YYYY-MM-DD (optional)
    const to = searchParams.get("to"); // YYYY-MM-DD (optional)
    const label = safeLabel(searchParams.get("label"));

    // Resolve which accounts to include — always intersected with THIS user's
    // own accounts so a forged/guessed id can never leak another user's data.
    const ownedAccounts = await db.account.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    const ownedIds = new Set(ownedAccounts.map((a) => a.id));

    let accountIds;
    if (!accountsParam || accountsParam === "all") {
      accountIds = [...ownedIds];
    } else {
      accountIds = accountsParam
        .split(",")
        .map((s) => s.trim())
        .filter((id) => ownedIds.has(id));
    }

    if (accountIds.length === 0) {
      return Response.json(
        { error: "No valid accounts selected" },
        { status: 400 }
      );
    }

    // Build an (optional) date filter. Dates arrive as YYYY-MM-DD; `to` is made
    // inclusive by extending it to the end of that day. All boundaries are UTC
    // so exports are deterministic regardless of server timezone.
    const dateFilter = {};
    if (from) {
      const f = new Date(`${from}T00:00:00.000Z`);
      if (!isNaN(f.getTime())) dateFilter.gte = f;
    }
    if (to) {
      const t = new Date(`${to}T23:59:59.999Z`);
      if (!isNaN(t.getTime())) dateFilter.lte = t;
    }

    const where = {
      userId: user.id,
      accountId: { in: accountIds },
    };
    if (dateFilter.gte || dateFilter.lte) {
      where.date = dateFilter;
    }

    const transactions = await db.transaction.findMany({
      where,
      include: { account: { select: { name: true } } },
      orderBy: { date: "asc" }, // chronological, as expected for tax records
    });

    // Columns: Date, Description, Category, Type, Amount, Account.
    // Amount is signed — expenses negative, income positive — to match the app.
    const header = ["Date", "Description", "Category", "Type", "Amount", "Account"];
    const lines = [header.map(csvCell).join(",")];

    for (const txn of transactions) {
      const amount = txn.amount.toNumber();
      const signed = txn.type === "EXPENSE" ? -amount : amount;
      const dateStr = txn.date.toISOString().slice(0, 10); // YYYY-MM-DD
      lines.push(
        [
          dateStr,
          txn.description || "",
          txn.category || "",
          txn.type,
          signed.toFixed(2),
          txn.account?.name || "",
        ]
          .map(csvCell)
          .join(",")
      );
    }

    // Prepend a UTF-8 BOM so Excel renders ₹ and other non-ASCII correctly.
    const csv = "\uFEFF" + lines.join("\r\n") + "\r\n";
    const filename = `monies-transactions${label ? `_${label}` : ""}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ITR Buddy export error:", error);
    return Response.json(
      { error: "Failed to export transactions" },
      { status: 500 }
    );
  }
}
