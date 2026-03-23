import { ChatMessage } from "@/lib/schemas/chat";
import { MarkdownMessage } from "./markdown-message";

type MessageBubbleProps = {
  message: ChatMessage;
};

const roleLabelMap = {
  assistant: "Assistant",
  user: "You",
  system: "System",
  error: "Error",
} as const;

export function MessageBubble({ message }: MessageBubbleProps) {
  const bubbleClassName = {
    assistant: "message__bubble message__bubble--assistant",
    user: "message__bubble message__bubble--user",
    system: "message__bubble message__bubble--assistant",
    error: "message__bubble message__bubble--error",
  }[message.role];
  const statusLabel =
    message.status === "pending"
      ? "生成中"
      : message.status === "error"
        ? "失败"
        : null;

  return (
    <article
      className={`message message--${message.role} message--status-${message.status}`}
    >
      {message.role === "error" || statusLabel ? (
        <div className="message__meta">
          <span className="message__label">{roleLabelMap[message.role]}</span>
          {statusLabel ? (
            <span className="message__status">{statusLabel}</span>
          ) : null}
        </div>
      ) : null}
      <div className={bubbleClassName}>
        {message.status === "pending" && message.content.length === 0 ? (
          <span className="message__pending" aria-label="正在生成">
            <span className="message__pending-dot" />
            <span className="message__pending-dot" />
            <span className="message__pending-dot" />
            <span>生成中</span>
          </span>
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>
    </article>
  );
}
