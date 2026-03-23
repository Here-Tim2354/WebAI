"use client";

import { ChatMessage } from "@/lib/schemas/chat";
import { useMessageScroll } from "./use-message-scroll";

export function useChatScroll(messages: ChatMessage[]) {
  const result = useMessageScroll({ messages });

  return {
    messageEndRef: result.messageEndRef,
    scrollContainerRef: result.scrollContainerRef,
    scrollToLatest: result.scrollToLatest,
    showScrollToLatest: result.showJumpToLatest,
    handleScroll: result.handleScroll,
  };
}
