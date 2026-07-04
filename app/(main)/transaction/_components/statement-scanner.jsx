"use client";

import { useRef, useEffect} from "react";
import { Loader2, ReceiptIndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import useFetch from "@/hooks/use-fetch";
import { importStatementTransactions} from "@/actions/transaction";

export function StatementScanner({onStatementImport }) {
  const statementInputRef = useRef(null);

  const {
    loading: importStatementLoading,
    fn: importStatementFn,
    data: importedStatement,
  } = useFetch(importStatementTransactions);

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size should be less than 5MB");
      return;
    }
    await importStatementFn(file);
  };

  useEffect(() => {
    if (importedStatement && !importStatementLoading) {
      onStatementImport(importedStatement);
      toast.success("Bank statement imported successfully!");
    }
  }, [importStatementLoading, importedStatement]);

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
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full h-9 sm:h-10 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 animate-gradient hover:opacity-90 transition-opacity text-white hover:text-white text-xs sm:text-sm"
        onClick={() => statementInputRef.current?.click()}
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
    </div>
  );
}