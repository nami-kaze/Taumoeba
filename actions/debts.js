"use server";

import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getUserId } from "@/lib/get-user-id";

/**
 * Convert Prisma Decimal to number
 */
function serializeDebt(debt) {
  return {
    ...debt,
    amount: parseFloat(debt.amount.toString()),
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString()
  };
}

/**
 * Create a new debt record
 */
export async function createDebt(data) {
    try {
        const userId = await getUserId();
    // Validate input
    if (!data.personName || !data.amount) {
      throw new Error("Person name and amount are required");
    }

    // Create the debt record
    const debt = await db.debt.create({
      data: {
        personName: data.personName,
        amount: data.amount,
        userId
      }
    });

    revalidatePath("/borrow");
    return { success: true, debt: serializeDebt(debt) };
  } catch (error) {
    console.error("Error creating debt:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all debts for the current user
 */
export async function getDebts() {
  try {
    const userId = await getUserId();
    
    const debts = await db.debt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    return { success: true, debts: debts.map(serializeDebt) };
  } catch (error) {
    console.error("Error fetching debts:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Get summary of debts grouped by person (case insensitive)
 */
export async function getDebtSummary() {
  try {
    const userId = await getUserId();
    
    // Get all debts for the user
    const debts = await db.debt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });

    // Convert Decimal to number
    const serializedDebts = debts.map(serializeDebt);

    // Group debts by person name (case insensitive)
    const summary = {};
    const nameMap = {}; // To store original case of names

    serializedDebts.forEach(debt => {
      const lowerName = debt.personName.toLowerCase();
      
      // Store the first occurrence of the name with its original case
      if (!nameMap[lowerName]) {
        nameMap[lowerName] = debt.personName;
      }
      
      if (!summary[lowerName]) {
        summary[lowerName] = {
          total: 0,
          displayName: nameMap[lowerName],
          transactions: []
        };
      }
      
      // Calculate the running balance:
      // - Positive amount in DB (+) means user owes person
      // - Negative amount in DB (-) means person owes user
      // For the UI display:
      // - Positive total means user owes person
      // - Negative total means person owes user
      summary[lowerName].total += debt.amount;
      
      // Add transaction to the list
      summary[lowerName].transactions.push({
        id: debt.id,
        amount: debt.amount,
        createdAt: debt.createdAt
      });
    });

    // Convert to array and sort by displayName for consistent ordering
    const summaryArray = Object.values(summary).map(item => ({
      ...item,
      transactions: item.transactions.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      )
    }));

    return {
      success: true, 
      summary: summaryArray
    };
  } catch (error) {
    console.error("Error fetching debt summary:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a debt record
 */
export async function deleteDebt(id) {
  try {
    const userId = await getUserId();
    
    // Check if debt exists and belongs to user
    const debt = await db.debt.findUnique({
      where: { id }
    });

    if (!debt) {
      throw new Error("Debt not found");
    }

    if (debt.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Delete the debt
    await db.debt.delete({
      where: { id }
    });

    revalidatePath("/borrow");
    return { success: true };
  } catch (error) {
    console.error("Error deleting debt:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing debt record
 */
export async function updateDebt(id, data) {
  try {
    const userId = await getUserId();
    
    // Check if debt exists and belongs to user
    const debt = await db.debt.findUnique({
      where: { id }
    });

    if (!debt) {
      throw new Error("Debt not found");
    }

    if (debt.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Validate input
    if (!data.personName || data.amount === undefined) {
      throw new Error("Person name and amount are required");
    }

    // Update the debt
    const updatedDebt = await db.debt.update({
      where: { id },
      data: {
        personName: data.personName,
        amount: data.amount
      }
    });

    revalidatePath("/borrow");
    return { success: true, debt: serializeDebt(updatedDebt) };
  } catch (error) {
    console.error("Error updating debt:", error);
    return { success: false, error: error.message };
  }
}
