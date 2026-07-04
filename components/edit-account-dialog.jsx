"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateAccount } from "@/actions/dashboard";
import { accountSchema } from "@/app/lib/schema";

export function EditAccountDialog({ account, open, onOpenChange }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: account?.name || "",
      type: account?.type || "CURRENT",
      balance: account?.balance?.toString() || "0",
      isDefault: account?.isDefault || false,
    },
  });

  const {
    loading: updateAccountLoading,
    fn: updateAccountFn,
    error,
    data: updatedAccount,
  } = useFetch(updateAccount);

  const onSubmit = async (data) => {
    if (!account?.id) return;
    const result = await updateAccountFn(account.id, data);
    if (result?.success) {
      toast.success("Account updated successfully");
      onOpenChange(false);
      reset();
    }
  };

  if (error) {
    toast.error(error.message || "Failed to update account");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogDescription>
            Make changes to your account details here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium leading-none"
            >
              Account Name
            </label>
            <Input
              id="name"
              placeholder="e.g., Main Checking"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="type"
              className="text-sm font-medium leading-none"
            >
              Account Type
            </label>
            <Select
              onValueChange={(value) => setValue("type", value)}
              defaultValue={watch("type")}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CURRENT">Current</SelectItem>
                <SelectItem value="SAVINGS">Savings</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-red-500">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="balance"
              className="text-sm font-medium leading-none"
            >
              Balance
            </label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("balance")}
            />
            {errors.balance && (
              <p className="text-sm text-red-500">{errors.balance.message}</p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <label
                htmlFor="isDefault"
                className="text-base font-medium cursor-pointer"
              >
                Set as Default
              </label>
              <p className="text-sm text-muted-foreground">
                This account will be selected by default for transactions
              </p>
            </div>
            <Switch
              id="isDefault"
              checked={watch("isDefault")}
              onCheckedChange={(checked) => setValue("isDefault", checked)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={updateAccountLoading}>
              {updateAccountLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 