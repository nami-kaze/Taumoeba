"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import FinancialAdvice from "./_components/financial-advice";
import ExpenseBudgeting from "./_components/expense-budgeting";

export default function ChatPage() {
  const [activeMode, setActiveMode] = useState("financial-advice");
  const [financialMessages, setFinancialMessages] = useState([]);
  const [expenseMessages, setExpenseMessages] = useState([]);

  const handleModeChange = (newMode) => {
    if (newMode === activeMode) return;
    setActiveMode(newMode);
  };

  return (
    <div className="h-[80vh] p-0">
      <Card className="h-full transition-all duration-300 group relative mx-auto dark:bg-gray-900">
        <CardContent className="flex flex-col md:flex-row h-full p-0">
          {/* Left Navigation Column */}
          <div className="w-full md:w-1/4 md:min-w-[200px] h-full border-b md:border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col space-y-4 dark:bg-gray-900">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight gradient-title text-center md:text-left">
              Fina
            </h1>
            <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible">
              <Button
                variant={activeMode === "financial-advice" ? "default" : "ghost"}
                className={`w-full justify-start gap-2 ${
                  activeMode === "financial-advice"
                    ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                onClick={() => handleModeChange("financial-advice")}
              >
                <MessageCircle size={20} />
                <span className="truncate">Financial Advice</span>
              </Button>
              <Button
                variant={activeMode === "expense-budgeting" ? "default" : "ghost"}
                className={`w-full justify-start gap-2 ${
                  activeMode === "expense-budgeting"
                    ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                onClick={() => handleModeChange("expense-budgeting")}
              >
                <CreditCard size={20} />
                <span className="truncate">Expense & Budgeting</span>
              </Button>
            </div>
          </div>

          {/* Chat Interface */}
          <div className="flex-1 flex flex-col dark:bg-gray-900">
            {activeMode === "financial-advice" ? (
              <FinancialAdvice 
                messages={financialMessages}
                setMessages={setFinancialMessages}
              />
            ) : (
              <ExpenseBudgeting 
                messages={expenseMessages}
                setMessages={setExpenseMessages}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}