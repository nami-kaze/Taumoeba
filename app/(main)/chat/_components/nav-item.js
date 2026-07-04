"use client";

import { Button } from "@/components/ui/button";

export default function NavItem({ icon, label, active, onClick }) {
  const handleClick = () => {
    console.log(`NavItem clicked: ${label}`);
    onClick?.();
  };

  return (
    <Button
      variant={active ? "default" : "ghost"}
      className={`w-full justify-start gap-2 ${
        active
          ? "bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
          : "hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
      onClick={handleClick}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
} 