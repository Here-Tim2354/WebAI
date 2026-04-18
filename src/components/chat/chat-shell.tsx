"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  NotebookPenIcon,
  PanelLeftOpenIcon,
  SparklesIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { chatSessionResponseSchema } from "@/lib/schemas/chat";
import { AuthUser } from "@/lib/schemas/auth";
import { Conversation, conversationResponseSchema } from "@/lib/schemas/conversation";
import { AIModel, aiModelListResponseSchema } from "@/lib/schemas/model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AuthPanel } from "./auth-panel";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatInput } from "./chat-input";
import { MessageList } from "./message-list";
import { ModelIcon } from "./model-icon";
import { useChatSession } from "./use-chat-session";
import { useMessageScroll } from "./use-message-scroll";

type ChatShellProps = {
  initialUser: AuthUser | null;
  initialConversations: Conversation[];
  initialModels: AIModel[];
  initialAuthMessage?: string | null;
  initialAuthMessageType?: "info" | "error";
};

// 前端链路里既可能抛 Error，也可能抛非 Error 值，统一在这里收口成人类可读消息。
function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "暂时无法完成操作，请稍后再试。";
}

// 会话列表以最近更新时间倒序展示，保证刚对话过或刚编辑过的会话始终靠前。
function sortConversations(conversations: Conversation[]) {
  return [...conversations].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

/**
 * ChatShell 是聊天工作区的前端状态中枢：
 * 负责会话列表、当前会话、模型选择、消息发送和错误提示之间的协调。
 */
export function ChatShell({
  initialUser,
  initialConversations,
  initialModels,
  initialAuthMessage = null,
  initialAuthMessageType = "info",
}: ChatShellProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [conversations, setConversations] = useState(
    sortConversations(initialConversations),
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isDeletingConversationId, setIsDeletingConversationId] = useState<
    string | null
  >(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>(initialModels);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    initialModels.find((model) => model.isDefault)?.id ?? initialModels[0]?.id ?? null,
  );
  const {
    inputValue,
    isSubmitting,
    setInputValue,
    getMessages,
    handleSubmit,
    syncConversationMessages,
    removeConversationMessages,
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
  const selectedModel = availableModels.find(
    (model) => model.id === selectedModelId,
  ) ?? null;
  const groupedModels = availableModels.reduce<Record<string, AIModel[]>>(
    (groups, model) => {
      const key = model.provider === "gemini" ? "Gemini" : "OpenAI Compatible";

      // ??= 是“若不存在则初始化”，这里把平铺的模型数组整理成按 provider 分组的结构。
      groups[key] ??= [];
      groups[key].push(model);

      return groups;
    },
    {},
  );

  // upsert 的目标是“有则更新，无则插入”，这样重命名、拉取详情、发送消息后都能复用同一入口刷新列表。
  function upsertConversation(nextConversation: Conversation) {
    setConversations((current) => {
      const remaining = current.filter(
        (conversation) => conversation.id !== nextConversation.id,
      );

      return sortConversations([nextConversation, ...remaining]);
    });
  }

  /**
   * 当前新建会话仍走“空参数快速创建”模式：
   * 后端会自动补默认标题，前端这里只负责把新会话插入本地状态并决定是否立即激活。
   */
  async function createConversation(options?: { activate?: boolean }) {
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
      // 新会话刚创建时数据库里还没有消息，这里提前同步空数组，
      // 后续切换到它时就不会误读到旧会话残留状态。
      upsertConversation(parsed.conversation);
      syncConversationMessages(parsed.conversation.id, []);

      if (options?.activate ?? true) {
        setActiveConversationId(parsed.conversation.id);
      }

      return parsed.conversation;
    } finally {
      setIsCreatingConversation(false);
    }
  }

  // 管理客户端挂载后的模型列表同步。
  // 当前实现只在首次挂载时请求 /api/models，并在结果返回后校正可用模型和当前选中值。
  useEffect(() => {
    let cancelled = false;

    // 模型列表即便服务端已经首屏注入过，也仍然在客户端再拉一遍，
    // 这样进入工作区后能尽量同步到“当前数据库里最新启用”的模型集合。
    async function loadModels() {
      try {
        const response = await fetch("/api/models");
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "读取模型列表失败。");
        }

        const parsed = aiModelListResponseSchema.parse(payload);

        if (cancelled) {
          return;
        }

        setAvailableModels(parsed.models);
        // 如果当前选中的模型仍然存在，就保留用户选择；
        // 否则回退到默认模型，避免前端继续持有已被停用的 modelId。
        setSelectedModelId((current) => {
          if (current && parsed.models.some((model) => model.id === current)) {
            return current;
          }

          return (
            parsed.models.find((model) => model.isDefault)?.id ??
            parsed.models[0]?.id ??
            null
          );
        });
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError((current) => current ?? getErrorMessage(error));
        }
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  // 管理当前激活会话的详情加载。
  // 当前实现会在 activeConversationId 变化时拉取会话快照，并在卸载或切换时通过 cancelled 防止过期回写。
  useEffect(() => {
    if (!activeConversationId) {
      setIsLoadingConversation(false);
      return;
    }

    const conversationId = activeConversationId;
    let cancelled = false;

    // 切换会话时按需拉取详情，避免首页一次性把所有历史消息都塞进首屏 payload。
    async function loadConversation() {
      setIsLoadingConversation(true);

      try {
        const response = await fetch(`/api/conversations/${conversationId}`);
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error?.message ?? "读取会话失败。");
        }

        const parsed = chatSessionResponseSchema.parse(payload);

        if (cancelled) {
          return;
        }

        // 会话详情接口返回的是“会话 + 消息快照”，
        // 因此前端可以一次同步标题、system prompt 和完整消息列表。
        syncConversationMessages(conversationId, parsed.messages);
        upsertConversation(parsed.conversation);
        setWorkspaceError(null);
      } catch (error) {
        if (!cancelled) {
          setWorkspaceError(getErrorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConversation(false);
        }
      }
    }

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, syncConversationMessages]);

  async function handleCreateConversation() {
    try {
      await createConversation({ activate: true });
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
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
      upsertConversation(parsed.conversation);
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

      removeConversationMessages(conversationId);
      setConversations((current) => {
        const remaining = current.filter(
          (conversation) => conversation.id !== conversationId,
        );

        // 如果删掉的是当前会话，就把焦点切到列表中的下一条，
        // 避免主面板仍停留在一个已不存在的 conversationId 上。
        setActiveConversationId((activeId) =>
          activeId === conversationId ? remaining[0]?.id ?? null : activeId,
        );

        return remaining;
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
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
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    } finally {
      setIsSigningOut(false);
    }
  }

  async function ensureConversationId() {
    if (activeConversationId) {
      return activeConversationId;
    }

    // 首条消息发送时允许“先输入，后建会话”。
    // 这样空白工作区不需要额外先点一次“新对话”。
    try {
      const conversation = await createConversation({ activate: true });
      return conversation.id;
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
      return null;
    }
  }

  async function handleSendMessage() {
    setWorkspaceError(null);

    await handleSubmit({
      activeConversationId,
      ensureConversationId,
      selectedModelId,
      // handleSubmit 只知道聊天接口返回了最新会话，
      // 具体怎么把它并回列表由 ChatShell 决定。
      onConversationSynced(conversation) {
        upsertConversation(conversation);
      },
    });
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
    <div className="flex h-[100dvh] overflow-hidden bg-background lg:flex-row">
      <ConversationSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        isCreating={isCreatingConversation}
        isDeletingConversationId={isDeletingConversationId}
        isSigningOut={isSigningOut}
        currentUserEmail={user.email}
        mobileOpen={isMobileSidebarOpen}
        onMobileOpenChange={setIsMobileSidebarOpen}
        onCreateConversation={handleCreateConversation}
        onSelectConversation={setActiveConversationId}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        onSignOut={handleSignOut}
      />

      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(193,225,255,0.54),transparent_24%),radial-gradient(circle_at_top_center,rgba(158,204,255,0.2),transparent_28%),linear-gradient(180deg,rgba(238,247,255,0.96),rgba(244,249,255,0.98)_32%,rgba(244,249,255,0.98))]" />

        <header className="relative z-10 px-4 pt-5 pb-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2.5">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0 rounded-full border-border/70 bg-background/88 shadow-none lg:hidden"
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  aria-label="打开会话侧栏"
                >
                  <PanelLeftOpenIcon />
                </Button>
                <div className="inline-flex min-w-0 items-center gap-2 text-[0.7rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
                  <SparklesIcon className="size-3.5" />
                  Tim2354-WebAI
                </div>
              </div>
              <div className="space-y-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex min-h-9 min-w-[12rem] items-center justify-between gap-3 rounded-full border border-slate-300/75 bg-transparent px-3.5 py-1.5 text-left text-[0.83rem] font-medium text-slate-600 transition-colors hover:border-slate-400/85 hover:bg-white/35 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70"
                        aria-label="选择模型"
                      />
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {selectedModel ? (
                        <ModelIcon
                          model={selectedModel}
                          className="shrink-0 text-slate-500"
                        />
                      ) : (
                        <BotIcon className="size-4 shrink-0 text-slate-400" />
                      )}
                      <span className="truncate text-[0.9rem]">
                        {selectedModel?.label ?? "默认模型"}
                      </span>
                    </span>
                    <ChevronDownIcon className="size-4 shrink-0 text-slate-400" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="bottom"
                    align="start"
                    sideOffset={10}
                    className="w-[22rem] rounded-2xl border border-border/70 bg-white/96 p-1.5 shadow-[0_18px_50px_rgba(58,84,132,0.12)] backdrop-blur-xl"
                  >
                    {Object.entries(groupedModels).map(([groupName, models], index) => (
                      <div key={groupName}>
                        {index > 0 ? <DropdownMenuSeparator className="mx-2 my-1.5" /> : null}
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="px-3 pt-2 pb-1 text-[0.7rem] tracking-[0.16em] uppercase">
                            {groupName}
                          </DropdownMenuLabel>
                          {models.map((model) => {
                            const isActive = model.id === selectedModelId;
                            const capabilitySummary = [
                              model.capabilities.reasoning ? "推理" : null,
                              model.capabilities.image ? "图像" : null,
                              model.capabilities.audio ? "音频" : null,
                              model.capabilities.video ? "视频" : null,
                              model.capabilities.webSearch ? "联网" : null,
                              model.capabilities.functionCalling ? "工具" : null,
                            ].filter(Boolean);

                            return (
                              <DropdownMenuItem
                                key={model.id}
                                className="items-start rounded-xl px-3 py-2.5"
                                onClick={() => setSelectedModelId(model.id)}
                              >
                                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                                    <ModelIcon
                                      model={model}
                                      className="mt-0.5 size-5 shrink-0 text-slate-500"
                                    />
                                    <div className="min-w-0 space-y-1">
                                      <div className="truncate text-sm font-medium text-foreground">
                                        {model.label}
                                      </div>
                                      <div className="text-xs leading-5 text-muted-foreground">
                                        {capabilitySummary.length > 0
                                          ? capabilitySummary.join(" · ")
                                          : model.provider === "gemini"
                                            ? "Gemini 原生模型"
                                            : "OpenAI 兼容模型"}
                                      </div>
                                    </div>
                                  </div>
                                  {isActive ? (
                                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-slate-900 text-white">
                                      <CheckIcon className="size-3.5" />
                                    </span>
                                  ) : null}
                                </div>
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuGroup>
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground"
              type="button"
              aria-label="编辑会话级提示词"
            >
              <NotebookPenIcon className="size-4.5" />
            </Button>
          </div>
        </header>

        {workspaceError ? (
          <div className="relative z-10 px-4 pt-4 pb-3 sm:px-6 lg:px-8">
            <Alert
              variant="destructive"
              className="rounded-[20px] border-red-200/80 bg-red-50/88 text-red-700 shadow-none"
              role="alert"
            >
              <AlertCircleIcon className="size-4" />
              <AlertTitle>工作区提醒</AlertTitle>
              <AlertDescription>{workspaceError}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <section
          className={`relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden ${
            hasMessages ? "px-3 pb-5 sm:px-5 lg:px-8" : "px-4 pb-8 sm:px-6 lg:px-8"
          }`}
        >
          <MessageList
            messages={messages}
            messageEndRef={messageEndRef}
            scrollContainerRef={scrollContainerRef}
            loadingHint={isLoadingConversation ? "请稍等，我们正在从数据库同步当前会话。" : null}
            onScroll={handleScroll}
            showJumpToLatest={showJumpToLatest}
            onJumpToLatest={() => scrollToLatest()}
          />
          <div className="relative z-20 shrink-0 pt-4">
            {hasMessages ? (
              <div className="pointer-events-none absolute inset-x-0 -top-8 h-10 bg-gradient-to-t from-background/88 to-transparent" />
            ) : null}
            <div className="mx-auto w-full max-w-4xl">
              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSendMessage}
                isSubmitting={isSubmitting}
                hasMessages={hasMessages}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
