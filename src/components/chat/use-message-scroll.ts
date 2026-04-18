"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/lib/schemas/chat";

const SCROLL_THRESHOLD = 120;

// 允许用户离底部有一小段缓冲区，避免轻微滚动就立刻打断“自动吸底”体验。
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

/**
 * useMessageScroll 负责协调三件事：
 * 自动滚动到底部、用户上滑后的“停止吸底”、以及“回到底部”按钮的显示。
 */
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

  // 管理消息流的自动吸底行为。
  // 当前实现会在 messages 变化后判断是否仍应吸底，并根据“是否是新消息”决定 smooth 还是 auto 滚动。
  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container || messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const latestMessageId = latestMessage?.id ?? null;
    const latestMessageChanged = latestMessageId !== lastMessageIdRef.current;

    if (shouldStickToBottomRef.current) {
      // 新消息到来时用 smooth，同一条消息重渲染时用 auto，避免滚动动画抖动。
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
