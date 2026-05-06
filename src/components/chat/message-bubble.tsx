import { startTransition, useEffect, useRef, useState } from "react";
import { ChatMessage, MessageAttachment } from "@/lib/schemas/chat";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CopyIcon,
  GitBranchIcon,
  LoaderCircleIcon,
  PencilIcon,
  RefreshCwIcon,
  UserIcon,
  XIcon,
  PaperclipIcon,
  LightbulbIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MarkdownMessage } from "./markdown-message";
import {
  AttachmentEditorDialog,
  AttachmentPreviewList,
} from "./message-attachments";
import { MessageUrlContextSummary } from "./message-url-context";
import { softSpring, smoothEase } from "./motion-presets";

export type EditMessageUpdate = {
  content: string;
  urls?: string[];
  attachments?: MessageAttachment[];
};

type MessageBubbleProps = {
  message: ChatMessage;
  actionsDisabled?: boolean;
  canRegenerate?: boolean;
  supportsImages: boolean;
  supportsFiles: boolean;
  isUploadingAttachments?: boolean;
  onCopy: (message: ChatMessage) => Promise<void> | void;
  onEdit: (message: ChatMessage, update: EditMessageUpdate) => Promise<void>;
  onUploadAttachments: (files: File[]) => Promise<MessageAttachment[]>;
  onBranch: (message: ChatMessage) => Promise<void>;
  onRegenerate: (message: ChatMessage) => Promise<void>;
};

const EMPTY_METADATA_URLS: string[] = [];

const roleLabelMap = {
  assistant: "Assistant",
  user: "You",
  system: "System",
  error: "Error",
} as const;

function isCjkCharacter(character: string) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
    character,
  );
}

function isWordCharacter(character: string) {
  return /[A-Za-z0-9]/.test(character);
}

function splitStreamingUnits(text: string) {
  const characters = Array.from(text);
  const units: string[] = [];
  let index = 0;

  while (index < characters.length) {
    const character = characters[index];

    if (character === "\r") {
      index += 1;
      continue;
    }

    if (character === "\n") {
      units.push("\n");
      index += 1;
      continue;
    }

    if (character === " " || character === "\t") {
      let end = index + 1;

      while (
        end < characters.length &&
        (characters[end] === " " || characters[end] === "\t")
      ) {
        end += 1;
      }

      units.push(characters.slice(index, end).join(""));
      index = end;
      continue;
    }

    if (isCjkCharacter(character)) {
      // 中文等 CJK 文本按单字揭示，读起来更接近真实输入节奏。
      units.push(character);
      index += 1;
      continue;
    }

    if (isWordCharacter(character)) {
      let end = index + 1;

      while (
        end < characters.length &&
        isWordCharacter(characters[end]) &&
          end - index < 3
      ) {
        end += 1;
      }

      // 英文按很短的词片段揭示，避免长单词一次性跳出造成闪动。
      units.push(characters.slice(index, end).join(""));
      index = end;
      continue;
    }

    units.push(character);
    index += 1;
  }

  return units;
}

function getQueuedContent(baseContent: string, queuedUnits: string[]) {
  return baseContent + queuedUnits.join("");
}

function getRevealBatchSize(backlog: number) {
  // 队列积压越多，单次揭示越大；这样长回复能追上真实模型输出速度。
  if (backlog > 160) {
    return 12;
  }

  if (backlog > 96) {
    return 8;
  }

  if (backlog > 48) {
    return 4;
  }

  return 1;
}

function getRevealDelay(backlog: number) {
  if (backlog > 160) {
    return 0;
  }

  if (backlog > 96) {
    return 8;
  }

  if (backlog > 48) {
    return 14;
  }

  return 22;
}

