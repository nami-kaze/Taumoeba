"use client";

import { useState, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";
import dynamic from "next/dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { updateBudget, getCurrentBudget } from "@/actions/budget";

// Dynamically import Progress (no SSR)
const DynamicProgress = dynamic(
  () => import("@/components/ui/progress").then((mod) => mod.Progress),
  { ssr: false }
);

export function BudgetProgress({ 
  accountId, 
  initialBudget, 
  currentExpenses: serverCurrentExpenses,
  transactions = [],
  accounts = []
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [newBudget, setNewBudget] = useState("");
  const [mounted, setMounted] = useState(false);

  // update budget
  const {
    loading: isUpdating,
    fn: updateBudgetFn,
    data: updatedBudget,
    error: updateError,
  } = useFetch(updateBudget);

  useEffect(() => {
    setMounted(true);
    if (initialBudget) {
      setNewBudget(initialBudget.amount.toString());
    }
  }, [initialBudget]);

  // Calculate current expenses using the same logic as expense breakdown
  const calculateCurrentExpenses = () => {
    if (!transactions.length || !accounts.length) return 0;
    
    const defaultAccount = accounts.find((a) => a.isDefault) || accounts[0];
    if (!defaultAccount) return 0;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Filter transactions for the default account
    const accountTransactions = transactions.filter(
      (t) => t.accountId === defaultAccount.id
    );

    // Filter expenses for current month using same logic as expense breakdown
    const currentMonthExpenses = accountTransactions.filter((t) => {
      const transactionDate = new Date(t.date);
      return (
        t.type === "EXPENSE" &&
        transactionDate.getMonth() + 1 === currentMonth &&
        transactionDate.getFullYear() === currentYear
      );
    });

    // Calculate total expenses
    return currentMonthExpenses.reduce((sum, transaction) => {
      return sum + transaction.amount;
    }, 0);
  };

  const currentExpenses = calculateCurrentExpenses();

  useEffect(() => {
    if (updatedBudget?.success) {
      setIsEditing(false);
      toast.success("Budget updated successfully");
      // Refresh the page to get updated data
      window.location.reload();
    }
  }, [updatedBudget]);

  useEffect(() => {
    if (updateError) {
      toast.error(updateError.message || "Failed to update budget");
    }
  }, [updateError]);

  if (!mounted) return null;

  const budget = initialBudget;
  const expenses = currentExpenses;

  const percentUsed = budget ? (expenses / budget.amount) * 100 : 0;

  const handleUpdateBudget = async () => {
    const amount = parseFloat(newBudget);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    await updateBudgetFn(amount);
  };

  const handleCancel = () => {
    setNewBudget(budget?.amount?.toString() || "");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-sm font-medium">
            Monthly Budget (Default Account)
          </CardTitle>
          <div className="flex items-center gap-2 mt-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-32"
                  placeholder="Enter amount"
                  autoFocus
                  disabled={isUpdating}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleUpdateBudget}
                  disabled={isUpdating}
                >
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCancel}
                  disabled={isUpdating}
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ) : (
              <>
                <CardDescription>
                  {budget
                    ? `₹${expenses.toFixed(2)} of ₹${budget.amount.toFixed(
                        2
                      )} spent`
                    : "No budget set"}
                </CardDescription>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(true)}
                  className="h-6 w-6"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {budget && (
          <div className="space-y-2">
            <DynamicProgress
              value={percentUsed}
              extraStyles={`${
                percentUsed >= 90
                  ? "bg-red-500"
                  : percentUsed >= 75
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
            />
            <p className="text-xs text-muted-foreground text-right">
              {percentUsed.toFixed(1)}% used
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}