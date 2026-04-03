import { RefObject, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDownIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { ChatMessage } from "@/lib/schemas/chat";
import { MessageBubble } from "./message-bubble";

type MessageListProps = {
  messages: ChatMessage[];
  messageEndRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  loadingHint?: string | null;
  onScroll: () => void;
  onJumpToLatest: () => void;
  showJumpToLatest: boolean;
};

export function MessageList({
  messages,
  messageEndRef,
  scrollContainerRef,
  loadingHint = null,
  onScroll,
  onJumpToLatest,
  showJumpToLatest,
}: MessageListProps) {
  const emptyTitleCandidates = [
    "想聊些什么？",
    "今天想从哪里开始？",
    "欢迎回来",
    "有什么想法？",
    "来吧,随便开个话头",
    "这一刻,想聊点什么？",
    "我一直在这里"
  ];
  const [emptyTitle] = useState(
    () =>
      emptyTitleCandidates[
        Math.floor(Math.random() * emptyTitleCandidates.length)
      ],
  );
  const [typedTitle, setTypedTitle] = useState("");

  useEffect(() => {
    if (messages.length > 0) {
      return;
    }

    const resetTimer = window.setTimeout(() => {
      setTypedTitle("");
    }, 0);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedTitle(emptyTitle.slice(0, index));

      if (index >= emptyTitle.length) {
        window.clearInterval(timer);
      }
    }, 130);

    return () => {
      window.clearTimeout(resetTimer);
      window.clearInterval(timer);
    };
  }, [emptyTitle, messages.length]);

  const showTypingCursor = messages.length === 0;

  return (
    <div
      ref={scrollContainerRef}
      className="relative flex-1 overflow-y-auto px-2 sm:px-3"
      onScroll={onScroll}
    >
      {messages.length === 0 ? (
        <motion.div
          className="flex min-h-full justify-center px-2 pt-[8vh] pb-10 sm:pt-[10vh]"
          initial={false}
        >
          <div className="w-full max-w-4xl px-2">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-pretty text-[2.8rem] font-semibold tracking-[0.05em] text-foreground [font-family:'Source_Han_Serif_SC','Noto_Serif_SC','Songti_SC','STSong',serif] sm:text-[3.75rem]">
                {typedTitle}
                {showTypingCursor ? (
                  <motion.span
                    className="ml-[0.2em] inline-block text-foreground/70"
                    animate={{ opacity: [1, 1, 0, 0] }}
                    transition={{ duration:2, repeat: Infinity, times: [0, 0.5, 0.51, 1], ease: "linear" }}
                  >
                    _
                  </motion.span>
                ) : null}
              </h1>
              {loadingHint ? (
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground/75">
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                  {loadingHint}
                </p>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-7 px-1 pt-8 pb-10 sm:px-3 sm:pt-10 sm:pb-12">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messageEndRef} />
          {showJumpToLatest ? (
            <button
              className="sticky bottom-4 mx-auto inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-[0_18px_32px_rgba(33,43,61,0.18)]"
              type="button"
              onClick={onJumpToLatest}
            >
              <ArrowDownIcon className="size-4" />
              最新
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
