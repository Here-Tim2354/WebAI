"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowUpIcon,
  GlobeIcon,
  Link2Icon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AddUrlContextResult } from "./use-chat-session";

type ChatInputProps = {
  value: string;
  webSearchEnabled: boolean;
  urlContextInputValue: string;
  urlContextUrls: string[];
  isUrlContextPanelOpen: boolean;
  supportsWebSearch: boolean;
  supportsUrlContext: boolean;
  onChange: (value: string) => void;
  onToggleWebSearch: () => void | Promise<void>;
  onUrlContextInputChange: (value: string) => void;
  onToggleUrlContextPanel: () => void;
  onAddUrlContextUrl: () => AddUrlContextResult;
  onRemoveUrlContextUrl: (url: string) => void;
  onSubmit: () => Promise<void>;
  onStop: () => void;
  isSubmitting: boolean;
  disabled?: boolean;
};

export function ChatInput({
  value,
  webSearchEnabled,
  urlContextInputValue,
  urlContextUrls,
  isUrlContextPanelOpen,
  supportsWebSearch,
  supportsUrlContext,
  onChange,
  onToggleWebSearch,
  onUrlContextInputChange,
  onToggleUrlContextPanel,
  onAddUrlContextUrl,
  onRemoveUrlContextUrl,
  onSubmit,
  onStop,
  isSubmitting,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const urlLimitWarningTimeoutRef = useRef<number | null>(null);
  const canSend = value.trim().length > 0 && !isSubmitting && !disabled;
  const canStop = isSubmitting && !disabled;
  const hasUrlContext = urlContextUrls.length > 0;
  const canToggleWebSearch = !disabled && !isSubmitting;
  const canToggleUrlContext = !disabled && !isSubmitting;
  const [isUrlLimitWarningVisible, setIsUrlLimitWarningVisible] = useState(false);
  const urlContextHint = isUrlLimitWarningVisible
    ? "至多输入4条URL"
    : supportsUrlContext
      ? "Gemini将检索输入的URL"
      : "当前模型暂不支持 URL Context";

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

  // 管理输入框高度自适应。
  // 当前实现是在 value 变化后读取 scrollHeight，并把 textarea 高度限制在 240px 内。
  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [value]);

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
        isUrlContextPanelOpen ? "gap-1.5" : "gap-3",
        "max-w-4xl rounded-[14px] px-4 pt-2 pb-4 shadow-[0_40px_48px_rgba(48,82,139,0.12)]",
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
                "0 40px 48px rgba(48,82,139,0.12)",
                "0 0 0 2px rgba(248,113,113,0.14), 0 40px 48px rgba(48,82,139,0.12)",
                "0 40px 48px rgba(48,82,139,0.12)",
              ],
            }
          : {
              borderColor: "rgba(226,232,240,0.9)",
              boxShadow: "0 40px 48px rgba(48,82,139,0.12)",
            }
      }
      transition={{ duration: 0.8, ease: "easeInOut" }}
    >
      <AnimatePresence initial={false}>
        {isUrlContextPanelOpen ? (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
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
          "flex flex-col gap-3",
          isUrlContextPanelOpen && "pt-1.5",
        )}
      >
        <Textarea
          ref={textareaRef}
          className={cn(
            "max-h-60 resize-none border-0 bg-transparent px-1 py-0 text-[1rem] leading-8 shadow-none ring-0 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent",
            "min-h-8 rounded-none",
          )}
          placeholder="随便说些什么..."
          value={value}
          rows={1}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !isSubmitting) {
              event.preventDefault();
              void onSubmit();
            }
          }}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              className={cn(
                "rounded-[10px] border-border/70 bg-background/82 text-muted-foreground shadow-none",
                webSearchEnabled &&
                  "border-sky-200/90 bg-sky-50/88 text-sky-700 hover:bg-sky-100/82",
                !supportsWebSearch && "opacity-80",
              )}
              type="button"
              onClick={onToggleWebSearch}
              disabled={!canToggleWebSearch}
              aria-label={webSearchEnabled ? "关闭联网搜索" : "开启联网搜索"}
              title={
                supportsWebSearch
                  ? webSearchEnabled
                    ? "当前会话已开启联网搜索。"
                    : "当前会话已关闭联网搜索。"
                  : "当前模型不支持联网搜索，但你仍可以提前调整这个会话级开关。"
              }
            >
              <GlobeIcon className="size-4.5" />
            </Button>

            <Button
              variant="outline"
              size="icon-sm"
              className={cn(
                "relative rounded-[10px] border-border/70 bg-background/82 text-muted-foreground shadow-none",
                (isUrlContextPanelOpen || hasUrlContext) &&
                  "border-sky-200/90 bg-sky-50/88 text-sky-700 hover:bg-sky-100/82",
                !supportsUrlContext && !hasUrlContext && "opacity-80",
              )}
              type="button"
              onClick={onToggleUrlContextPanel}
              disabled={!canToggleUrlContext}
              aria-label={isUrlContextPanelOpen ? "收起 URL Context" : "展开 URL Context"}
              title={
                supportsUrlContext
                  ? `为当前这次发送补充 URL Context。已添加 ${urlContextUrls.length} 条 URL。`
                  : "当前模型不支持 URL Context，但你仍可以先查看或整理待发送的 URL。"
              }
            >
              <Link2Icon className="size-4.5" />
              <span
                className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sky-600 px-1 text-[0.65rem] font-medium leading-4 text-white"
                aria-hidden="true"
              >
                {urlContextUrls.length}
              </span>
              <span className="sr-only">已添加 {urlContextUrls.length} 条 URL</span>
            </Button>
          </div>

          <Button
            className="h-10 rounded-[10px] px-1 shadow-[0_12px_24px_rgba(72,115,195,0.14)]"
            type="button"
            onClick={() => {
              if (isSubmitting) {
                onStop();
                return;
              }

              void onSubmit();
            }}
            disabled={!canSend && !canStop}
            aria-label={isSubmitting ? "停止生成" : "发送消息"}
          >
            <span className="flex min-w-[5.5rem] items-center justify-center gap-2">
              {isSubmitting ? (
                <SquareIcon className="size-4 fill-current" />
              ) : (
                <ArrowUpIcon className="size-4" />
              )}
              <span>{isSubmitting ? "停止" : "发送"}</span>
            </span>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