function StreamingMarkdownMessage({
  content,
  isStreaming,
  shouldReduceMotion,
  className,
}: {
  content: string;
  isStreaming: boolean;
  shouldReduceMotion: boolean;
  className?: string;
}) {
  const [displayContent, setDisplayContent] = useState(content);
  const [isFreshReveal, setIsFreshReveal] = useState(false);
  const queuedUnitsRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);
  const revealGlowTimerRef = useRef<number | null>(null);
  const displayContentRef = useRef(content);

  useEffect(() => {
    displayContentRef.current = displayContent;
  }, [displayContent]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (revealGlowTimerRef.current !== null) {
        window.clearTimeout(revealGlowTimerRef.current);
        revealGlowTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (shouldReduceMotion) {
      // reduced motion 模式下不做逐字动画，直接同步完整内容。
      queuedUnitsRef.current = [];
      displayContentRef.current = content;

      startTransition(() => {
        setDisplayContent(content);
      });

      return;
    }

    const queuedContent = getQueuedContent(
      displayContentRef.current,
      queuedUnitsRef.current,
    );

    if (content === queuedContent) {
      return;
    }

    if (!content.startsWith(queuedContent)) {
      // 内容不是单调增长时，通常表示重新生成、错误恢复或服务端回写了完整快照。
      // 这时不能继续消费旧队列，必须直接重置显示内容。
      queuedUnitsRef.current = [];
      displayContentRef.current = content;

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        startTransition(() => {
          setDisplayContent(content);
        });
        timerRef.current = null;
      }, 0);
      return;
    }

    const appendedText = content.slice(queuedContent.length);

    if (!appendedText) {
      return;
    }

    queuedUnitsRef.current.push(...splitStreamingUnits(appendedText));

    if (timerRef.current !== null) {
      return;
    }

    const flushQueue = () => {
      const backlog = queuedUnitsRef.current.length;

      if (backlog === 0) {
        timerRef.current = null;
        return;
      }

      const batchSize = getRevealBatchSize(backlog);
      const nextChunk = queuedUnitsRef.current.splice(0, batchSize).join("");

      // startTransition 把 Markdown 重渲染标记为非紧急更新，
      // 避免长回复流式输出时卡住输入和滚动。
      startTransition(() => {
        setDisplayContent((current) => {
          const nextContent = current + nextChunk;
          displayContentRef.current = nextContent;
          return nextContent;
        });
      });
      setIsFreshReveal(true);

      if (revealGlowTimerRef.current !== null) {
        window.clearTimeout(revealGlowTimerRef.current);
      }

      revealGlowTimerRef.current = window.setTimeout(() => {
        setIsFreshReveal(false);
        revealGlowTimerRef.current = null;
      }, 120);

      timerRef.current = window.setTimeout(
        flushQueue,
        getRevealDelay(queuedUnitsRef.current.length),
      );
    };

    flushQueue();

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, shouldReduceMotion]);

  const showCursor = isStreaming || displayContent !== content;

  return (
    <div>
      <motion.div
        animate={
          shouldReduceMotion
            ? undefined
            : isFreshReveal
              ? {
                  opacity: [0.965, 1],
                  filter: ["blur(0.6px)", "blur(0px)"],
                  y: [1, 0],
                }
              : {
                  opacity: 1,
                  filter: "blur(0px)",
                  y: 0,
                }
        }
        transition={{
          duration: shouldReduceMotion ? 0 : 0.16,
          ease: smoothEase,
        }}
      >
        <MarkdownMessage content={displayContent} className={className} />
      </motion.div>
      {showCursor ? (
        <motion.span
          className="mt-2 inline-block h-[1.05em] w-0.5 rounded-full bg-sky-500/70 align-[-0.15em]"
          animate={
            shouldReduceMotion
              ? undefined
              : { opacity: [0.2, 1, 0.2] }
          }
          transition={
            shouldReduceMotion
              ? undefined
              : { duration: 1.05, repeat: Infinity, ease: "easeInOut" }
          }
        />
      ) : null}
    </div>
  );
}

