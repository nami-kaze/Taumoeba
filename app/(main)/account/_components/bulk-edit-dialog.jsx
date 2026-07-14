"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { cn, formatCurrency } from "@/lib/utils";
import { defaultCategories } from "@/data/categories";
import { bulkUpdateTransactions } from "@/actions/transaction";
import useFetch from "@/hooks/use-fetch";

// Build the editable local row shape from a serialized transaction.
const toRow = (t) => ({
  id: t.id,
  type: t.type,
  amount: t.amount?.toString() ?? "",
  description: t.description ?? "",
  date: new Date(t.date),
  accountId: t.accountId,
  category: t.category,
  isRecurring: Boolean(t.isRecurring),
  recurringInterval: t.recurringInterval ?? "",
});

export function BulkEditDialog({
  transactions = [],
  accounts = [],
  open,
  onOpenChange,
  onSaved,
}) {
  const [rows, setRows] = useState([]);

  // Re-seed the editable rows every time the dialog opens with a fresh selection.
  useEffect(() => {
    if (open) {
      setRows(transactions.map(toRow));
    }
  }, [open, transactions]);

  const {
    loading: saving,
    fn: saveFn,
    data: saveResult,
    setData: setSaveResult,
  } = useFetch(bulkUpdateTransactions);

  useEffect(() => {
    if (saveResult?.success && !saving) {
      toast.success(
        `${saveResult.count} transaction${saveResult.count > 1 ? "s" : ""} updated successfully`
      );
      setSaveResult(undefined);
      onSaved?.();
      onOpenChange(false);
    }
  }, [saveResult, saving]);

  const updateRow = (index, patch) => {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleSave = () => {
    // Light client validation; the server re-validates and fixes balances.
    for (const row of rows) {
      const amount = parseFloat(row.amount);
      if (Number.isNaN(amount) || amount <= 0) {
        toast.error("Every transaction needs a valid amount greater than 0");
        return;
      }
      if (!row.category) {
        toast.error("Every transaction needs a category");
        return;
      }
      if (!row.accountId) {
        toast.error("Every transaction needs an account");
        return;
      }
      if (row.isRecurring && !row.recurringInterval) {
        toast.error("Pick an interval for recurring transactions");
        return;
      }
    }

    saveFn(
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        amount: parseFloat(row.amount),
        description: row.description,
        date: row.date,
        accountId: row.accountId,
        category: row.category,
        isRecurring: row.isRecurring,
        recurringInterval: row.isRecurring ? row.recurringInterval : null,
      }))
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Edit {rows.length} Transaction{rows.length > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Make changes to each transaction below, then save them all at once.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3">
          {rows.map((row, index) => {
            const filteredCategories = defaultCategories.filter(
              (c) => c.type === row.type
            );
            return (
              <div
                key={row.id}
                className="border rounded-md p-3 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-sm space-y-2"
              >
                <div className="text-xs font-semibold text-muted-foreground">
                  #{index + 1}
                </div>

                {/* Type, Amount, Account */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Select
                    value={row.type}
                    onValueChange={(value) =>
                      // Reset category on type change — categories are type-scoped.
                      updateRow(index, { type: value, category: "" })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXPENSE">Expense</SelectItem>
                      <SelectItem value="INCOME">Income</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={row.amount}
                    className="h-9"
                    onChange={(e) => updateRow(index, { amount: e.target.value })}
                  />

                  <Select
                    value={row.accountId}
                    onValueChange={(value) =>
                      updateRow(index, { accountId: value })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({formatCurrency(account.balance)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Category, Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select
                    value={row.category}
                    onValueChange={(value) =>
                      updateRow(index, { category: value })
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full h-9 justify-start text-left font-normal",
                          !row.date && "text-muted-foreground"
                        )}
                      >
                        {row.date ? format(row.date, "PPP") : "Pick a date"}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={row.date}
                        onSelect={(date) => date && updateRow(index, { date })}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Description */}
                <Input
                  type="text"
                  value={row.description}
                  className="h-9"
                  placeholder="Description"
                  onChange={(e) =>
                    updateRow(index, { description: e.target.value })
                  }
                />

                {/* Recurring */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={row.isRecurring}
                      onCheckedChange={(checked) =>
                        updateRow(index, {
                          isRecurring: checked,
                          recurringInterval: checked ? row.recurringInterval : "",
                        })
                      }
                    />
                    <span className="text-sm">Recurring</span>
                  </div>
                  {row.isRecurring && (
                    <Select
                      value={row.recurringInterval}
                      onValueChange={(value) =>
                        updateRow(index, { recurringInterval: value })
                      }
                    >
                      <SelectTrigger className="h-9 w-[140px]">
                        <SelectValue placeholder="Interval" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              `Save all (${rows.length})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
