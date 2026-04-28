"use client";

import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowUpIcon,
  GlobeIcon,
  Link2Icon,
  LoaderCircleIcon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MessageAttachment } from "@/lib/schemas/chat";
import { panelSpring, smoothEase } from "./motion-presets";
import type { AddUrlContextResult } from "./use-chat-session";
import {
  AttachmentEditorDialog,
  AttachmentPreviewList,
  getAttachmentFileValidationError,
} from "./message-attachments";

const MotionTextarea = motion.create(Textarea);

type ChatInputProps = {
  webSearchEnabled: boolean;
  urlContextInputValue: string;
  urlContextUrls: string[];
  attachments: MessageAttachment[];
  isUrlContextPanelOpen: boolean;
  supportsWebSearch: boolean;
  supportsUrlContext: boolean;
  supportsImages: boolean;
  supportsFiles: boolean;
  isUploadingAttachments: boolean;
  onToggleWebSearch: () => void | Promise<void>;
  onUrlContextInputChange: (value: string) => void;
  onUrlContextUrlsChange: (urls: string[]) => void;
  onAttachmentsChange: Dispatch<SetStateAction<MessageAttachment[]>>;
  onToggleUrlContextPanel: () => void;
  onAddUrlContextUrl: () => AddUrlContextResult;
  onRemoveUrlContextUrl: (url: string) => void;
  onUploadAttachments: (files: File[]) => Promise<MessageAttachment[]>;
  onSubmit: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  onStop: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
};

