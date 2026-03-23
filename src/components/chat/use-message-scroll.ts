"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/schemas/chat";

const SCROLL_THRESHOLD = 120;

function isNearBottom(element: HTMLDivElement) {
  const distanceToBottom =
    element.scrollHeight - element.scrollTop - element.clientHeight;

  return distanceToBottom <= SCROLL_THRESHOLD;
}

type UseMessageScrollOptions = {
  messages: ChatMessage[];
};

type UseMessageScrollResult = {
  messageEndRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  showJumpToLatest: boolean;
  handleScroll: () => void;
  scrollToLatest: (behavior?: ScrollBehavior) => void;
};

export function useMessageScroll({
  messages,
}: UseMessageScrollOptions): UseMessageScrollResult {
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const shouldStickToBottomRef = useRef(true);
  const lastMessageIdRef = useRef<string | null>(null);

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    messageEndRef.current?.scrollIntoView({ behavior, block: "end" });
    shouldStickToBottomRef.current = true;
    setShowJumpToLatest(false);
  }

  function handleScroll() {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    const nearBottom = isNearBottom(container);
    shouldStickToBottomRef.current = nearBottom;
    setShowJumpToLatest(!nearBottom);
  }

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container || messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const latestMessageId = latestMessage?.id ?? null;
    const latestMessageChanged = latestMessageId !== lastMessageIdRef.current;

    if (shouldStickToBottomRef.current) {
      messageEndRef.current?.scrollIntoView({
        behavior: latestMessageChanged ? "smooth" : "auto",
        block: "end",
      });
    }

    lastMessageIdRef.current = latestMessageId;
  }, [messages]);

  return {
    messageEndRef,
    scrollContainerRef,
    showJumpToLatest,
    handleScroll,
    scrollToLatest,
  };
}