function ThinkingSummary({
  thinking,
  isStreaming,
}: {
  thinking: NonNullable<ChatMessage["metadata"]["thinking"]>;
  isStreaming: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const title =
    thinking.status === "cancelled"
      ? "已停止"
      : thinking.status === "error"
        ? "思考失败"
        : thinking.status === "streaming" || isStreaming
          ? "思考中"
          : "已思考";

  return (
    <motion.div
      layout
      className="mb-2.5 max-w-[min(100%,44rem)] overflow-hidden rounded-[10px] border border-slate-200/80 bg-slate-50/55 text-slate-500"
      transition={{ duration: 0.22, ease: smoothEase }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[0.78rem] leading-none hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <LightbulbIcon className="size-3.5 shrink-0" />
          <span className="text-[0.78rem]">{title}</span>
          <span className="text-[0.78rem] text-slate-400">
            {thinking.level}
          </span>
        </span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key="thinking-content"
            layout
            className="border-t border-slate-200/70 px-3 py-2 text-[0.78rem] leading-6 text-slate-500"
            initial={{ height: 0, opacity: 0, y: -3 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -3 }}
            transition={{ duration: 0.22, ease: smoothEase }}
          >
            <motion.div
              key={thinking.content.length}
              className="whitespace-pre-wrap break-words"
              initial={{ opacity: 0.58, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: smoothEase }}
            >
              {thinking.content}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * MessageBubble 只关心单条消息的视觉语义：
 * 谁发的、是否报错、是否仍在生成，最终都映射成统一气泡样式。
 */
export function MessageBubble({
  message,
  actionsDisabled = false,
  canRegenerate: canRegenerateMessage = false,
  supportsImages,
  supportsFiles,
  isUploadingAttachments = false,
  onCopy,
  onEdit,
  onUploadAttachments,
  onBranch,
  onRegenerate,
}: MessageBubbleProps) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const [editUrls, setEditUrls] = useState(message.metadata.urls ?? []);
  const [editAttachments, setEditAttachments] = useState(
    message.metadata.attachments ?? [],
  );
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isBranching, setIsBranching] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const isAssistantLike =
    message.role === "assistant" || message.role === "system";
  const isUser = message.role === "user";
  const isError = message.role === "error";
  const isStreaming = message.status === "streaming";
  const messageMetadataUrls = message.metadata.urls;
  const metadataUrls = messageMetadataUrls ?? EMPTY_METADATA_URLS;
  const metadataAttachments = message.metadata.attachments ?? [];
  const thinking = message.metadata.thinking;
  const showCancelledMarker =
    !isEditing && message.role === "assistant" && message.status === "cancelled";
  const isActionLocked =
    actionsDisabled ||
    message.status === "pending" ||
    message.status === "streaming";
  const canCopy = !isActionLocked && message.content.trim().length > 0;
  const canEdit = isUser && !isActionLocked;
  const canBranch =
    message.role === "assistant" &&
    !isActionLocked &&
    message.content.trim().length > 0;
  const showRegenerate = message.role === "assistant";
  const canRegenerate =
    showRegenerate &&
    canRegenerateMessage &&
    !isActionLocked;
  const regenerateTitle = canRegenerate
    ? "重新生成"
    : !canRegenerateMessage
      ? "仅最新对话可重新生成"
      : "消息生成完成后可重新生成";
  const statusLabel =
    message.status === "pending"
      ? "等待中"
      : message.status === "streaming"
        ? "生成中"
        : message.status === "cancelled"
          ? "已停止"
      : message.status === "error"
        ? "失败"
        : null;

  useEffect(() => {
    if (!isEditing) {
      setEditValue(message.content);
      setEditUrls(messageMetadataUrls ?? []);
      setEditAttachments(message.metadata.attachments ?? []);
    }
  }, [isEditing, message.content, messageMetadataUrls, message.metadata.attachments]);

  const handleCopy = async () => {
    if (!canCopy) {
      return;
    }

    await onCopy(message);
    setCopiedMessageId(message.id);
    window.setTimeout(() => {
      setCopiedMessageId((current) => (current === message.id ? null : current));
    }, 1300);
  };

  const handleStartEdit = () => {
    setEditValue(message.content);
    setEditUrls(message.metadata.urls ?? []);
    setEditAttachments(message.metadata.attachments ?? []);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditValue(message.content);
    setEditUrls(message.metadata.urls ?? []);
    setEditAttachments(message.metadata.attachments ?? []);
  };

  const handleSaveEdit = async () => {
    const trimmedValue = editValue.trim();
    const nextUrls = editUrls;

    if (
      !canEdit ||
      (
        trimmedValue.length === 0 &&
        editUrls.length === 0 &&
        editAttachments.length === 0
      )
    ) {
      return;
    }

    setIsSubmittingEdit(true);

    try {
      const editPromise = onEdit(message, {
        content: trimmedValue,
        urls: nextUrls,
        attachments: editAttachments,
      });

      setIsEditing(false);

      await editPromise;
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleBranch = async () => {
    if (!canBranch) {
      return;
    }

    setIsBranching(true);

    try {
      await onBranch(message);
    } finally {
      setIsBranching(false);
    }
  };

  const handleRegenerate = async () => {
    if (!canRegenerate) {
      return;
    }

    setIsRegenerating(true);

    try {
      await onRegenerate(message);
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <motion.article
      className={cn(
        "group/message flex max-w-[min(100%,52rem)] flex-col gap-1",
        isUser ? "self-end" : "self-start",
      )}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={shouldReduceMotion ? { duration: 0 } : softSpring}
    >
      <div
        className={cn(
          "inline-flex items-center gap-2 text-[0.72rem] font-medium tracking-[0.16em] text-muted-foreground uppercase",
          isUser && "self-end",
        )}
      >
        {isAssistantLike ? (
          <BotIcon className="size-3.5" />
        ) : isUser ? (
          <UserIcon className="size-3.5" />
        ) : (
          <CircleAlertIcon className="size-3.5" />
        )}
        <span>{roleLabelMap[message.role]}</span>
        {statusLabel ? (
          <Badge
            variant={message.status === "error" ? "destructive" : "secondary"}
            className="rounded-[10px] px-2 py-0.5 text-[0.68rem] tracking-normal"
          >
            {statusLabel}
          </Badge>
        ) : null}
      </div>
      <div
        className={cn(
          "px-4",
          isAssistantLike &&
            "rounded-[14px] border border-transparent bg-transparent py-3 shadow-none sm:px-1 sm:py-2",
          isUser &&
            "rounded-[16px] border border-blue-100/85 bg-blue-50/82 py-2.5 shadow-[0_10px_20px_rgba(54,88,143,0.05)]",
          isError &&
            "rounded-[16px] border border-red-200/90 bg-red-50/90 py-3 text-red-700 shadow-[0_10px_20px_rgba(172,60,60,0.07)]",
        )}
      >
        {!isEditing && message.role === "assistant" && thinking?.content ? (
          <ThinkingSummary
            thinking={thinking}
            isStreaming={isStreaming}
          />
        ) : null}
        {isEditing ? (
          <div className="w-[min(72vw,32rem)] space-y-2">
            <Textarea
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              className="max-h-72 min-h-28 resize-y rounded-[12px] border-blue-100/90 bg-white/72 px-3 py-2 text-[0.95rem] leading-7 shadow-none"
              disabled={isSubmittingEdit}
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-fit rounded-[9px] border-blue-100/85 bg-white/70 px-3 text-[0.82rem] text-slate-600 shadow-none"
              onClick={() => setIsAttachmentDialogOpen(true)}
              disabled={isSubmittingEdit}
            >
              <PaperclipIcon className="size-3.5" />
              修改附加项
              {editUrls.length + editAttachments.length > 0
                ? ` · ${editUrls.length + editAttachments.length}`
                : ""}
            </Button>
            {editUrls.length > 0 ? (
              <MessageUrlContextSummary
                urls={editUrls}
                className="pt-1"
              />
            ) : null}
            <AttachmentPreviewList
              attachments={editAttachments}
              className="pt-1"
            />
            <div className="flex justify-end gap-2">
              <Tooltip content="取消">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="h-8 w-12 rounded-[9px] border-blue-100/85 bg-white/70 text-slate-500 shadow-none hover:bg-white hover:text-slate-800"
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSubmittingEdit}
                  aria-label="取消编辑"
                >
                  <XIcon className="size-3.5" />
                </Button>
              </Tooltip>
              <Tooltip content="保存">
                <Button
                  size="icon-sm"
                  className="h-8 w-12 rounded-[9px] shadow-none"
                  type="button"
                  onClick={() => void handleSaveEdit()}
                  disabled={
                    isSubmittingEdit ||
                    (
                      editValue.trim().length === 0 &&
                      editUrls.length === 0 &&
                      editAttachments.length === 0
                    )
                  }
                  aria-label="保存编辑"
                >
                  {isSubmittingEdit ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" />
                  ) : (
                    <CheckIcon className="size-3.5" />
                  )}
                </Button>
              </Tooltip>
            </div>
          </div>
        ) : (message.status === "pending" || message.status === "streaming") &&
        message.content.length === 0 ? (
          // assistant 占位气泡在真正文本返回前只展示加载态。
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            {message.status === "pending" ? "正在思考" : "生成中"}
          </span>
        ) : message.status === "cancelled" && message.content.length === 0 ? (
          null
        ) : isStreaming && message.role === "assistant" ? (
          <StreamingMarkdownMessage
            content={message.content}
            isStreaming={isStreaming}
            shouldReduceMotion={shouldReduceMotion}
            className="markdown--chat"
          />
        ) : (
          <MarkdownMessage
            content={message.content}
            className={isUser ? "markdown--compact" : "markdown--chat"}
          />
        )}
        {showCancelledMarker ? (
          <div className="mt-3 max-w-[min(100%,40rem)] border-t border-slate-200/75 pt-2 text-[0.8rem] leading-none text-slate-400">
            已停止
          </div>
        ) : null}
        {!isEditing && isUser && metadataUrls.length > 0 ? (
          <MessageUrlContextSummary
            urls={metadataUrls}
            className="mt-2.5 border-t border-blue-100/80 pt-2"
          />
        ) : null}
        {!isEditing && isUser && metadataAttachments.length > 0 ? (
          <AttachmentPreviewList
            attachments={metadataAttachments}
            className="mt-2.5 border-t border-blue-100/80 pt-2.5"
          />
        ) : null}
      </div>
      <AttachmentEditorDialog
        open={isAttachmentDialogOpen}
        title="修改附加项"
        urls={editUrls}
        attachments={editAttachments}
        disabled={isSubmittingEdit}
        supportsFiles={supportsFiles}
        supportsImages={supportsImages}
        isUploading={isUploadingAttachments}
        onOpenChange={setIsAttachmentDialogOpen}
        onUrlsChange={setEditUrls}
        onAttachmentsChange={setEditAttachments}
        onUploadFiles={onUploadAttachments}
      />
      {canCopy || canEdit || canBranch || showRegenerate ? (
        <div
          className={cn(
            "flex h-6 items-center gap-0.5 opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100",
            isUser ? "justify-end pr-1" : "justify-start pl-1",
          )}
        >
          {canCopy ? (
            <Tooltip content={copiedMessageId === message.id ? "已复制" : "复制"}>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 rounded-[8px] text-slate-400 hover:bg-transparent hover:text-slate-700"
                type="button"
                onClick={() => void handleCopy()}
                aria-label="复制"
              >
                {copiedMessageId === message.id ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <CopyIcon className="size-3.5" />
                )}
              </Button>
            </Tooltip>
          ) : null}
          {canEdit ? (
            <Tooltip content="编辑并重新生成">
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 rounded-[8px] text-slate-400 hover:bg-transparent hover:text-slate-700"
                type="button"
                onClick={handleStartEdit}
                aria-label="编辑消息"
              >
                <PencilIcon className="size-3.5" />
              </Button>
            </Tooltip>
          ) : null}
          {canBranch ? (
            <Tooltip content="分支">
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 rounded-[8px] text-slate-400 hover:bg-transparent hover:text-slate-700"
                type="button"
                onClick={() => void handleBranch()}
                disabled={isBranching}
                aria-label="分支"
              >
                {isBranching ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin" />
                ) : (
                  <GitBranchIcon className="size-3.5" />
                )}
              </Button>
            </Tooltip>
          ) : null}
          {showRegenerate ? (
            <Tooltip content={regenerateTitle}>
              <span className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 rounded-[8px] text-slate-400 hover:bg-transparent hover:text-slate-700"
                  type="button"
                  onClick={() => void handleRegenerate()}
                  disabled={!canRegenerate || isRegenerating}
                  aria-label="重新生成"
                >
                  {isRegenerating ? (
                    <LoaderCircleIcon className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCwIcon className="size-3.5" />
                  )}
                </Button>
              </span>
            </Tooltip>
          ) : null}
        </div>
      ) : null}
    </motion.article>
  );
}
