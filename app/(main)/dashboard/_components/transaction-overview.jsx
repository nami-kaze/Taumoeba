"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { format, startOfDay, endOfDay } from "date-fns";
import { ArrowUpRight, ArrowDownRight, Calendar } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEEAD",
  "#D4A5A5",
  "#9FA8DA",
];

export function DashboardOverview({ accounts, transactions }) {
  const [selectedAccountId, setSelectedAccountId] = useState(
    accounts.find((a) => a.isDefault)?.id || accounts[0]?.id
  );
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [dateRange, setDateRange] = useState({
    from: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    to: endOfDay(new Date())
  });
  const [activeTab, setActiveTab] = useState("monthly");

  // Get available months for filtering
  const months = Array.from({ length: 12 }, (_, i) => ({
    label: format(new Date(2023, i, 1), "MMMM"),
    value: i + 1,
  }));

  // Filter transactions for selected account
  const accountTransactions = transactions.filter(
    (t) => t.accountId === selectedAccountId
  );

  // Get recent transactions (last 5)
  const recentTransactions = accountTransactions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  // Filter transactions based on active tab
  const filteredExpenses = accountTransactions.filter((t) => {
    const transactionDate = new Date(t.date);
    if (activeTab === "monthly") {
      return (
        t.type === "EXPENSE" &&
        transactionDate.getMonth() + 1 === selectedMonth &&
        transactionDate.getFullYear() === new Date().getFullYear()
      );
    } else {
      return (
        t.type === "EXPENSE" &&
        transactionDate >= dateRange.from &&
        transactionDate <= dateRange.to
      );
    }
  });

  // Group expenses by category
  const expensesByCategory = filteredExpenses.reduce((acc, transaction) => {
    const category = transaction.category;
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += transaction.amount;
    return acc;
  }, {});

  // Format data for pie chart
  const pieChartData = Object.entries(expensesByCategory).map(
    ([category, amount]) => ({
      name: category,
      value: amount,
    })
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Recent Transactions Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-normal">
            Recent Transactions
          </CardTitle>
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No recent transactions
              </p>
            ) : (
              recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {transaction.description || "Untitled Transaction"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transaction.date), "PP")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex items-center",
                        transaction.type === "EXPENSE"
                          ? "text-red-500"
                          : "text-green-500"
                      )}
                    >
                      {transaction.type === "EXPENSE" ? (
                        <ArrowDownRight className="mr-1 h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="mr-1 h-4 w-4" />
                      )}
                      ₹{transaction.amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expense Breakdown Card */}
      {/* Expense Breakdown Card */}
<Card>
  <CardHeader className="space-y-4">
    <div className="flex items-center justify-between">
      <CardTitle className="text-base font-normal">
        Expense Breakdown
      </CardTitle>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-[300px]"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="custom">Custom Range</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    {/* Total Expense Display */}
    <div className="flex justify-between items-center">
      <p className="text-sm text-muted-foreground">
        Total Expense{" "}
        {activeTab === "monthly"
          ? `(${months.find((m) => m.value === selectedMonth)?.label})`
          : `(Selected Range)`}
      </p>
      <p className="text-lg font-semibold">
        ₹
        {filteredExpenses
          .reduce((sum, t) => sum + t.amount, 0)
          .toFixed(2)}
      </p>
    </div>

    <div className="flex justify-end">
      {activeTab === "monthly" ? (
        <Select
          value={selectedMonth}
          onValueChange={setSelectedMonth}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select Month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month.value} value={month.value}>
                {month.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[280px] justify-start text-left font-normal",
                !dateRange && "text-muted-foreground"
              )}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align="end"
          >
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  </CardHeader>

  <CardContent className="p-0 pb-5">
    {pieChartData.length === 0 ? (
      <p className="text-center text-muted-foreground py-4">
        {activeTab === "monthly"
          ? `No expenses for ${
              months.find((m) => m.value === selectedMonth)?.label
            }`
          : "No expenses for selected date range"}
      </p>
    ) : (
      <div className="h-[350px] md:h-[400px] w-full px-2">
  <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        data={pieChartData}
        cx="50%"
        cy="50%"
        outerRadius="70%"
        fill="#8884d8"
        dataKey="value"
        labelLine={false}
      >
        {pieChartData.map((entry, index) => (
          <Cell
            key={`cell-${index}`}
            fill={COLORS[index % COLORS.length]}
          />
        ))}
      </Pie>

      <Tooltip
        formatter={(value) => `₹${value.toFixed(2)}`}
        contentStyle={{
          backgroundColor: "hsl(var(--popover))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "var(--radius)",
          color: "hsl(var(--popover-foreground))",
        }}
        labelStyle={{ color: "hsl(var(--popover-foreground))" }}
        itemStyle={{ color: "hsl(var(--popover-foreground))" }}
        wrapperStyle={{ outline: "none" }}
      />

      {/* Keep Legend for category names */}
      <Legend verticalAlign="bottom" height={60} />
    </PieChart>
  </ResponsiveContainer>
</div>
    )}
  </CardContent>
</Card>
    </div>
  );
}