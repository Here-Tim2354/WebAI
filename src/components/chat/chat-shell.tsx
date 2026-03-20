"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChatMessage,
  chatResponseSchema,
  createChatMessage,
} from "@/lib/schemas/chat";
import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "消息发送失败，请稍后再试。";
}

export function ChatShell() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const hasMessages = messages.length > 0;
  const conversationCount = messages.filter(
    (message) => message.role === "user",
  ).length;
  const phaseNotes = [
    {
      title: "当前阶段",
      description: "Phase 1 · 聊天主链路 MVP",
    },
    {
      title: "本轮重点",
      description: "先收口高亮、错误分类和界面边界，再考虑正式验收。",
    },
  ];
  const productBoundaries = [
    "单页单会话",
    "支持多轮对话",
    "刷新后不保留历史",
  ];

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function handleResetConversation() {
    setMessages([]);
    setInputValue("");
  }

  function handlePromptSelect(prompt: string) {
    setInputValue(prompt);
  }

  async function handleSubmit() {
    const content = inputValue.trim();

    if (!content || isSubmitting) {
      return;
    }

    const userMessage = createChatMessage({
      role: "user",
      content,
      status: "complete",
    });

    const assistantPlaceholder = createChatMessage({
      role: "assistant",
      content: "",
      status: "pending",
    });

    const nextConversation = [
      ...messages.filter((message) => message.role !== "error"),
      userMessage,
    ];

    setMessages((current) => [...current, userMessage, assistantPlaceholder]);
    setInputValue("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextConversation,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gemini 暂时不可用。");
      }

      const parsed = chatResponseSchema.parse(payload);

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantPlaceholder.id ? parsed.message : message,
        ),
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantPlaceholder.id
            ? createChatMessage({
                id: assistantPlaceholder.id,
                role: "error",
                content: getErrorMessage(error),
                status: "error",
              })
            : message,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <div className="sidebar__logo">W</div>
            <div>
              <strong>WebAI</strong>
              <span>Phase 1 MVP</span>
            </div>
          </div>

          <button
            className="sidebar__new-chat"
            type="button"
            onClick={handleResetConversation}
          >
            + New chat
          </button>

          <section className="sidebar__overview" aria-label="当前产品状态">
            <span className="sidebar__section-title">当前状态</span>
            <div className="sidebar__overview-list">
              {phaseNotes.map((note) => (
                <div key={note.title} className="sidebar__overview-card">
                  <strong>{note.title}</strong>
                  <span>{note.description}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="sidebar__history" aria-label="当前产品边界">
          <span className="sidebar__section-title">当前边界</span>
          <div className="sidebar__history-list">
            {productBoundaries.map((label) => (
              <div key={label} className="sidebar__history-item">
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar__footer">
          <strong>{isSubmitting ? "Gemini 正在思考" : "随时可以继续提问"}</strong>
          <span>当前会话已发送 {conversationCount} 轮消息</span>
        </div>
      </aside>

      <main className="main-panel">
        <header className="chat-header">
          <div className="chat-header__brand">WebAI</div>
          <div className="chat-header__pill">
            {isSubmitting ? "Thinking..." : "Ready"}
          </div>
        </header>

        <section
          className={`chat-body ${
            hasMessages ? "chat-body--conversation" : "chat-body--empty"
          }`}
        >
          <MessageList
            messages={messages}
            messageEndRef={messageEndRef}
            onPromptSelect={handlePromptSelect}
          />
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            hasMessages={hasMessages}
          />
        </section>
      </main>
    </div>
  );
}
