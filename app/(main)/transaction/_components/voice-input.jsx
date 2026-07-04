"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function VoiceInput({ onVoiceInput }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const recognitionRef = useRef(null);
  const processingRef = useRef(false);

  const processVoiceInput = useCallback(async (text) => {
    if (!text.trim() || processingRef.current) return;
    
    processingRef.current = true;
    setIsProcessing(true);
    try {
      const words = text.toLowerCase().split(' ');
      
      // Default values
      let type = "EXPENSE";
      let amount = 0;
      let category = "other-expense";
      let description = "";
      let date = new Date();

      // Process type
      const incomeKeywords = ["income", "received", "receive", "salary", "credited", "earned", "payment received", "got paid", "credit"];
      if (incomeKeywords.some(keyword => words.includes(keyword))) {
        type = "INCOME";
        // Set default income category based on keywords
        if (words.includes("salary")) {
          category = "salary";
        } else {
          category = "other-income";
        }
      }

      for (let i = 0; i < words.length; i++) {
        const num = parseFloat(words[i].replace(/,/g, ''));
        if (!isNaN(num)) {
          if (i < words.length - 1 && 
              (words[i + 1].includes("rupee") || 
               words[i + 1] === "rs" || 
               words[i + 1].startsWith("₹"))) {
            amount = num;
            break;
          }

          else if ((i > 0 && words[i - 1] === "of") || 
                   (i < words.length - 1 && words[i + 1] === "for")) {
            amount = num;
            break;
          }
        }
        else if (words[i].startsWith("₹") || words[i].startsWith("rupees")) {
          const numStr = words[i].replace(/[₹rs]/gi, '').replace(/,/g, '');
          const parsedNum = parseFloat(numStr);
          if (!isNaN(parsedNum)) {
            amount = parsedNum;
            break;
          }
        }
      }
      if (amount === 0) {
        for (const word of words) {
          const num = parseFloat(word.replace(/,/g, ''));
          if (!isNaN(num) && num > 0) {
            amount = num;
            break;
          }
        }
      }

      console.log("Detected amount:", amount);

      // Process category
      const commonCategories = {
        // Income categories
        "salary": "salary",
        "freelance": "freelance",
        "investment": "investments",
        "rental": "rental",
        "business": "business",
        
        // Expense categories
        "groceries": "groceries",
        "food": "food",
        "shopping": "shopping",
        "travel": "travel",
        "entertainment": "entertainment",
        "bills": "bills",
        "rent": "housing",
      };

      const categoryIndex = words.indexOf("category");
      if (categoryIndex !== -1 && categoryIndex < words.length - 1) {
        const potentialCategory = words[categoryIndex + 1];
        if (commonCategories[potentialCategory]) {
          category = commonCategories[potentialCategory];
        }

        for (const [key, value] of Object.entries(commonCategories)) {
          if (words.includes(key)) {
            category = value;
            break;
          }
        }
      }

      // Process date
      if (words.includes("yesterday")) {
        date = new Date(Date.now() - 86400000);
      } else if (words.includes("tomorrow")) {
        date = new Date(Date.now() + 86400000);
      }

      let descriptionWords = [];

      const forIndex = words.indexOf("for");
      if (forIndex !== -1) {
        descriptionWords = words.slice(forIndex + 1);
      }
      
      const fromIndex = words.indexOf("from");
      if (fromIndex !== -1) {
        descriptionWords = words.slice(fromIndex + 1);
      }

      description = descriptionWords
        .filter(word => !["rupees", "rs", "category", "yesterday", "tomorrow", "today"].includes(word))
        .join(" ");
      if (description) {
        description = description
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      const transaction = {
        type,
        amount,
        category,
        description: description || `Voice recorded ${type.toLowerCase()}`,
        date,
      };

      onVoiceInput(transaction);
      toast.success("Voice input processed successfully!");
    } catch (error) {
      console.error("Error processing voice input:", error);
      toast.error("Failed to process voice input. Please try again.");
    } finally {
      setIsProcessing(false);
      setTranscript("");
      setFinalTranscript("");
      processingRef.current = false;
    }
  }, [onVoiceInput]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';

      recognitionInstance.onstart = () => {
        console.log("Speech recognition started");
        setIsListening(true);
        processingRef.current = false;
      };

      recognitionInstance.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setFinalTranscript(finalTranscript);
          // Process final transcript immediately
          processVoiceInput(finalTranscript);
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        toast.error("Error with speech recognition. Please try again.");
        setIsListening(false);
        setIsProcessing(false);
        processingRef.current = false;
      };

      recognitionInstance.onend = () => {
        console.log("Speech recognition ended");
        if (!processingRef.current) {
          const textToProcess = finalTranscript || transcript;
          if (textToProcess) {
            processVoiceInput(textToProcess);
          }
        }
        setIsListening(false);
      };

      recognitionRef.current = recognitionInstance;
    } else {
      toast.error("Speech recognition is not supported in your browser");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [processVoiceInput]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error("Speech recognition is not supported in your browser");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript("");
      setFinalTranscript("");
      try {
        recognitionRef.current.start();
        toast.info("Listening... Speak your transaction details");
      } catch (error) {
        console.error("Error starting recognition:", error);
        toast.error("Failed to start voice recognition. Please try again.");
        setIsListening(false);
      }
    }
  }, [isListening]);

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="outline"
        className={`w-full h-9 sm:h-10 ${
          isListening 
            ? "bg-red-500 hover:bg-red-600" 
            : "bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 animate-gradient hover:opacity-90"
        } transition-all text-white hover:text-white text-xs sm:text-sm`}
        onClick={toggleListening}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
            <span>Processing...</span>
          </>
        ) : isListening ? (
          <>
            <MicOff className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span>Stop Recording</span>
          </>
        ) : (
          <>
            <Mic className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span>Voice Input</span>
          </>
        )}
      </Button>
      {(transcript || finalTranscript) && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {finalTranscript || transcript}
        </p>
      )}
    </div>
  );
} 