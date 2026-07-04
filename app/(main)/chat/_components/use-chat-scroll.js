import { useEffect, useRef } from 'react';

export function useChatScroll(messages) {
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    if (messagesContainerRef.current) {
      const element = messagesContainerRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [messages]); // Scroll when messages change

  return messagesContainerRef;
} 