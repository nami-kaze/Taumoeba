"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivacy } from "./privacy-context";

export function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy();
  const label = hidden ? "Show amounts" : "Hide amounts";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={hidden}
      className="text-muted-foreground hover:text-foreground"
    >
      {hidden ? (
        <EyeOff className="h-5 w-5" />
      ) : (
        <Eye className="h-5 w-5" />
      )}
    </Button>
  );
}
