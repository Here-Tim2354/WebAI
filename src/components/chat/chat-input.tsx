"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ArrowUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  hasMessages: boolean;
  disabled?: boolean;
};

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  hasMessages,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = value.trim().length > 0 && !isSubmitting && !disabled;

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [value]);

  useEffect(() => {
    if (!isSubmitting) {
      textareaRef.current?.focus();
    }
  }, [isSubmitting]);

  return (
    <motion.div
      className={cn(
        "mx-auto flex w-full flex-col gap-3 border border-border/90 bg-background/95 backdrop-blur-xl",
        hasMessages
          ? "sticky bottom-4 max-w-4xl rounded-[24px] px-4 py-4 shadow-[0_40px_48px_rgba(48,82,139,0.08)]"
          : "max-w-[52rem] rounded-[30px] px-5 py-4 shadow-[0_16px_36px_rgba(48,82,139,0.06)]",
      )}
      initial={false}
    >
      <Textarea
        ref={textareaRef}
        className={cn(
          "max-h-60 resize-none border-0 bg-transparent px-1 py-0 text-[1rem] leading-8 shadow-none ring-0 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-transparent",
          hasMessages ? "min-h-24 rounded-none" : "min-h-14 rounded-none",
        )}
        placeholder="随便说些什么..."
        value={value}
        rows={1}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void onSubmit();
          }
        }}
      />

      <div className="flex items-center justify-end">
        <Button
          className="h-10 rounded-full px-5 shadow-[0_12px_24px_rgba(72,115,195,0.14)]"
          type="button"
          onClick={() => void onSubmit()}
          disabled={!canSend}
          aria-label="发送消息"
        >
          <ArrowUpIcon data-icon="inline-end" />
          发送
        </Button>
      </div>
    </motion.div>
  );
}
