"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { cn } from "@/lib/utils";
import { createBulkTransactions, createTransaction, importStatementTransactions, updateTransaction } from "@/actions/transaction";
import { transactionSchema } from "@/app/lib/schema";
import { ReceiptScanner } from "./recipt-scanner";
import { defaultCategories } from "@/data/categories";
import { StatementScanner } from "./statement-scanner";
import { VoiceInput } from "./voice-input";

export function AddTransactionForm({
  accounts,
  categories,
  editMode = false,
  initialData = null,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
    reset,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
            type: initialData.type,
            amount: initialData.amount.toString(),
            description: initialData.description,
            accountId: initialData.accountId,
            category: initialData.category,
            date: new Date(initialData.date),
            isRecurring: initialData.isRecurring,
            ...(initialData.recurringInterval && {
              recurringInterval: initialData.recurringInterval,
            }),
          }
        : {
            type: "EXPENSE",
            amount: "",
            description: "",
            accountId: accounts.find((ac) => ac.isDefault)?.id,
            date: new Date(),
            isRecurring: false,
          },
  });

  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch(editMode ? updateTransaction : createTransaction);

  const {
    loading: bulkTransactionLoading,
    fn: bulkTransactionFn,
    data: bulkTransactionResult,
  } = useFetch(createBulkTransactions);

  const [isImporting, setIsImporting] = useState(false);
  const [importedTransactions, setImportedTransactions] = useState([]);

  const onSubmit = (data) => {
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    };

    console.log(formData)
   if (editMode) {
      transactionFn(editId, formData);
    } else {
      transactionFn(formData);
    }
  };

  const handleBulkAddTransactions = () => {
      if (!importedTransactions.length) return;
      const formattedTransactions = importedTransactions.map((t) => ({
        ...t,
        amount: parseFloat(t.amount),
        accountId: t.accountId || defaultAccountId,
      }));
      console.log(formattedTransactions)
      bulkTransactionFn(formattedTransactions);

  };

  const handleScanComplete = (scannedData) => {
    if (scannedData) {
      setIsImporting(false);
      console.log(scannedData);
      setValue("amount", scannedData.amount.toString());
      setValue("date", new Date(scannedData.date));
      if (scannedData.description) {
        setValue("description", scannedData.description);
      }
      if (scannedData.category) {
        setValue("category", scannedData.category);
      }
      toast.success("Receipt scanned successfully");
    }
  };

  const handleStatementImport = (importedStatement) => {
    if (importedStatement.length > 0) {
      setIsImporting(true);
      setImportedTransactions(importedStatement);
  
      importedStatement.forEach((transaction, index) => {
        setValue(`transactions.${index}.amount`, transaction.amount.toString());
        setValue(`transactions.${index}.date`, new Date(transaction.date));
  
        if (transaction.description) {
          setValue(`transactions.${index}.description`, transaction.description);
        }
  
        if (transaction.category) {
          const categoryObj = defaultCategories.find(
            (cat) => cat.name.toLowerCase() === transaction.category.toLowerCase()
          );
  
          setValue(
            `transactions.${index}.category`,
            categoryObj ? categoryObj.id : "other-expense"
          );

          importedStatement[index].category = categoryObj ? categoryObj.id : "other-expense";
        }
  
        if (transaction.type) {
          const formattedType =
          transaction.type.toUpperCase() === "EXPENSE" ? "EXPENSE" : "INCOME";
          setValue(`transactions.${index}.type`, formattedType);
          importedStatement[index].type = formattedType;
          if(formattedType === 'INCOME'){
            setValue(`transactions.${index}.category`,"other-income");
            importedStatement[index].category = "other-income";
          } 
        }
      });
      // Update local state to reflect changes
      console.log("final", importedStatement)
      setImportedTransactions([...importedStatement]);
      toast.success("Transactions imported successfully");
    }
  };

  const handleVoiceInput = (voiceData) => {
    if (voiceData) {
      // Set type first to ensure it updates correctly
      setValue("type", voiceData.type);
      // Add a small delay to ensure type is set before other fields
      setTimeout(() => {
        setValue("amount", voiceData.amount.toString());
        setValue("date", new Date(voiceData.date));
        setValue("description", voiceData.description);
        if (voiceData.category) {
          setValue("category", voiceData.category);
        }
        toast.success("Voice input added successfully");
      }, 100);
    }
  };

  const handleCancelImport = () => {
    setIsImporting(false);
    setImportedTransactions([]);
    toast.success("Import canceled.");
  };
  
  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      toast.success(
        editMode
          ? "Transaction updated successfully"
          : "Transaction created successfully"
      );
      reset();
      router.push(`/account/${transactionResult.data.accountId}`);
    }
  }, [transactionResult, transactionLoading, editMode]);

  useEffect(() => {
    if (bulkTransactionResult?.success && !bulkTransactionLoading) {
      toast.success(
         "Transactions created successfully"
      );
      reset();
      router.push(`/account/${defaultAccountId}`);
    }
  }, [bulkTransactionResult, bulkTransactionLoading]);

  const type = watch("type");
  const isRecurring = watch("isRecurring");
  const date = watch("date");

  const defaultAccountId = accounts.find((ac) => ac.isDefault)?.id || accounts[0]?.id || "";
  
  // Filter categories based on transaction type
  const filteredCategories = defaultCategories.filter(category => category.type === (type || "EXPENSE"));
  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
      {isImporting ? (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-4">
              {!editMode && <ReceiptScanner onScanComplete={handleScanComplete} />}
              {!editMode && <StatementScanner onStatementImport={handleStatementImport} />}
              {!editMode && <VoiceInput onVoiceInput={handleVoiceInput} />}
            </div>

            <div>
              <h3 className="text-lg font-semibold dark:text-white mb-3">Imported Transactions</h3>
              <div className="grid gap-3">
                {importedTransactions.map((transaction, index) => (
                  <div key={index} className="border p-2 sm:p-3 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm">
                    {/* Compact Header with Type, Amount & Date */}
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="text-sm font-medium flex flex-wrap items-center gap-2">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded text-xs sm:text-sm">
                          {watch(`transactions.${index}.type`) || "Type"}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">
                          {transaction.description}
                        </span>
                        <span className="text-gray-600 dark:text-gray-300 text-xs sm:text-sm">₹{transaction.amount}</span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {transaction.date ? format(new Date(transaction.date), "MMM d, yyyy") : "Pick Date"}
                      </span>
                    </div>

                    {/* Expandable Details */}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-blue-500 dark:text-blue-400 text-sm">More Details</summary>
                      <div className="grid gap-2 mt-2">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {/* Type Selector */}
                          <Select
                            value={watch(`transactions.${index}.type`) || ""}
                            onValueChange={(value) => {
                              setValue(`transactions.${index}.type`, value);
                              // Reset category when type changes
                              setValue(`transactions.${index}.category`, "");
                              const updatedTransactions = [...importedTransactions];
                              updatedTransactions[index].type = value;
                              updatedTransactions[index].category = "";
                              setImportedTransactions(updatedTransactions);
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="EXPENSE">Expense</SelectItem>
                              <SelectItem value="INCOME">Income</SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Amount */}
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={transaction.amount}
                            className="h-9"
                            onChange={(e) => {
                              const updatedTransactions = [...importedTransactions];
                              updatedTransactions[index].amount = e.target.value;
                              setImportedTransactions(updatedTransactions);
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Category */}
                          <Select
                            value={watch(`transactions.${index}.category`)}
                            onValueChange={(value) => {
                              setValue(`transactions.${index}.category`, value);
                              const updatedTransactions = [...importedTransactions];
                              updatedTransactions[index].category = value;
                              setImportedTransactions(updatedTransactions);
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              {defaultCategories
                                .filter(category => category.type === (watch(`transactions.${index}.type`) || "EXPENSE"))
                                .map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Account */}
                          <Select
                            value={accounts.find((a) => a.isDefault)?.id || accounts[0]?.id}
                            defaultValue={getValues("accountId")}
                            onValueChange={(value) => {
                              setValue(`transactions.${index}.accountId`, value);
                              const updatedTransactions = [...importedTransactions];
                              updatedTransactions[index].accountId = value;
                              setImportedTransactions(updatedTransactions);
                            }}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Account" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.name} (₹{parseFloat(account.balance).toFixed(2)})
                                </SelectItem>
                              ))}
                              {/* <CreateAccountDrawer>
                                <Button variant="ghost" className="w-full text-left text-sm">
                                  + Create Account
                                </Button>
                              </CreateAccountDrawer> */}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {/* Date */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full h-9 dark:text-gray-300 dark:border-gray-700 justify-start text-left font-normal">
                                {transaction.date ? format(new Date(transaction.date), "PPP") : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={new Date(transaction.date)}
                                onSelect={(date) => {
                                  const updatedTransactions = [...importedTransactions];
                                  updatedTransactions[index].date = date;
                                  setImportedTransactions(updatedTransactions);
                                }}
                                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>

                          {/* Description */}
                          <Input
                            type="text"
                            value={transaction.description || ""}
                            className="h-9"
                            onChange={(e) => {
                              const updatedTransactions = [...importedTransactions];
                              updatedTransactions[index].description = e.target.value;
                              setImportedTransactions(updatedTransactions);
                            }}
                            placeholder="Description"
                          />
                        </div>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Button variant="outline" onClick={handleCancelImport} className="w-full">
                Cancel
              </Button>
              <Button type="button" className="w-full" disabled={bulkTransactionLoading} onClick={handleBulkAddTransactions}>
                {bulkTransactionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Add Bulk Transactions"
                )}
              </Button>
            </div>
          </form>
        </>
      ) : (
        <>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch gap-2 sm:gap-4">
              {!editMode && <ReceiptScanner onScanComplete={handleScanComplete} />}
              {!editMode && <StatementScanner onStatementImport={handleStatementImport} />}
              {!editMode && <VoiceInput onVoiceInput={handleVoiceInput} />}
            </div>

            {/* Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Type</label>
              <Select onValueChange={(value) => {
                setValue("type", value);
                // Reset category when type changes
                setValue("category", "");
              }} value={type}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Expense</SelectItem>
                  <SelectItem value="INCOME">Income</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-red-500">{errors.type.message}</p>}
            </div>

            {/* Amount and Account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input type="number" step="0.01" placeholder="0.00" {...register("amount")} className="h-9" />
                {errors.amount && <p className="text-sm text-red-500">{errors.amount.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Account</label>
                <Select onValueChange={(value) => setValue("accountId", value)} defaultValue={getValues("accountId")}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} (₹{parseFloat(account.balance).toFixed(2)})
                      </SelectItem>
                    ))}
                    {/* <CreateAccountDrawer>
                      <Button variant="ghost" className="w-full text-left text-sm">
                        + Create Account
                      </Button>
                    </CreateAccountDrawer> */}
                  </SelectContent>
                </Select>
                {errors.accountId && <p className="text-sm text-red-500">{errors.accountId.message}</p>}
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select onValueChange={(value) => setValue("category", value)} value={watch("category")}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-sm text-red-500">{errors.category.message}</p>}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-9 pl-3 text-left font-normal justify-start",
                      !date && "text-muted-foreground"
                    )}
                  >
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(date) => setValue("date", date)}
                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.date && <p className="text-sm text-red-500">{errors.date.message}</p>}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input placeholder="Enter description" {...register("description")} className="h-9" />
              {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
            </div>

            {/* Recurring Toggle */}
            <div className="flex flex-row items-center justify-between rounded-lg border p-3 sm:p-4">
              <div className="space-y-0.5">
                <label className="text-sm sm:text-base font-medium">Recurring Transaction</label>
                <div className="text-xs sm:text-sm text-muted-foreground">
                  Set up a recurring schedule for this transaction
                </div>
              </div>
              <Switch
                checked={isRecurring}
                onCheckedChange={(checked) => setValue("isRecurring", checked)}
              />
            </div>

            {/* Recurring Interval */}
            {isRecurring && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Recurring Interval</label>
                <Select
                  onValueChange={(value) => setValue("recurringInterval", value)}
                  defaultValue={getValues("recurringInterval")}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="WEEKLY">Weekly</SelectItem>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="YEARLY">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                {errors.recurringInterval && (
                  <p className="text-sm text-red-500">{errors.recurringInterval.message}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" className="w-full" disabled={transactionLoading}>
                {transactionLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editMode ? "Updating..." : "Creating..."}
                  </>
                ) : editMode ? (
                  "Update Transaction"
                ) : (
                  "Create Transaction"
                )}
              </Button>
            </div>
          </form>
        </>
      )}
       
    </div>
  );
}
