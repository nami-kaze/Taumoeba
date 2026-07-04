"use client";

import { ArrowUpRight, ArrowDownRight, CreditCard, MoreHorizontal, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import useFetch from "@/hooks/use-fetch";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { updateDefaultAccount, deleteAccount } from "@/actions/account";
import dynamic from 'next/dynamic';
import { toast } from "sonner";

// Dynamically import the EditAccountDialog with no SSR
const EditAccountDialog = dynamic(
  () => import('@/components/edit-account-dialog').then(mod => mod.EditAccountDialog),
  { ssr: false }
);

export function AccountCard({ account }) {
  const { name, type, balance, id, isDefault } = account;
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    loading: updateDefaultLoading,
    fn: updateDefaultFn,
    data: updatedAccount,
    error: updateDefaultError,
  } = useFetch(updateDefaultAccount);

  const {
    loading: deleteLoading,
    fn: deleteFn,
    data: deleteResult,
    error: deleteError,
  } = useFetch(deleteAccount);

  const handleDefaultChange = async (event) => {
    event.preventDefault();

    if (isDefault) {
      toast.warning("You need atleast 1 default account");
      return;
    }

    await updateDefaultFn(id);
  };

  const handleEditClick = (e) => {
    e.preventDefault();
    setShowEditDialog(true);
  };

  const handleDeleteClick = (e) => {
    e.preventDefault();
    if (isDefault) {
      toast.warning("Please set another account as default before deleting this one");
      return;
    }
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      const result = await deleteFn(id);
      if (result?.success) {
        toast.success("Account deleted successfully");
        setShowDeleteDialog(false);
      } else {
        toast.error(result?.error || "Failed to delete account");
      }
    } catch (error) {
      toast.error(error.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (updatedAccount?.success) {
      toast.success("Default account updated successfully");
    }
  }, [updatedAccount]);

  useEffect(() => {
    if (updateDefaultError) {
      toast.error(updateDefaultError.message || "Failed to update default account");
    }
  }, [updateDefaultError]);

  useEffect(() => {
    if (deleteError) {
      toast.error(deleteError.message || "Failed to delete account");
      setIsDeleting(false);
    }
  }, [deleteError]);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow group relative">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium capitalize">
            {name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              checked={isDefault}
              onClick={handleDefaultChange}
              disabled={updateDefaultLoading || isDeleting}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" disabled={isDeleting}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={handleEditClick} disabled={isDeleting}>
                  Edit Account
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onSelect={handleDeleteClick}
                  className="text-red-600 focus:text-red-600"
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <Link href={`/account/${id}`}>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹{parseFloat(balance).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {type.charAt(0) + type.slice(1).toLowerCase()} Account
            </p>
          </CardContent>
          <CardFooter className="flex justify-between text-sm text-muted-foreground">
            <div className="flex items-center">
              <ArrowUpRight className="mr-1 h-4 w-4 text-green-500" />
              Income
            </div>
            <div className="flex items-center">
              <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
              Expense
            </div>
          </CardFooter>
        </Link>
      </Card>

      {showEditDialog && (
        <EditAccountDialog 
          account={account} 
          open={showEditDialog} 
          onOpenChange={setShowEditDialog}
        />
      )}

      <AlertDialog 
        open={showDeleteDialog} 
        onOpenChange={setShowDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the account
              and all its associated transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
