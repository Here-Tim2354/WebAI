import { ChatMessage } from "@/lib/schemas/chat";
import { motion } from "motion/react";
import { BotIcon, CircleAlertIcon, LoaderCircleIcon, UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
  const isAssistantLike =
    message.role === "assistant" || message.role === "system";
  const isUser = message.role === "user";
  const isError = message.role === "error";
  const statusLabel =
    message.status === "pending"
      ? "生成中"
      : message.status === "error"
        ? "失败"
        : null;

  return (
    <motion.article
      className={cn(
        "flex max-w-[min(100%,52rem)] flex-col gap-2",
        isUser ? "self-end" : "self-start",
      )}
      initial={false}
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
            className="rounded-full px-2 py-0.5 text-[0.68rem] tracking-normal"
          >
            {statusLabel}
          </Badge>
        ) : null}
      </div>
      <div
        className={cn(
          "px-4 py-3",
          isAssistantLike &&
            "rounded-[18px] border border-transparent bg-transparent shadow-none sm:px-1 sm:py-2",
          isUser &&
            "rounded-[20px] border border-blue-100/80 bg-blue-50/82 shadow-[0_10px_20px_rgba(54,88,143,0.05)]",
          isError &&
            "rounded-[20px] border border-red-200/90 bg-red-50/90 text-red-700 shadow-[0_10px_20px_rgba(172,60,60,0.07)]",
        )}
      >
        {message.status === "pending" && message.content.length === 0 ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            生成中
          </span>
        ) : (
          <MarkdownMessage content={message.content} />
        )}
      </div>
    </motion.article>
  );
}
