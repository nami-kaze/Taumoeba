"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Get the current user from Clerk and find their record in our database
 */
async function getUserId() {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) throw new Error("Unauthorized");
  
    const user = await db.user.findUnique({
      where: { clerkUserId },
    });
  
    if (!user) {
      throw new Error("User not found");
    }

  return user.id; // Return the database user ID, not the Clerk user ID
}

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

    // Log for debugging
    console.log("Debt summary before returning:", summaryArray);

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

/**
 * Create a new group
 */
export async function createGroup(groupData) {
  try {
    const userId = await getUserId();
    console.log("Creating group with data:", groupData); // Debug log

    // Check if db is defined
    if (!db) {
      throw new Error("Database connection not initialized");
    }

    // Create the group
    const group = await db.group.create({
      data: {
        name: groupData.name,
        description: groupData.description || "",
        createdById: userId,
        members: {
          create: groupData.members.map(member => ({
            name: member.name,
            userId: userId
          }))
        }
      },
      include: {
        members: true
      }
    });

    console.log("Created group:", group); // Debug log
    revalidatePath("/borrow");
    return { success: true, group };
  } catch (error) {
    console.error("Error in createGroup:", error);
    return { success: false, error: error.message };
  }
}

// Add these helper functions at the top of the file
const serializeAmount = (obj) => ({
  ...obj,
  amount: obj.amount.toNumber(),
});

const formatDate = (date) => {
  if (!date) return null;
  return new Date(date).toISOString();
};

const serializeGroup = (group) => ({
  ...group,
  createdAt: formatDate(group.createdAt),
  updatedAt: formatDate(group.updatedAt),
  members: group.members.map(member => ({
    ...member,
    balance: typeof member.balance === 'number' ? member.balance : Number(member.balance || 0),
    createdAt: formatDate(member.createdAt),
    updatedAt: formatDate(member.updatedAt)
  })),
  expenses: group.expenses.map(expense => ({
    ...expense,
    amount: Number(expense.amount),
    createdAt: formatDate(expense.createdAt),
    updatedAt: formatDate(expense.updatedAt),
    paidBy: expense.paidBy.id,
    paidByName: expense.paidBy.name,
    splits: expense.splits.map(split => ({
      ...split,
      amount: Number(split.amount),
      createdAt: formatDate(split.createdAt),
      updatedAt: formatDate(split.updatedAt),
      settledAt: formatDate(split.settledAt),
      member: {
        id: split.member.id,
        name: split.member.name
      }
    }))
  })),
  settlements: group.settlements.map(settlement => ({
    from: settlement.from,
    to: settlement.to,
    amount: Number(settlement.amount)
  }))
});

/**
 * Get all groups for the current user
 */
