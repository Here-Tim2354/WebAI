"use client";

import { useEffect, useRef } from "react";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  hasMessages: boolean;
};

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isSubmitting,
  hasMessages,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = value.trim().length > 0 && !isSubmitting;

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
    <div className={`composer ${hasMessages ? "composer--dock" : "composer--hero"}`}>
      <textarea
        ref={textareaRef}
        className="composer__input"
        placeholder="Ask anything"
        value={value}
        rows={1}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void onSubmit();
          }
        }}
      />

      <div className="composer__footer">
        <div className="composer__hint">
          Enter 发送，Shift + Enter 换行。支持 Markdown、代码块高亮和复制。
        </div>

        <div className="composer__actions">
          {isSubmitting ? (
            <span className="composer__status">正在等待 Gemini 回复…</span>
          ) : null}
          <button
            className="composer__button"
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSend}
            aria-label="发送消息"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