export function ChatInput({
  webSearchEnabled,
  urlContextInputValue,
  urlContextUrls,
  attachments,
  isUrlContextPanelOpen,
  supportsWebSearch,
  supportsUrlContext,
  supportsImages,
  supportsFiles,
  isUploadingAttachments,
  onToggleWebSearch,
  onUrlContextInputChange,
  onUrlContextUrlsChange,
  onAttachmentsChange,
  onToggleUrlContextPanel,
  onAddUrlContextUrl,
  onRemoveUrlContextUrl,
  onUploadAttachments,
  onSubmit,
  onStop,
  isSubmitting,
  disabled = false,
}: ChatInputProps) {
  const shouldReduceMotion = Boolean(useReducedMotion());
  const [draftValue, setDraftValue] = useState("");
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [textareaHeight, setTextareaHeight] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const urlLimitWarningTimeoutRef = useRef<number | null>(null);
  const canSend =
    (draftValue.trim().length > 0 || attachments.length > 0) &&
    !isSubmitting &&
    !disabled;
  const canStop = isSubmitting && !disabled;
  const hasUrlContext = urlContextUrls.length > 0;
  const hasAttachments = attachments.length > 0;
  const canToggleWebSearch = !disabled && !isSubmitting;
  const canToggleUrlContext = !disabled && !isSubmitting;
  const [isUrlLimitWarningVisible, setIsUrlLimitWarningVisible] = useState(false);
  const urlContextHint = isUrlLimitWarningVisible
    ? "至多输入4条URL"
      : supportsUrlContext
        ? "Gemini将检索输入的URL"
        : "当前模型暂不支持 URL Context";
  const webSearchTooltip = "联网";
  const urlContextTooltip = "添加URL";
  const attachmentTooltip = "修改附加项";

  const showUrlLimitWarning = () => {
    setIsUrlLimitWarningVisible(true);

    if (urlLimitWarningTimeoutRef.current !== null) {
      window.clearTimeout(urlLimitWarningTimeoutRef.current);
    }

    urlLimitWarningTimeoutRef.current = window.setTimeout(() => {
      setIsUrlLimitWarningVisible(false);
      urlLimitWarningTimeoutRef.current = null;
    }, 1500);
  };

  const handleAddUrlContext = () => {
    const result = onAddUrlContextUrl();

    if (result === "limit") {
      showUrlLimitWarning();
    }
  };

  const handleSubmitDraft = async () => {
    const submittedValue = draftValue;

    if (
      (submittedValue.trim().length === 0 && attachments.length === 0) ||
      isSubmitting ||
      disabled
    ) {
      return;
    }

    setDraftValue("");

    try {
      await onSubmit(submittedValue, attachments);
    } catch {
      setDraftValue(submittedValue);
    }
  };

  const handleUploadFiles = async (files: File[]) => {
    const uploaded = await onUploadAttachments(files);
    return uploaded;
  };

  const handleInlineUploadFiles = (files: File[]) => {
    const validationError = getAttachmentFileValidationError(files, {
      currentAttachmentCount: attachments.length,
      currentAttachmentSizes: attachments.map((attachment) => attachment.size),
      supportsFiles,
      supportsImages,
    });

    if (validationError) {
      setAttachmentError(validationError);
      return;
    }

    void handleUploadFiles(files)
      .then((uploaded) => {
        onAttachmentsChange((current) => [...current, ...uploaded]);
        setAttachmentError(null);
      })
      .catch((uploadError) => {
        setAttachmentError(
          uploadError instanceof Error
            ? uploadError.message
            : "附件上传失败，请稍后再试。",
        );
      });
  };

  // 管理输入框高度自适应：只测量目标高度，实际高度交给 Motion 驱动。
  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const previousHeight = textarea.style.height;
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 224);
    textarea.style.height = previousHeight;
    setTextareaHeight(nextHeight);
  }, [draftValue]);

  // 管理发送完成后的焦点回归。
  // 当前实现是在 isSubmitting 重新变回 false 时，把光标焦点放回输入框。
  useEffect(() => {
    if (!isSubmitting) {
      textareaRef.current?.focus();
    }
  }, [isSubmitting]);

  useEffect(() => {
    return () => {
      if (urlLimitWarningTimeoutRef.current !== null) {
        window.clearTimeout(urlLimitWarningTimeoutRef.current);
      }
    };
  }, []);

  return (
    <motion.div
      className={cn(
        "mx-auto flex w-full flex-col border border-border/90 bg-background/95 backdrop-blur-xl",
        isUrlContextPanelOpen ? "gap-1.5" : "gap-2.5",
        "max-w-4xl rounded-[10px] px-3.5 pt-2 pb-3.5 shadow-[0_28px_38px_rgba(48,82,139,0.1)]",
      )}
      initial={false}
      animate={
        isUrlLimitWarningVisible
          ? {
              borderColor: [
                "rgba(226,232,240,0.9)",
                "rgba(248,113,113,0.7)",
                "rgba(226,232,240,0.9)",
              ],
              boxShadow: [
                "0 28px 38px rgba(48,82,139,0.1)",
                "0 0 0 2px rgba(248,113,113,0.14), 0 28px 38px rgba(48,82,139,0.1)",
                "0 28px 38px rgba(48,82,139,0.1)",
              ],
            }
          : {
              borderColor: "rgba(226,232,240,0.9)",
              boxShadow: "0 28px 38px rgba(48,82,139,0.1)",
            }
      }
      transition={
        shouldReduceMotion
          ? { duration: 0 }
          : {
              duration: 0.55,
              ease: smoothEase,
              layout: { duration: 0.16, ease: smoothEase },
            }
      }
    >
      <AnimatePresence initial={false}>
        {isUrlContextPanelOpen ? (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -4 }}
            transition={shouldReduceMotion ? { duration: 0 } : panelSpring}
          >
            <div className="space-y-1 px-0.5 pb-0.5">
              {hasUrlContext ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
                  {urlContextUrls.map((url) => (
                    <div
                      key={url}
                      className="flex max-w-full items-center gap-1.5 text-[0.72rem] leading-5 text-sky-900"
                      title={url}
                    >
                      <Link2Icon className="size-3 shrink-0 text-sky-500" />
                      <span className="max-w-[32rem] truncate">{url}</span>
                      <button
                        type="button"
                        className="inline-flex size-3.5 shrink-0 items-center justify-center text-sky-400 transition-colors hover:text-sky-700 focus-visible:outline-none"
                        onClick={() => onRemoveUrlContextUrl(url)}
                        aria-label={`移除 URL：${url}`}
                      >
                        <XIcon className="size-2.75" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-2 border-b border-sky-200/80 px-1 pb-1">
                <Input
                  value={urlContextInputValue}
                  onChange={(event) =>
                    onUrlContextInputChange(event.target.value)
                  }
                  placeholder="输入URL"
                  disabled={disabled}
                  className="h-6 rounded-none border-0 bg-transparent px-0 text-[0.72rem] shadow-none placeholder:text-[0.72rem] focus-visible:border-0 focus-visible:ring-0"
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") {
                      return;
                    }

                    event.preventDefault();
                    handleAddUrlContext();
                  }}
                />

                <div
                  className={cn(
                    "shrink-0 text-[0.67rem] leading-none transition-colors",
                    isUrlLimitWarningVisible ? "text-red-500" : "text-slate-500",
                  )}
                >
                  {urlContextHint}
                </div>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className={cn(
          "flex flex-col gap-2",
          isUrlContextPanelOpen && "pt-1",
        )}
      >
        <MotionTextarea
          ref={textareaRef}
          className={cn(
            "max-h-56 resize-none border-0 bg-transparent px-1 py-0 text-[0.98rem] leading-8 shadow-none ring-0 [field-sizing:fixed] focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent",
            "min-h-8 rounded-none",
          )}
          animate={textareaHeight ? { height: textareaHeight } : undefined}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : { duration: 0.2, ease: smoothEase }
          }
          placeholder="随便说些什么..."
          value={draftValue}
          rows={1}
          disabled={disabled}
          onChange={(event) => setDraftValue(event.target.value)}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);

            if (files.length > 0) {
              handleInlineUploadFiles(files);
            }
          }}
          onDrop={(event) => {
            const files = Array.from(event.dataTransfer.files);

            if (files.length === 0) {
              return;
            }

            event.preventDefault();
            handleInlineUploadFiles(files);
          }}
          onDragOver={(event) => {
            if (supportsImages || supportsFiles) {
              event.preventDefault();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !isSubmitting) {
              event.preventDefault();
              void handleSubmitDraft();
            }
          }}
        />

        {hasAttachments ? (
          <AttachmentPreviewList
            attachments={attachments}
            className="px-1 pt-1"
            onRemove={(attachment) =>
              onAttachmentsChange((current) =>
                current.filter((item) => item.id !== attachment.id),
              )
            }
          />
        ) : null}
        {attachmentError ? (
          <p className="px-1 text-xs text-red-500">{attachmentError}</p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tooltip content={webSearchTooltip}>
              <Button
                variant="outline"
                size="icon-sm"
                className={cn(
                  "h-7 w-9 rounded-[8px] border-border/70 bg-background/82 text-muted-foreground shadow-none hover:bg-white/86 hover:text-slate-800",
                  webSearchEnabled &&
                    "border-sky-200/90 bg-sky-50/88 text-sky-700 hover:bg-sky-100/82 hover:text-sky-800",
                  !supportsWebSearch && "opacity-80",
                )}
                type="button"
                onClick={onToggleWebSearch}
                disabled={!canToggleWebSearch}
                aria-label={webSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
              >
                <GlobeIcon className="size-4" />
              </Button>
            </Tooltip>

            <Tooltip content={urlContextTooltip}>
              <Button
                variant="outline"
                size="icon-sm"
                className={cn(
                  "relative h-7 w-9 rounded-[8px] border-border/70 bg-background/82 text-muted-foreground shadow-none hover:bg-white/86 hover:text-slate-800",
                  (isUrlContextPanelOpen || hasUrlContext) &&
                    "border-sky-200/90 bg-sky-50/88 text-sky-700 hover:bg-sky-100/82 hover:text-sky-800",
                  !supportsUrlContext && !hasUrlContext && "opacity-80",
                )}
                type="button"
                onClick={onToggleUrlContextPanel}
                disabled={!canToggleUrlContext}
                aria-label={isUrlContextPanelOpen ? "收起 URL Context" : "展开 URL Context"}
              >
                <Link2Icon className="size-4" />
                <span
                  className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-[7px] bg-sky-600 px-1 text-[0.65rem] font-medium leading-4 text-white shadow-[0_4px_10px_rgba(2,132,199,0.2)]"
                  aria-hidden="true"
                >
                  {urlContextUrls.length}
                </span>
                <span className="sr-only">已添加 {urlContextUrls.length} 条 URL</span>
              </Button>
            </Tooltip>

            <Tooltip content={attachmentTooltip}>
              <Button
                variant="outline"
                size="icon-sm"
                className={cn(
                  "relative h-7 w-9 rounded-[8px] border-border/70 bg-background/82 text-muted-foreground shadow-none hover:bg-white/86 hover:text-slate-800",
                  (isAttachmentDialogOpen || hasAttachments) &&
                    "border-sky-200/90 bg-sky-50/88 text-sky-700 hover:bg-sky-100/82 hover:text-sky-800",
                  !supportsImages && !supportsFiles && "opacity-80",
                )}
                type="button"
                onClick={() => setIsAttachmentDialogOpen(true)}
                disabled={disabled || isSubmitting}
                aria-label="修改附加项"
              >
                {isUploadingAttachments ? (
                  <LoaderCircleIcon className="size-4 animate-spin" />
                ) : (
                  <PaperclipIcon className="size-4" />
                )}
                {hasAttachments ? (
                  <span
                    className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-[7px] bg-sky-600 px-1 text-[0.65rem] font-medium leading-4 text-white shadow-[0_4px_10px_rgba(2,132,199,0.2)]"
                    aria-hidden="true"
                  >
                    {attachments.length}
                  </span>
                ) : null}
              </Button>
            </Tooltip>
          </div>

          <Button
            className="h-8 rounded-[8px] px-1 shadow-[0_10px_18px_rgba(72,115,195,0.13)]"
            type="button"
            onClick={() => {
              if (isSubmitting) {
                onStop();
                return;
              }

              void handleSubmitDraft();
            }}
            disabled={!canSend && !canStop}
            aria-label={isSubmitting ? "停止生成" : "发送消息"}
          >
            <span className="flex min-w-[4.25rem] items-center justify-center gap-1.5 px-1 text-[0.86rem]">
              {isSubmitting ? (
                <SquareIcon className="size-3.5 fill-current" />
              ) : (
                <ArrowUpIcon className="size-3.5" />
              )}
              <span>{isSubmitting ? "停止" : "发送"}</span>
            </span>
          </Button>
        </div>
      </div>
      <AttachmentEditorDialog
        open={isAttachmentDialogOpen}
        title="修改附加项"
        urls={urlContextUrls}
        attachments={attachments}
        disabled={disabled || isSubmitting}
        supportsFiles={supportsFiles}
        supportsImages={supportsImages}
        isUploading={isUploadingAttachments}
        onOpenChange={setIsAttachmentDialogOpen}
        onUrlsChange={onUrlContextUrlsChange}
        onAttachmentsChange={onAttachmentsChange}
        onUploadFiles={handleUploadFiles}
      />
    </motion.div>
  );
}
