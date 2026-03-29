"use client";

import { FormEvent, useState } from "react";
import { Conversation } from "@/lib/schemas/conversation";

type ConversationSidebarProps = {
  conversations: Conversation[];
  activeConversationId: string | null;
  isCreating: boolean;
  isDeletingConversationId: string | null;
  isSigningOut: boolean;
  currentUserEmail: string | null;
  onCreateConversation: () => Promise<void>;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ConversationSidebar({
  conversations,
  activeConversationId,
  isCreating,
  isDeletingConversationId,
  isSigningOut,
  currentUserEmail,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onSignOut,
}: ConversationSidebarProps) {
  const [editingConversationId, setEditingConversationId] = useState<string | null>(
    null,
  );
  const [titleDraft, setTitleDraft] = useState("");

  async function handleRenameSubmit(
    event: FormEvent<HTMLFormElement>,
    conversationId: string,
  ) {
    event.preventDefault();

    const nextTitle = titleDraft.trim();

    if (!nextTitle) {
      return;
    }

    try {
      await onRenameConversation(conversationId, nextTitle);
      setEditingConversationId(null);
      setTitleDraft("");
    } catch {
      // 保留编辑态和输入内容，让用户直接修正后重试。
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <div className="sidebar__brand">
          <div className="sidebar__logo">W</div>
          <div>
            <strong>WebAI</strong>
            <span>{currentUserEmail ?? "已登录"}</span>
          </div>
        </div>

        <button
          className="sidebar__new-chat"
          type="button"
          onClick={() => void onCreateConversation()}
          disabled={isCreating}
        >
          {isCreating ? "创建中..." : "New"}
        </button>

        <section className="sidebar__overview" aria-label="会话列表">
          <span className="sidebar__section-title">Conversations</span>
          <div className="sidebar__conversation-list">
            {conversations.length === 0 ? (
              <div className="sidebar__empty">还没有会话，先新建一个。</div>
            ) : (
              conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                const isEditing = conversation.id === editingConversationId;
                const isDeleting = conversation.id === isDeletingConversationId;

                return (
                  <article
                    key={conversation.id}
                    className={`conversation-item ${
                      isActive ? "conversation-item--active" : ""
                    }`}
                  >
                    {isEditing ? (
                      <form
                        className="conversation-item__rename"
                        onSubmit={(event) =>
                          void handleRenameSubmit(event, conversation.id)
                        }
                      >
                        <input
                          autoFocus
                          value={titleDraft}
                          onChange={(event) => setTitleDraft(event.target.value)}
                          onBlur={() => {
                            setEditingConversationId(null);
                            setTitleDraft("");
                          }}
                        />
                      </form>
                    ) : (
                      <button
                        className="conversation-item__main"
                        type="button"
                        onClick={() => onSelectConversation(conversation.id)}
                      >
                        <strong>{conversation.title}</strong>
                        <span>{formatUpdatedAt(conversation.updatedAt)}</span>
                      </button>
                    )}

                    <div className="conversation-item__actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingConversationId(conversation.id);
                          setTitleDraft(conversation.title);
                        }}
                      >
                        重命名
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`确认删除“${conversation.title}”吗？`)) {
                            void onDeleteConversation(conversation.id);
                          }
                        }}
                        disabled={isDeleting}
                      >
                        {isDeleting ? "删除中..." : "删除"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="sidebar__footer">
        <strong>{conversations.length > 0 ? `${conversations.length} chats` : "0 chats"}</strong>
        <button
          className="sidebar__sign-out"
          type="button"
          onClick={() => void onSignOut()}
          disabled={isSigningOut}
        >
          {isSigningOut ? "退出中..." : "退出登录"}
        </button>
      </div>
    </aside>
  );
}
