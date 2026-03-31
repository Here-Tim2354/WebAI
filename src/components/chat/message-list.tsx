import { RefObject } from "react";
import { ChatMessage } from "@/lib/schemas/chat";
import { MessageBubble } from "./message-bubble";

type MessageListProps = {
  messages: ChatMessage[];
  messageEndRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onPromptSelect: (prompt: string) => void;
  onScroll: () => void;
  onJumpToLatest: () => void;
  showJumpToLatest: boolean;
};

const promptCards = [
  {
    title: "梳理思路",
    prompt: "帮我把一个想法拆成几个清晰的执行步骤。",
  },
  {
    title: "写点代码",
    prompt: "用 TypeScript 写一个带类型守卫的消息格式化函数。",
  },
  {
    title: "制定计划",
    prompt: "帮我整理一个功能从设计到实现的任务顺序。",
  },
  {
    title: "整理文档",
    prompt: "把当前思路整理成一份清晰的 Markdown 说明。",
  },
];

export function MessageList({
  messages,
  messageEndRef,
  scrollContainerRef,
  onPromptSelect,
  onScroll,
  onJumpToLatest,
  showJumpToLatest,
}: MessageListProps) {
  return (
    <div
      ref={scrollContainerRef}
      className="message-list"
      onScroll={onScroll}
    >
      {messages.length === 0 ? (
        <div className="chat-empty">
          <div className="chat-empty__inner">
            <div className="chat-empty__eyebrow">WebAI</div>
            <h1 className="chat-empty__title">想聊些什么？</h1>
            <div className="chat-empty__grid">
              {promptCards.map((card) => (
                <button
                  key={card.title}
                  className="chat-empty__hint"
                  type="button"
                  onClick={() => onPromptSelect(card.prompt)}
                >
                  <strong>{card.title}</strong>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="message-list__inner">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messageEndRef} />
          {showJumpToLatest ? (
            <button
              className="message-list__jump"
              type="button"
              onClick={onJumpToLatest}
            >
              最新
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
