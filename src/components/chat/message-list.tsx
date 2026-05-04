import {
  memo,
  RefObject,
  TouchEvent as ReactTouchEvent,
  UIEvent,
  useEffect,
  useState,
  WheelEvent as ReactWheelEvent,
} from "react";
import { motion } from "motion/react";
import {
  ArrowDownIcon,
  LoaderCircleIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatMessage, MessageAttachment } from "@/lib/schemas/chat";
import type { EditMessageUpdate } from "./message-bubble";
import { MessageBubble } from "./message-bubble";
import { smoothEase } from "./motion-presets";

type MessageListProps = {
  messages: ChatMessage[];
  messageEndRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  loadingHint?: string | null;
  actionsDisabled?: boolean;
  supportsImages: boolean;
  supportsFiles: boolean;
  isUploadingAttachments?: boolean;
  onCopyMessage: (message: ChatMessage) => Promise<void> | void;
  onEditMessage: (message: ChatMessage, update: EditMessageUpdate) => Promise<void>;
  onUploadAttachments: (files: File[]) => Promise<MessageAttachment[]>;
  onBranchFromMessage: (message: ChatMessage) => Promise<void>;
  onRegenerateMessage: (message: ChatMessage) => Promise<void>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  onWheelCapture: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onTouchStartCapture: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onTouchMoveCapture: (event: ReactTouchEvent<HTMLDivElement>) => void;
  onJumpToLatest: () => void;
  showJumpToLatest: boolean;
};

function getLatestAssistantMessageId(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "assistant") {
      return messages[index].id;
    }
  }

  return null;
}

/**
 * MessageList 负责两种界面态：
 * 1. 空会话欢迎页
 * 2. 已有消息时的滚动消息流
 */
function MessageListComponent({
  messages,
  messageEndRef,
  scrollContainerRef,
  loadingHint = null,
  actionsDisabled = false,
  supportsImages,
  supportsFiles,
  isUploadingAttachments = false,
  onCopyMessage,
  onEditMessage,
  onUploadAttachments,
  onBranchFromMessage,
  onRegenerateMessage,
  onScroll,
  onWheelCapture,
  onTouchStartCapture,
  onTouchMoveCapture,
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

  // 管理空会话欢迎标题的逐字动画。
  // 当前实现只在 messages 为空时启动定时器，逐步把 emptyTitle 切片写入 typedTitle。
  useEffect(() => {
    if (messages.length > 0) {
      return;
    }

    // 欢迎标题通过逐字追加营造轻量输入感。
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
  const latestAssistantMessageId = getLatestAssistantMessageId(messages);

  return (
    <div className="relative min-h-0 flex-1">
      <ScrollArea
        ref={scrollContainerRef}
        className="h-full px-2 sm:px-3"
        onScroll={onScroll}
        onWheelCapture={onWheelCapture}
        onTouchStartCapture={onTouchStartCapture}
        onTouchMoveCapture={onTouchMoveCapture}
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
                      animate={{ opacity: [0.28, 1, 0.28] }}
                      transition={{
                        duration: 1.25,
                        repeat: Infinity,
                        ease: smoothEase,
                      }}
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
              <MessageBubble
                key={message.id}
                message={message}
                actionsDisabled={actionsDisabled}
                canRegenerate={message.id === latestAssistantMessageId}
                supportsImages={supportsImages}
                supportsFiles={supportsFiles}
                isUploadingAttachments={isUploadingAttachments}
                onCopy={onCopyMessage}
                onEdit={onEditMessage}
                onUploadAttachments={onUploadAttachments}
                onBranch={onBranchFromMessage}
                onRegenerate={onRegenerateMessage}
              />
            ))}
            <div ref={messageEndRef} />
          </div>
        )}
      </ScrollArea>

      {showJumpToLatest ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center">
          <motion.button
            className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-full border border-slate-200/80 bg-white/96 text-slate-600 shadow-[0_16px_34px_rgba(35,55,92,0.16)] backdrop-blur-md transition-colors hover:bg-white hover:text-slate-900"
            type="button"
            onClick={onJumpToLatest}
            aria-label="跳转到底部"
            initial={{ opacity: 0, y: 8, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18, ease: smoothEase }}
          >
            <ArrowDownIcon className="size-4" />
          </motion.button>
        </div>
      ) : null}
    </div>
  );
}

export const MessageList = memo(MessageListComponent);
