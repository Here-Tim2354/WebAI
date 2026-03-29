"use client";

import { useEffect, useRef } from "react";

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
  const helperText = disabled
    ? "先新建或打开一个对话"
    : isSubmitting
      ? "生成中"
      : "回车发送";

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
    <div
      className={`composer ${hasMessages ? "composer--dock" : "composer--hero"}`}
    >
      <div className="composer__meta">
        <span className="composer__eyebrow">{hasMessages ? "对话中" : "开始对话"}</span>
        {isSubmitting ? (
          <span className="composer__status composer__status--live">
            回复中
          </span>
        ) : null}
      </div>
      <textarea
        ref={textareaRef}
        className="composer__input"
        placeholder={disabled ? "先新建或打开一个对话..." : "发一条消息..."}
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

      <div className="composer__footer">
        <div className="composer__hint">{helperText}</div>

        <div className="composer__actions">
          <button
            className="composer__button"
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSend}
            aria-label="发送消息"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
