"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthUser } from "@/lib/schemas/auth";
import { Conversation, conversationResponseSchema } from "@/lib/schemas/conversation";
import { AuthPanel } from "./auth-panel";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";
import { useChatSession } from "./use-chat-session";
import { useMessageScroll } from "./use-message-scroll";

type ChatShellProps = {
  initialUser: AuthUser | null;
  initialConversations: Conversation[];
  initialAuthMessage?: string | null;
  initialAuthMessageType?: "info" | "error";
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "操作失败，请稍后再试。";
}

export function ChatShell({
  initialUser,
  initialConversations,
  initialAuthMessage = null,
  initialAuthMessageType = "info",
}: ChatShellProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isDeletingConversationId, setIsDeletingConversationId] = useState<
    string | null
  >(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const {
    inputValue,
    isSubmitting,
    setInputValue,
    getMessages,
    handlePromptSelect,
    handleSubmit,
  } = useChatSession();
  const messages = getMessages(activeConversationId);
  const {
    messageEndRef,
    scrollContainerRef,
    showJumpToLatest,
    handleScroll,
    scrollToLatest,
  } = useMessageScroll({ messages });
  const hasMessages = messages.length > 0;
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );

  async function handleCreateConversation() {
    setIsCreatingConversation(true);
    setWorkspaceError(null);

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "新建会话失败。");
      }

      const parsed = conversationResponseSchema.parse(payload);
      setConversations((current) => [parsed.conversation, ...current]);
      setActiveConversationId(parsed.conversation.id);
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function handleRenameConversation(
    conversationId: string,
    title: string,
  ) {
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "重命名失败。");
      }

      const parsed = conversationResponseSchema.parse(payload);
      setConversations((current) =>
        current
          .map((conversation) =>
            conversation.id === conversationId
              ? parsed.conversation
              : conversation,
          )
          .sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
          ),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    }
  }

  async function handleDeleteConversation(conversationId: string) {
    setIsDeletingConversationId(conversationId);
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload =
          response.status === 204
            ? null
            : await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "删除失败。");
      }

      setConversations((current) => {
        const remaining = current.filter(
          (conversation) => conversation.id !== conversationId,
        );

        setActiveConversationId((activeId) =>
          activeId === conversationId ? remaining[0]?.id ?? null : activeId,
        );

        return remaining;
      });
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
    } finally {
      setIsDeletingConversationId(null);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setWorkspaceError(null);

    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "退出登录失败。");
      }

      setUser(null);
      setConversations([]);
      setActiveConversationId(null);
      router.refresh();
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
    } finally {
      setIsSigningOut(false);
    }
  }

  if (!user) {
    return (
      <AuthPanel
        initialMessage={initialAuthMessage}
        initialMessageType={initialAuthMessageType}
      />
    );
  }

  return (
    <div className="app-shell">
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        isCreating={isCreatingConversation}
        isDeletingConversationId={isDeletingConversationId}
        isSigningOut={isSigningOut}
        currentUserEmail={user.email}
        onCreateConversation={handleCreateConversation}
        onSelectConversation={setActiveConversationId}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onSignOut={handleSignOut}
      />

      <main className="main-panel">
        <header className="chat-header">
          <div>
            <div className="chat-header__eyebrow">Conversation</div>
            <div className="chat-header__brand">
              {activeConversation?.title ?? "请选择或新建一个会话"}
            </div>
          </div>
          <div className="chat-header__pill">
            {isSubmitting
              ? "Live"
              : activeConversation
                ? hasMessages
                  ? "Open"
                  : "Ready"
                : "Idle"}
          </div>
        </header>

        {workspaceError ? (
          <div className="workspace-banner workspace-banner--error" role="alert">
            {workspaceError}
          </div>
        ) : null}

        {activeConversation ? (
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
              onSubmit={() => handleSubmit(activeConversation.id)}
              isSubmitting={isSubmitting}
              hasMessages={hasMessages}
            />
          </section>
        ) : (
          <section className="workspace-empty">
            <div className="workspace-empty__inner">
              <div className="chat-empty__eyebrow">Conversations</div>
              <h2 className="workspace-empty__title">先创建一个真实会话，再开始聊天</h2>
              <p className="workspace-empty__description">
                这一步已经接入 Supabase 用户与会话表，左侧的新建、切换、重命名和删除都会直接作用到数据库。
              </p>
              <button
                className="workspace-empty__button"
                type="button"
                onClick={() => void handleCreateConversation()}
                disabled={isCreatingConversation}
              >
                {isCreatingConversation ? "创建中..." : "新建会话"}
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
