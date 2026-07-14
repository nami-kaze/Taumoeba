"use client";

import { createContext, useContext, useState } from "react";
import { formatCurrency } from "@/lib/utils";

// Fixed mask — reveals nothing about the underlying amount.
const MASK = "₹••••";

const PrivacyContext = createContext({
  hidden: false,
  toggle: () => {},
  // Fallback (no provider): behave exactly like formatCurrency.
  formatAmount: formatCurrency,
});

export function PrivacyProvider({ children }) {
  // Resets to visible on every page load (by design — not persisted).
  const [hidden, setHidden] = useState(false);

  const toggle = () => setHidden((prev) => !prev);

  // Mask money figures when hidden; otherwise format normally.
  const formatAmount = (value, decimals = 2) =>
    hidden ? MASK : formatCurrency(value, decimals);

  return (
    <PrivacyContext.Provider value={{ hidden, toggle, formatAmount }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
