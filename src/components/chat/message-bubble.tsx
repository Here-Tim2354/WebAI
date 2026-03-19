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

  return (
    <article className={`message message--${message.role}`}>
      {message.role === "error" ? (
        <span className="message__label">{roleLabelMap[message.role]}</span>
      ) : null}
      <div className={bubbleClassName}>
        {message.status === "pending" && message.content.length === 0 ? (
          <span className="message__pending" aria-label="正在生成">
            <span className="message__pending-dot" />
            <span className="message__pending-dot" />
            <span className="message__pending-dot" />
            <span>思考中</span>
          </span>
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>
    </article>
  );
}
