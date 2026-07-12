"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL, getFriendlyAIError } from "@/lib/gemini";

// Initialize the API with the correct model name
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

export async function getFinancialAdvice(message, transactionHistory = null) {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("You must be signed in to get financial advice");
    }

    let context = "";
    if (transactionHistory) {
      context = `Based on the user's transaction history: ${JSON.stringify(transactionHistory)}. `;
    }

    const prompt = `${context}As a financial advisor, provide concise and clear advice for the following query: ${message}. 

    Format your response as follows:
    1. Start with a brief one-line summary
    2. Provide maximum 3-4 key points
    3. Each point should be numbered and on a new line
    4. Keep each point to 1-2 sentences maximum
    5. Add a blank line between points for readability

    Important: 
    - Do not use any markdown formatting (no *, **, #, or other symbols)
    - Keep the total response under 200 words
    - Focus on actionable advice`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini API Error:", error);
      // Surface the real cause (429/quota, bad API key, etc.) to the UI toast.
      throw new Error(
        getFriendlyAIError(error, "Unable to generate financial advice at the moment. Please try again later.")
      );
    }
  } catch (error) {
    console.error("Error in getFinancialAdvice:", error);
    throw new Error(error.message || "Failed to get financial advice. Please try again.");
  }
}

// DB-only expense summary (no Gemini call). Used to show the top-spend line and
// to give getFinancialAdvice() spending context in Expense & Budgeting mode.
// Previously this was analyzeExpenses(), which also made a Gemini call to
// generate advice that the UI never used — that wasted a call on every init and
// doubled the Gemini calls per message. Keeping this pure DB avoids burning
// quota (and 429s) for data we can compute ourselves.
export async function getExpenseSummary() {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("You must be signed in to analyze expenses");
    }

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      throw new Error("User not found in database");
    }

    // Get all expense transactions instead of just the last 30 days
    const transactions = await db.transaction.findMany({
      where: {
        userId: user.id,
        type: "EXPENSE",
      },
      select: {
        amount: true,
        category: true,
      },
    });

    if (!transactions.length) {
      throw new Error("No expense transactions found");
    }

    // Group and sum transactions by category
    const categoryTotals = transactions.reduce((acc, curr) => {
      const amount = parseFloat(curr.amount.toString());
      acc[curr.category] = (acc[curr.category] || 0) + amount;
      return acc;
    }, {});

    // Find highest spending category
    const highestCategory = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)[0];

    return {
      categoryAnalysis: categoryTotals,
      highestCategory: {
        name: highestCategory[0],
        amount: highestCategory[1],
      },
    };
  } catch (error) {
    console.error("Error in getExpenseSummary:", error);
    throw new Error(error.message || "Failed to analyze expenses. Please try again.");
  }
}