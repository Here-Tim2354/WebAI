import { RefObject } from "react";
import { ChatMessage } from "@/lib/schemas/chat";
import { MessageBubble } from "./message-bubble";

type MessageListProps = {
  messages: ChatMessage[];
  messageEndRef: RefObject<HTMLDivElement | null>;
  onPromptSelect: (prompt: string) => void;
};

const promptCards = [
  {
    title: "产品判断",
    prompt: "帮我定义一个 AI 聊天首页的空态文案。",
  },
  {
    title: "代码输出",
    prompt: "用 TypeScript 写一个带类型守卫的消息格式化函数。",
  },
  {
    title: "连续对话",
    prompt: "先记住我在做 WebAI，下一轮再提醒我当前 phase。",
  },
  {
    title: "Markdown",
    prompt: "把一个 Phase 1 开工计划整理成清晰的 Markdown 列表。",
  },
];

export function MessageList({
  messages,
  messageEndRef,
  onPromptSelect,
}: MessageListProps) {
  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="chat-empty">
          <div className="chat-empty__inner">
            <h1 className="chat-empty__title">What are you working on?</h1>
            <p className="chat-empty__copy">
              把聊天主链路先做顺手。这里先专注单页单会话、多轮对话和稳定自然的输入体验。
            </p>
            <div className="chat-empty__grid">
              {promptCards.map((card) => (
                <button
                  key={card.title}
                  className="chat-empty__hint"
                  type="button"
                  onClick={() => onPromptSelect(card.prompt)}
                >
                  <strong>{card.title}</strong>
                  <span>{card.prompt}</span>
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
        </div>
      )}
    </div>
  );
}
