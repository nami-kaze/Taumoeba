import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format a numeric value as an Indian Rupee amount, e.g. 1234.5 -> "₹1234.50".
// Accepts numbers or numeric strings (values are coerced with parseFloat).
export function formatCurrency(value, decimals = 2) {
  return `₹${parseFloat(value).toFixed(decimals)}`;
}
