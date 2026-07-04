"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PersonalExpense from "./_components/personal-expense";
import GroupExpense from "./_components/group-expense";

export default function BorrowLandingPage() {
  return (
    <div className="container mx-auto space-y-6">
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="personal">Personal Expenses</TabsTrigger>
          <TabsTrigger value="groups">Group Expenses</TabsTrigger>
        </TabsList>
      <div className="py-2"></div>
        {/* Personal Expenses Tab */}
       <PersonalExpense />
        {/* Group Expenses Tab */}
        <GroupExpense />
      </Tabs>
    </div>
  );
}
