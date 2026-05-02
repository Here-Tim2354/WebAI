"use client";

import {
  RefObject,
  UIEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  WheelEvent as ReactWheelEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { ChatMessage } from "@/lib/schemas/chat";

const SCROLL_THRESHOLD = 80;
const SCROLL_DIRECTION_EPSILON = 1;

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
  handleScroll: (event?: UIEvent<HTMLDivElement>) => void;
  handleWheelCapture: (event: ReactWheelEvent<HTMLDivElement>) => void;
  handleTouchStartCapture: (event: ReactTouchEvent<HTMLDivElement>) => void;
  handleTouchMoveCapture: (event: ReactTouchEvent<HTMLDivElement>) => void;
  scrollToLatest: (behavior?: ScrollBehavior) => void;
};

type ScrollIntent = "up" | "down";

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
  const isAutoScrollPausedByUserRef = useRef(false);
  const scrollIntentRef = useRef<ScrollIntent | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const lastScrollTopRef = useRef(0);
  const lastTouchYRef = useRef<number | null>(null);

  const getOverlayViewport = useCallback((root?: HTMLElement | null) => {
    if (!root) {
      return null;
    }

    if (
      root instanceof HTMLDivElement &&
      root.hasAttribute("data-overlayscrollbars-viewport")
    ) {
      return root;
    }

    return root.querySelector<HTMLDivElement>(
      "[data-overlayscrollbars-viewport]",
    );
  }, []);

  const getScrollElement = useCallback((event?: UIEvent<HTMLDivElement>) => {
    const eventTarget = event?.target;

    if (eventTarget instanceof HTMLElement) {
      const viewport = eventTarget.closest("[data-overlayscrollbars-viewport]");

      if (viewport instanceof HTMLDivElement) {
        return viewport;
      }
    }

    return (
      getOverlayViewport(event?.currentTarget) ?? scrollContainerRef.current
    );
  }, [getOverlayViewport]);

  const pauseAutoScroll = useCallback((container?: HTMLDivElement | null) => {
    isAutoScrollPausedByUserRef.current = true;
    shouldStickToBottomRef.current = false;
    setShowJumpToLatest(true);

    if (container) {
      // OverlayScrollbars 的 viewport 承担真实滚动位置。
      // 用户上滑后立即写回当前 scrollTop，可以打断上一轮 scrollIntoView 的 smooth 动画。
      container.scrollTo({
        top: container.scrollTop,
        behavior: "auto",
      });
      lastScrollTopRef.current = container.scrollTop;
    }
  }, []);

  const resumeAutoScrollIfAtBottom = useCallback((container: HTMLDivElement) => {
    if (!isNearBottom(container)) {
      return;
    }

    isAutoScrollPausedByUserRef.current = false;
    shouldStickToBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    isAutoScrollPausedByUserRef.current = false;
    scrollIntentRef.current = null;
    messageEndRef.current?.scrollIntoView({ behavior, block: "end" });
    shouldStickToBottomRef.current = true;
    setShowJumpToLatest(false);
  }, []);

  const handleScroll = useCallback((event?: UIEvent<HTMLDivElement>) => {
    const container = getScrollElement(event);

    if (!container) {
      return;
    }

    const nearBottom = isNearBottom(container);
    const isScrollingUp =
      container.scrollTop < lastScrollTopRef.current - SCROLL_DIRECTION_EPSILON;

    if (isScrollingUp) {
      pauseAutoScroll(container);
    } else if (
      isAutoScrollPausedByUserRef.current &&
      scrollIntentRef.current === "down"
    ) {
      resumeAutoScrollIfAtBottom(container);
    } else if (nearBottom && !isAutoScrollPausedByUserRef.current) {
      shouldStickToBottomRef.current = true;
    }

    lastScrollTopRef.current = container.scrollTop;
    setShowJumpToLatest(isAutoScrollPausedByUserRef.current || !nearBottom);
  }, [getScrollElement, pauseAutoScroll, resumeAutoScrollIfAtBottom]);

  const handleWheelCapture = useCallback((
    event: ReactWheelEvent<HTMLDivElement>,
  ) => {
    if (event.deltaY < 0) {
      scrollIntentRef.current = "up";
      pauseAutoScroll(getOverlayViewport(event.currentTarget));
      return;
    }

    if (event.deltaY > 0) {
      scrollIntentRef.current = "down";
    }
  }, [getOverlayViewport, pauseAutoScroll]);

  const handleTouchStartCapture = useCallback((
    event: ReactTouchEvent<HTMLDivElement>,
  ) => {
    lastTouchYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchMoveCapture = useCallback((
    event: ReactTouchEvent<HTMLDivElement>,
  ) => {
    const currentTouchY = event.touches[0]?.clientY;
    const previousTouchY = lastTouchYRef.current;

    if (currentTouchY === undefined || previousTouchY === null) {
      return;
    }

    if (currentTouchY > previousTouchY + SCROLL_DIRECTION_EPSILON) {
      scrollIntentRef.current = "up";
      pauseAutoScroll(getOverlayViewport(event.currentTarget));
    } else if (currentTouchY < previousTouchY - SCROLL_DIRECTION_EPSILON) {
      scrollIntentRef.current = "down";
    }

    lastTouchYRef.current = currentTouchY;
  }, [getOverlayViewport, pauseAutoScroll]);

  // 管理消息流的自动吸底行为。
  // 当前实现会在 messages 变化后判断是否仍应吸底，并根据“是否是新消息”决定 smooth 还是 auto 滚动。
  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    if (messages.length === 0) {
      isAutoScrollPausedByUserRef.current = false;
      shouldStickToBottomRef.current = true;
      window.requestAnimationFrame(() => {
        setShowJumpToLatest(false);
      });
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const latestMessageId = latestMessage?.id ?? null;

    if (shouldStickToBottomRef.current) {
      // 新消息到来时用 smooth，同一条消息重渲染时也保持 smooth，避免流式更新把用户生硬拽到底。
      messageEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
      lastScrollTopRef.current = container.scrollTop;
    } else {
      window.requestAnimationFrame(() => {
        setShowJumpToLatest(true);
      });
    }

    lastMessageIdRef.current = latestMessageId;
  }, [messages]);

  return {
    messageEndRef,
    scrollContainerRef,
    showJumpToLatest,
    handleScroll,
    handleWheelCapture,
    handleTouchStartCapture,
    handleTouchMoveCapture,
    scrollToLatest,
  };
}