export async function getGroups() {
  try {
    const userId = await getUserId();

    const groups = await db.group.findMany({
      where: {
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      include: {
        members: true,
        expenses: {
          include: {
            paidBy: true,
            splits: {
              include: {
                member: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate settlements for each group
    const processedGroups = groups.map(group => {
      // Calculate member balances
      const balances = calculateMemberBalances(group.expenses);
      
      // Calculate settlements
      const settlements = calculateSettlements(group.members, balances);

      // Add balances to members
      const membersWithBalances = group.members.map(member => ({
        ...member,
        balance: balances.get(member.id) || 0
      }));

      // Return processed group data
      return {
        ...group,
        members: membersWithBalances,
        settlements: settlements,
        expenses: group.expenses
      };
    });

    // Serialize the groups using the helper function
    const serializedGroups = processedGroups.map(group => serializeGroup(group));

    return { success: true, groups: serializedGroups };
  } catch (error) {
    console.error("Error fetching groups:", error);
    return { success: false, error: error.message };
  }
}

// Add this helper function at the top of the file
const serializeExpense = (expense) => {
  if (!expense) return null;

  // First convert the main expense object
  const serialized = {
    ...expense,
    amount: Number(expense.amount), // Direct conversion to Number
    createdAt: expense.createdAt?.toISOString(), // Safely convert dates
    updatedAt: expense.updatedAt?.toISOString(),
    paidBy: expense.paidBy?.id,
    paidByName: expense.paidBy?.name, // Ensure paidByName is included
  };

  // Then handle the splits array
  if (expense.splits) {
    serialized.splits = expense.splits.map(split => ({
      id: split.id,
      amount: Number(split.amount), // Direct conversion to Number
      expenseId: split.expenseId,
      memberId: split.memberId,
      isSettled: split.isSettled,
      settledAt: split.settledAt?.toISOString(),
      createdAt: split.createdAt?.toISOString(),
      updatedAt: split.updatedAt?.toISOString(),
      member: {
        id: split.member?.id,
        name: split.member?.name
      }
    }));
  }

  return serialized;
};

/**
 * Add an expense to a group
 */
export async function addGroupExpense(groupId, expenseData) {
  try {
    const userId = await getUserId();
    
    // Create the expense and splits in a transaction
    const rawExpense = await db.$transaction(async (tx) => {
      // Create the expense
      const newExpense = await tx.groupExpense.create({
        data: {
          description: expenseData.description,
          amount: expenseData.amount,
          groupId: groupId,
          paidById: expenseData.paidBy,
        },
      });

      // Create splits
      const splitPromises = expenseData.splits.map((split) =>
        tx.expenseSplit.create({
          data: {
            amount: split.amount,
            expenseId: newExpense.id,
            memberId: split.id,
            isSettled: false,
          },
        })
      );

      await Promise.all(splitPromises);

      // Return the created expense with all relations
      return tx.groupExpense.findUnique({
        where: { 
          id: newExpense.id 
        },
        include: {
          paidBy: {
            select: {
              id: true,
              name: true,
            }
          },
          splits: {
            include: {
              member: {
                select: {
                  id: true,
                  name: true,
                }
              },
            },
          },
        },
      });
    });

    // Convert all Decimal values to plain numbers and format the response
    const expense = {
      id: rawExpense.id,
      description: rawExpense.description,
      amount: Number(rawExpense.amount),
      groupId: rawExpense.groupId,
      paidById: rawExpense.paidById,
      createdAt: rawExpense.createdAt,  // Keep as Date object
      updatedAt: rawExpense.updatedAt,  // Keep as Date object
      paidBy: rawExpense.paidBy.id,
      paidByName: rawExpense.paidBy.name,
      splits: rawExpense.splits.map(split => ({
        id: split.id,
        amount: Number(split.amount),
        expenseId: split.expenseId,
        memberId: split.memberId,
        isSettled: split.isSettled,
        settledAt: split.settledAt,
        createdAt: split.createdAt,
        updatedAt: split.updatedAt,
        member: {
          id: split.member.id,
          name: split.member.name
        }
      }))
    };

    // Revalidate both the borrow page and specific group data
    revalidatePath("/borrow");
    revalidatePath(`/borrow?groupId=${groupId}`);

    return { 
      success: true, 
      expense,
      message: "Expense added successfully" 
    };
  } catch (error) {
    console.error("Error in addGroupExpense:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark a split as settled
 */
export async function settleSplit(splitId) {
  try {
    const userId = await getUserId();

    // First, find the split and verify it exists
    const split = await db.expenseSplit.findUnique({
      where: { id: splitId },
      include: {
        expense: {
          include: {
            group: {
              include: {
                members: true
              }
            }
          }
        }
      }
    });

    if (!split) {
      throw new Error("Split not found");
    }

    // Verify user has access to this group
    const isGroupMember = split.expense.group.members.some(
      member => member.userId === userId
    );

    if (!isGroupMember) {
      throw new Error("Unauthorized");
    }

    // Update the split to mark it as settled
    const updatedSplit = await db.expenseSplit.update({
      where: { id: splitId },
      data: {
        isSettled: true,
        settledAt: new Date()
      }
    });

    // Revalidate the page to show updated data
    revalidatePath("/borrow");
    
    return { 
      success: true, 
      message: "Split settled successfully",
      split: updatedSplit 
    };
  } catch (error) {
    console.error("Error settling split:", error);
    return { success: false, error: error.message };
  }
}

// Add this helper function to calculate member balances
const calculateMemberBalances = (expenses) => {
  const balances = new Map();

  // Process each expense
  expenses.forEach(expense => {
    const paidById = expense.paidBy.id;
    const amount = Number(expense.amount);

    // Initialize balances if needed
    if (!balances.has(paidById)) {
      balances.set(paidById, 0);
    }

    // Add the full amount to payer's balance (they paid for everyone)
    balances.set(paidById, balances.get(paidById) + amount);

    // Process splits
    expense.splits.forEach(split => {
      const memberId = split.member.id;
      if (!balances.has(memberId)) {
        balances.set(memberId, 0);
      }
      // Subtract each person's share from their balance
      balances.set(memberId, balances.get(memberId) - Number(split.amount));
    });
  });

  return balances;
};

// Add this helper function to calculate settlements
const calculateSettlements = (members, balances) => {
  // Convert balances Map to array of objects
  let balanceArray = members.map(member => ({
    id: member.id,
    name: member.name,
    balance: balances.get(member.id) || 0
  }));

  // Sort by balance (negative first - these people need to pay)
  balanceArray.sort((a, b) => a.balance - b.balance);

  let settlements = [];
  let i = 0; // index for people who need to pay (negative balance)
  let j = balanceArray.length - 1; // index for people who need to receive (positive balance)

  while (i < j) {
    const debtor = balanceArray[i];
    const creditor = balanceArray[j];

    // Skip if balances are effectively zero
    if (Math.abs(debtor.balance) < 0.01 && Math.abs(creditor.balance) < 0.01) {
      i++;
      j--;
      continue;
    }

    // Calculate the settlement amount
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
    
    if (amount > 0) {
      settlements.push({
        from: {
          id: debtor.id,
          name: debtor.name
        },
        to: {
          id: creditor.id,
          name: creditor.name
        },
        amount: Math.round(amount * 100) / 100 // Round to 2 decimal places
      });
    }

    // Update balances
    debtor.balance += amount;
    creditor.balance -= amount;

    // Move indices if balances are settled
    if (Math.abs(debtor.balance) < 0.01) i++;
    if (Math.abs(creditor.balance) < 0.01) j--;
  }

  return settlements;
};

/**
 * Delete a group expense and its splits
 */
export async function deleteGroupExpense(expenseId) {
  try {
    const userId = await getUserId();

    // First verify the user has permission to delete this expense
    const expense = await db.groupExpense.findUnique({
      where: { id: expenseId },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!expense) {
      throw new Error("Expense not found");
    }

    // Check if user is a member of the group
    const isGroupMember = expense.group.members.some(
      member => member.userId === userId
    );

    if (!isGroupMember) {
      throw new Error("Unauthorized");
    }

    // Delete the expense (this will cascade delete the splits due to DB relations)
    await db.groupExpense.delete({
      where: { id: expenseId }
    });

    revalidatePath("/borrow");
    return { success: true };
  } catch (error) {
    console.error("Error deleting group expense:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a group expense and its splits
 */
export async function updateGroupExpense(expenseId, expenseData) {
  try {
    const userId = await getUserId();

    // Verify user has permission
    const expense = await db.groupExpense.findUnique({
      where: { id: expenseId },
      include: {
        group: {
          include: {
            members: true
          }
        },
        splits: true
      }
    });

    if (!expense) {
      throw new Error("Expense not found");
    }

    // Check if user is a member of the group
    const isGroupMember = expense.group.members.some(
      member => member.userId === userId
    );

    if (!isGroupMember) {
      throw new Error("Unauthorized");
    }

    // Update in a transaction to ensure data consistency
    const updatedExpense = await db.$transaction(async (tx) => {
      // Delete existing splits
      await tx.expenseSplit.deleteMany({
        where: { expenseId }
      });

      // Update the expense
      const updated = await tx.groupExpense.update({
        where: { id: expenseId },
        data: {
          description: expenseData.description,
          amount: expenseData.amount,
          paidById: expenseData.paidBy,
          splits: {
            create: expenseData.splits.map(split => ({
              amount: split.amount,
              memberId: split.id,
              isSettled: false
            }))
          }
        },
        include: {
          paidBy: true,
          splits: {
            include: {
              member: true
            }
          }
        }
      });

      return updated;
    });

    revalidatePath("/borrow");
    return { 
      success: true, 
      expense: serializeExpense(updatedExpense)
    };
  } catch (error) {
    console.error("Error updating group expense:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a group's details
 */
export async function updateGroup(groupId, groupData) {
  try {
    const userId = await getUserId();

    // Verify user has permission (only group creator can edit)
    const group = await db.group.findUnique({
      where: { id: groupId },
      include: { members: true }
    });

    if (!group) {
      throw new Error("Group not found");
    }

    if (group.createdById !== userId) {
      throw new Error("Only the group creator can edit the group");
    }

    // Update the group in a transaction
    const updatedGroup = await db.$transaction(async (tx) => {
      // Delete existing members
      await tx.groupMember.deleteMany({
        where: { groupId }
      });

      // Update the group and create new members
      const updated = await tx.group.update({
        where: { id: groupId },
        data: {
          name: groupData.name,
          description: groupData.description || "",
          members: {
            create: groupData.members.map(member => ({
              name: member.name,
              userId: userId
            }))
          }
        },
        include: {
          members: true
        }
      });

      return updated;
    });

    revalidatePath("/borrow");
    return { success: true, group: updatedGroup };
  } catch (error) {
    console.error("Error updating group:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a group and all its expenses
 */
export async function deleteGroup(groupId) {
  try {
    const userId = await getUserId();

    // Verify user has permission (only group creator can delete)
    const group = await db.group.findUnique({
      where: { id: groupId }
    });

    if (!group) {
      throw new Error("Group not found");
    }

    if (group.createdById !== userId) {
      throw new Error("Only the group creator can delete the group");
    }

    // Delete the group (this will cascade delete expenses and members)
    await db.group.delete({
      where: { id: groupId }
    });

    revalidatePath("/borrow");
    return { success: true };
  } catch (error) {
    console.error("Error deleting group:", error);
    return { success: false, error: error.message };
  }
}

