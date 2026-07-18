"use client";

import { useRef, useEffect, useState } from "react";
import { Loader2, ReceiptIndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import useFetch from "@/hooks/use-fetch";
import { importStatementTransactions } from "@/actions/transaction";

export function StatementScanner({ accounts = [], onStatementImport }) {
  const statementInputRef = useRef(null);
  const [open, setOpen] = useState(false);

  const defaultAccountId =
    accounts.find((ac) => ac.isDefault)?.id || accounts[0]?.id || "";
  const [selectedAccountId, setSelectedAccountId] = useState(defaultAccountId);

  // The account the in-flight import was started with. Held separately so that
  // reopening the dialog mid-import can't retarget transactions already parsed.
  const importAccountRef = useRef(defaultAccountId);

  const {
    loading: importStatementLoading,
    fn: importStatementFn,
    data: importedStatement,
  } = useFetch(importStatementTransactions);

  // Accounts load asynchronously on first render; adopt the default once it
  // arrives, but never clobber a choice the user has already made.
  useEffect(() => {
    if (!selectedAccountId && defaultAccountId) {
      setSelectedAccountId(defaultAccountId);
      importAccountRef.current = defaultAccountId;
    }
  }, [defaultAccountId, selectedAccountId]);

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size should be less than 5MB");
      return;
    }

    if (!selectedAccountId) {
      toast.error("Please select an account first");
      return;
    }

    importAccountRef.current = selectedAccountId;
    setOpen(false);
    await importStatementFn(file);
  };

  useEffect(() => {
    if (importedStatement && !importStatementLoading) {
      onStatementImport(importedStatement, importAccountRef.current);
      toast.success("Bank statement imported successfully!");
    }
  }, [importStatementLoading, importedStatement]);

  const selectedAccount = accounts.find((ac) => ac.id === selectedAccountId);

  return (
    <div className="w-full">
      <input
        type="file"
        ref={statementInputRef}
        className="hidden"
        accept=".pdf,.csv,.xls,.xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
          // Reset so picking the same file again still fires onChange.
          e.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        className="w-full h-9 sm:h-10 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 animate-gradient hover:opacity-90 transition-opacity text-white hover:text-white text-xs sm:text-sm"
        onClick={() => setOpen(true)}
        disabled={importStatementLoading}
      >
        {importStatementLoading ? (
          <>
            <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
            <span>Importing...</span>
          </>
        ) : (
          <>
            <ReceiptIndianRupee className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span>Import Statement</span>
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Bank Statement</DialogTitle>
            <DialogDescription>
              Choose the account these transactions belong to, then pick your
              statement file. You can still change the account on individual
              transactions afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Import into account</label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                      {account.isDefault ? " (Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccount && (
                <p className="text-xs text-muted-foreground">
                  All imported transactions will be added to{" "}
                  <span className="font-medium">{selectedAccount.name}</span>.
                </p>
              )}
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={!selectedAccountId}
              onClick={() => statementInputRef.current?.click()}
            >
              Choose statement file
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              PDF, CSV or Excel. Max 5MB.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
