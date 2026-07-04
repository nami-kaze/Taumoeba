"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";

export default function ChatMessage({ message, isAi }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex gap-3 items-start",
        isAi ? "flex-row" : "flex-row-reverse"
      )}
    >
      {isAi ? (
        <Avatar>
          <AvatarImage src="/bot-avatar.png" />
          <AvatarFallback >Fina</AvatarFallback>
        </Avatar>
      ) : (
        <Avatar>
          <AvatarFallback>You</AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[85%] text-sm",
          isAi
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            : "bg-blue-500 text-white ml-auto"
        )}
      >
        {message}
      </div>
    </motion.div>
  );
} 