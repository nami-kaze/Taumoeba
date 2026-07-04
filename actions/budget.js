"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";

export async function getCurrentBudget(accountId) {
  noStore();
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const budget = await db.budget.findFirst({
      where: {
        userId: user.id,
      },
    });

    // Get current month's expenses - match the same logic as expense breakdown
    // The expense breakdown uses: transactionDate.getMonth() + 1 === selectedMonth && transactionDate.getFullYear() === new Date().getFullYear()
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based, but we want 1-based
    
    // Get all transactions for the user and account, then filter on the client side
    // This matches exactly how the expense breakdown works
    const allTransactions = await db.transaction.findMany({
      where: {
        userId: user.id,
        type: "EXPENSE",
        accountId,
      },
    });

    // Filter transactions using the same logic as expense breakdown
    const currentMonthExpenses = allTransactions.filter((transaction) => {
      const transactionDate = new Date(transaction.date);
      return (
        transactionDate.getMonth() + 1 === currentMonth &&
        transactionDate.getFullYear() === currentYear
      );
    });

    // Calculate total expenses
    const totalExpenses = currentMonthExpenses.reduce((sum, transaction) => {
      return sum + transaction.amount.toNumber();
    }, 0);

    return {
      budget: budget ? { ...budget, amount: budget.amount.toNumber() } : null,
      currentExpenses: totalExpenses,
    };
  } catch (error) {
    console.error("Error fetching budget:", error);
    throw error;
  }
}

export async function updateBudget(amount) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Update or create budget
    const budget = await db.budget.upsert({
      where: {
        userId: user.id,
      },
      update: {
        amount,
      },
      create: {
        userId: user.id,
        amount,
      },
    });

    revalidatePath("/dashboard");
    return {
      success: true,
      data: { ...budget, amount: budget.amount.toNumber() },
    };
  } catch (error) {
    console.error("Error updating budget:", error);
    return { success: false, error: error.message };
  }
}
