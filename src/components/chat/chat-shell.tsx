"use client";

import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";
import { useChatSession } from "./use-chat-session";
import { useMessageScroll } from "./use-message-scroll";

export function ChatShell() {
  const {
    messages,
    inputValue,
    isSubmitting,
    setInputValue,
    handlePromptSelect,
    handleResetConversation,
    handleSubmit,
  } = useChatSession();
  const {
    messageEndRef,
    scrollContainerRef,
    showJumpToLatest,
    handleScroll,
    scrollToLatest,
  } = useMessageScroll({ messages });
  const hasMessages = messages.length > 0;
  const conversationCount = messages.filter(
    (message) => message.role === "user",
  ).length;
  const workspaceLanes = [
    {
      title: "产品",
      prompt: "帮我整理 WebAI 首页空态和聊天态的产品体验优化建议。",
    },
    {
      title: "开发",
      prompt: "帮我把当前聊天页拆成更清晰的前端组件边界。",
    },
    {
      title: "文档",
      prompt: "把当前 Phase 2 的推进重点整理成一份简明文档。",
    },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <div className="sidebar__logo">W</div>
            <div>
              <strong>WebAI</strong>
              <span>Chat</span>
            </div>
          </div>

          <button
            className="sidebar__new-chat"
            type="button"
            onClick={handleResetConversation}
          >
            New
          </button>

          <section className="sidebar__overview" aria-label="工作入口">
            <span className="sidebar__section-title">Groups</span>
            <div className="sidebar__overview-list">
              {workspaceLanes.map((lane) => (
                <button
                  key={lane.title}
                  className="sidebar__lane"
                  type="button"
                  onClick={() => handlePromptSelect(lane.prompt)}
                >
                  <strong>{lane.title}</strong>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="sidebar__footer">
          <strong>{isSubmitting ? "Live" : "Ready"}</strong>
          <span>{conversationCount > 0 ? `${conversationCount} turns` : "Idle"}</span>
        </div>
      </aside>

      <main className="main-panel">
        <header className="chat-header">
          <div>
            <div className="chat-header__eyebrow">Chat</div>
            <div className="chat-header__brand">WebAI</div>
          </div>
          <div className="chat-header__pill">
            {isSubmitting ? "Live" : hasMessages ? "Open" : "Ready"}
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
            scrollContainerRef={scrollContainerRef}
            onPromptSelect={handlePromptSelect}
            onScroll={handleScroll}
            showJumpToLatest={showJumpToLatest}
            onJumpToLatest={() => scrollToLatest()}
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
