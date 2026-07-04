"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import ChatMessage from "./chat-message";
import { getFinancialAdvice } from "@/actions/chat";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { useChatScroll } from "./use-chat-scroll";

export default function FinancialAdvice({ messages, setMessages }) {
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { isLoaded, isSignedIn } = useAuth();
  const messagesContainerRef = useChatScroll(messages);

  // Set initial message
  useEffect(() => {
    if (!isLoaded) return;
    if (messages.length > 0) return; // Don't set initial message if we already have messages

    if (!isSignedIn) {
      setMessages([{
        text: "👋 Please sign in to chat",
        isAi: true
      }]);
      return;
    }

    // Set welcome message
    setMessages([{
      text: "👋 Hi! Ask me anything about saving, investing, or managing your money.",
      isAi: true
    }]);
  }, [isLoaded, isSignedIn, messages.length, setMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!isSignedIn) {
      toast.error("Please sign in to use the chat feature");
      return;
    }
    
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    try {
      // Add user message immediately
      setMessages(prev => [...prev, { text: userMessage, isAi: false }]);

      // Get AI response
      const response = await getFinancialAdvice(userMessage);
      
      // Add AI response
      setMessages(prev => [...prev, { text: response, isAi: true }]);
    } catch (error) {
      console.error("Error in chat response:", error);
      toast.error("Failed to get response. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area - Takes remaining height with scrolling */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800 rounded-lg mx-4 mt-4"
      >
        <div className="space-y-4">
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              message={message.text}
              isAi={message.isAi}
            />
          ))}
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 mx-4 rounded-b-lg">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={isLoading ? "AI is thinking..." : "Ask me about financial advice..."}
            disabled={isLoading || !isSignedIn}
            className="flex-1 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
          />
          <Button
            type="submit"
            disabled={isLoading || !isSignedIn}
            variant="default"
            size="icon"
            className="dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
} 