"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Build the last few Indian Financial Years (Apr 1 – Mar 31). The current FY
// is derived from today's date: months Apr–Dec belong to the FY starting this
// year, Jan–Mar belong to the FY that started last year.
function buildFinancialYears(count = 4) {
  const now = new Date();
  const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const years = [];
  for (let i = 0; i < count; i++) {
    const y = startYear - i;
    years.push({
      key: `${y}-${String((y + 1) % 100).padStart(2, "0")}`, // e.g. 2025-26
      label: `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`,
      sublabel: `Apr ${y} – Mar ${y + 1}`,
      from: `${y}-04-01`,
      to: `${y + 1}-03-31`,
    });
  }
  return years;
}

export default function ItrBuddy({ accounts = [] }) {
  const financialYears = useMemo(() => buildFinancialYears(), []);

  // All accounts pre-selected by default; user unchecks what they don't want.
  const [selected, setSelected] = useState(() =>
    Object.fromEntries(accounts.map((a) => [a.id, true]))
  );
  const [mode, setMode] = useState("fy"); // "fy" | "custom" | "all"
  const [fyKey, setFyKey] = useState(financialYears[0]?.key ?? "");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [downloading, setDownloading] = useState(false);

  const selectedIds = accounts.filter((a) => selected[a.id]).map((a) => a.id);
  const allSelected = accounts.length > 0 && selectedIds.length === accounts.length;

  const toggleAccount = (id) =>
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleAll = () => {
    const next = !allSelected;
    setSelected(Object.fromEntries(accounts.map((a) => [a.id, next])));
  };

  const handleDownload = async () => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one account to export.");
      return;
    }

    let from = "";
    let to = "";
    let label = "";

    if (mode === "fy") {
      const fy = financialYears.find((f) => f.key === fyKey);
      if (!fy) {
        toast.error("Please choose a financial year.");
        return;
      }
      from = fy.from;
      to = fy.to;
      label = `FY_${fy.key}`;
    } else if (mode === "custom") {
      if (!customFrom || !customTo) {
        toast.error("Please pick both a start and an end date.");
        return;
      }
      if (customFrom > customTo) {
        toast.error("Start date must be on or before the end date.");
        return;
      }
      from = customFrom;
      to = customTo;
      label = `${customFrom}_to_${customTo}`;
    } else {
      label = "all-time";
    }

    const params = new URLSearchParams();
    params.set("accounts", selectedIds.join(","));
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (label) params.set("label", label);

    try {
      setDownloading(true);
      // A same-origin anchor with Content-Disposition: attachment lets the
      // browser stream the CSV straight to the user's Downloads folder without
      // navigating away from the page.
      const a = document.createElement("a");
      a.href = `/api/itr-buddy/export?${params.toString()}`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Your transactions CSV is downloading.");
    } catch (err) {
      console.error(err);
      toast.error("Could not start the download. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No accounts yet</CardTitle>
          <CardDescription>
            Create an account and add some transactions first — then come back
            to download them here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const modeButton = (value, text) => (
    <Button
      type="button"
      variant={mode === value ? "default" : "outline"}
      onClick={() => setMode(value)}
      className="flex-1"
    >
      {text}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Accounts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>
                {selectedIds.length} of {accounts.length} selected
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
              {allSelected ? "Deselect all" : "Select all"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((account) => (
            <label
              key={account.id}
              className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent"
            >
              <Checkbox
                checked={!!selected[account.id]}
                onCheckedChange={() => toggleAccount(account.id)}
              />
              <div className="flex-1">
                <div className="font-medium">{account.name}</div>
                <div className="text-sm text-muted-foreground capitalize">
                  {account.type?.toLowerCase?.() || account.type}
                  {typeof account._count?.transactions === "number"
                    ? ` · ${account._count.transactions} transactions`
                    : ""}
                </div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Date range */}
      <Card>
        <CardHeader>
          <CardTitle>Period</CardTitle>
          <CardDescription>
            Choose a financial year, a custom range, or export everything.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {modeButton("fy", "Financial Year")}
            {modeButton("custom", "Custom range")}
            {modeButton("all", "All time")}
          </div>

          {mode === "fy" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {financialYears.map((fy) => (
                <button
                  key={fy.key}
                  type="button"
                  onClick={() => setFyKey(fy.key)}
                  className={`text-left rounded-md border p-3 transition-colors ${
                    fyKey === fy.key
                      ? "border-primary ring-1 ring-primary bg-accent"
                      : "hover:bg-accent"
                  }`}
                >
                  <div className="font-medium">{fy.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {fy.sublabel}
                  </div>
                </button>
              ))}
            </div>
          )}

          {mode === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {mode === "all" && (
            <p className="text-sm text-muted-foreground">
              Every transaction from the selected accounts will be included.
            </p>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={handleDownload}
        disabled={downloading || selectedIds.length === 0}
        size="lg"
        className="w-full flex items-center gap-2"
      >
        {downloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        Download CSV
      </Button>
    </div>
  );
}
