"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  GlobeIcon,
  NotebookPenIcon,
  PanelLeftOpenIcon,
  SparklesIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { chatSessionResponseSchema } from "@/lib/schemas/chat";
import { AuthUser } from "@/lib/schemas/auth";
import {
  Conversation,
  conversationResponseSchema,
} from "@/lib/schemas/conversation";
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

function getDefaultModelId(models: AIModel[]) {
  return models.find((model) => model.isDefault)?.id ?? models[0]?.id ?? null;
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
  const [draftModelId, setDraftModelId] = useState<string | null>(
    getDefaultModelId(initialModels),
  );
  const [draftSystemPrompt, setDraftSystemPrompt] = useState<string | null>(null);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [promptEditorValue, setPromptEditorValue] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const {
    inputValue,
    isSubmitting,
    setInputValue,
    getMessages,
    handleSubmit,
    stopStreaming,
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
  const selectedModelId = activeConversation?.modelId ?? draftModelId;
  const currentSystemPrompt = activeConversation?.systemPrompt ?? draftSystemPrompt;
  const selectedModel = availableModels.find(
    (model) => model.id === selectedModelId,
  ) ?? (
    availableModels.find((model) => model.isDefault) ?? availableModels[0] ?? null
  );
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

  function resetDraftConversationControls(models = availableModels) {
    setDraftModelId(getDefaultModelId(models));
    setDraftSystemPrompt(null);
  }

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
   * 但首条消息发送前如果已有草稿控制项，会在这里把 model / system prompt 一并落进去。
   */
  async function createConversation(options?: {
    activate?: boolean;
    modelId?: string | null;
    systemPrompt?: string | null;
    consumeDraftControls?: boolean;
  }) {
    setIsCreatingConversation(true);
    setWorkspaceError(null);

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          modelId: options?.modelId ?? undefined,
          systemPrompt: options?.systemPrompt ?? undefined,
        }),
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

      if (options?.consumeDraftControls) {
        resetDraftConversationControls();
      }

      return parsed.conversation;
    } finally {
      setIsCreatingConversation(false);
    }
  }

  // 管理客户端挂载后的模型列表同步。
  // 当前实现只在首次挂载时请求 /api/models，并在结果返回后校正可用模型和草稿默认值。
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
        setDraftModelId((current) => {
          if (current && parsed.models.some((model) => model.id === current)) {
            return current;
          }

          return getDefaultModelId(parsed.models);
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
        // 因此前端可以一次同步标题、system prompt、modelId 和完整消息列表。
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

  async function patchConversationControls(
    conversationId: string,
    updates: { modelId?: string; systemPrompt?: string },
  ) {
    const response = await fetch(`/api/conversations/${conversationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "更新会话设置失败。");
    }

    return conversationResponseSchema.parse(payload).conversation;
  }

  async function handleSelectModel(modelId: string) {
    setWorkspaceError(null);

    if (!activeConversationId || !activeConversation) {
      setDraftModelId(modelId);
      return;
    }

    const previousConversation = activeConversation;
    upsertConversation({
      ...activeConversation,
      modelId,
    });

    try {
      const nextConversation = await patchConversationControls(
        activeConversationId,
        {
          modelId,
        },
      );
      upsertConversation(nextConversation);
    } catch (error) {
      upsertConversation(previousConversation);
      setWorkspaceError(getErrorMessage(error));
    }
  }

  function handlePromptDialogOpenChange(nextOpen: boolean) {
    setIsPromptDialogOpen(nextOpen);
    setWorkspaceError(null);

    if (nextOpen) {
      setPromptEditorValue(currentSystemPrompt ?? "");
      return;
    }

    setPromptEditorValue("");
  }

  async function handleSaveSystemPrompt() {
    const trimmedPrompt = promptEditorValue.trim();
    const nextSystemPrompt = trimmedPrompt || null;

    setIsSavingPrompt(true);
    setWorkspaceError(null);

    try {
      if (!activeConversationId || !activeConversation) {
        setDraftSystemPrompt(nextSystemPrompt);
      } else {
        const nextConversation = await patchConversationControls(
          activeConversationId,
          {
            systemPrompt: nextSystemPrompt ?? "",
          },
        );
        upsertConversation(nextConversation);
      }

      setIsPromptDialogOpen(false);
      setPromptEditorValue("");
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
    } finally {
      setIsSavingPrompt(false);
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
        setActiveConversationId((activeId) => {
          if (activeId !== conversationId) {
            return activeId;
          }

          const nextActiveConversationId = remaining[0]?.id ?? null;

          if (!nextActiveConversationId) {
            resetDraftConversationControls();
          }

          return nextActiveConversationId;
        });

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
      resetDraftConversationControls(initialModels);
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

    // 首条消息发送时允许“先配置控制项，后建会话”。
    // 这样空白工作区不会因为试选模型或编辑提示词而污染数据库。
    try {
      const conversation = await createConversation({
        activate: true,
        modelId: draftModelId ?? undefined,
        systemPrompt: draftSystemPrompt ?? undefined,
        consumeDraftControls: true,
      });
      return conversation.id;
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
      return null;
    }
  }

  async function handleSendMessage() {
    setWorkspaceError(null);

    const conversationId = await ensureConversationId();

    if (!conversationId) {
      return;
    }

    await handleSubmit({
      conversationId,
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
    <>
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
                          {index > 0 ? (
                            <DropdownMenuSeparator className="mx-2 my-1.5" />
                          ) : null}
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
                                  onClick={() => {
                                    void handleSelectModel(model.id);
                                  }}
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

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full border-border/70 bg-background/82 text-muted-foreground shadow-none disabled:opacity-60"
                  type="button"
                  disabled
                  aria-label="联网搜索功能暂不可用"
                  title={
                    selectedModel?.capabilities.webSearch
                      ? "联网搜索功能将在后续阶段接入。"
                      : "当前模型暂不支持联网搜索。"
                  }
                >
                  <GlobeIcon className="size-4.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className={`rounded-full shadow-none ${
                    currentSystemPrompt?.trim()
                      ? "border-sky-200/90 bg-sky-50/88 text-sky-700 hover:bg-sky-100/82"
                      : "border-border/70 bg-background/82 text-muted-foreground"
                  }`}
                  type="button"
                  onClick={() => handlePromptDialogOpenChange(true)}
                  aria-label="编辑会话级提示词"
                  title={
                    currentSystemPrompt?.trim()
                      ? "当前会话已设置提示词。"
                      : "为当前会话设置提示词。"
                  }
                >
                  <NotebookPenIcon className="size-4.5" />
                </Button>
              </div>
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
                  onStop={stopStreaming}
                  isSubmitting={isSubmitting}
                />
              </div>
            </div>
          </section>
        </main>
      </div>

      <Dialog
        open={isPromptDialogOpen}
        onOpenChange={handlePromptDialogOpenChange}
      >
        <DialogContent
          className="flex aspect-square max-h-[calc(100vh-2rem)] max-w-none flex-col gap-0 overflow-hidden rounded-[24px] border border-border/70 bg-white/97 p-0 shadow-[0_28px_64px_rgba(46,79,134,0.14)] sm:max-w-none"
          style={{
            width: "min(calc(100vw - 2rem), 40rem, calc(100vh - 2rem))",
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="pt-1 text-[1.18rem] leading-none tracking-[-0.02em] text-foreground">
              会话级提示词
            </DialogTitle>
            <DialogDescription className="text-sm leading-7 text-muted-foreground">
              它只作用于当前这次对话。若当前还是空白首页，则会先保存在本页草稿里，直到你真正发送第一条消息。
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
            <Textarea
              value={promptEditorValue}
              onChange={(event) => setPromptEditorValue(event.target.value)}
              placeholder="例如：请默认用简洁、结构化的中文回答。"
              className="min-h-0 flex-1 resize-none overflow-y-auto rounded-[20px] border-border/80 bg-slate-50/55 px-5 py-4 text-[0.95rem] leading-8 shadow-none [field-sizing:fixed]"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              当前长度：{promptEditorValue.trim().length} / 2000
            </p>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 rounded-b-[24px] border-t border-border/70 bg-slate-50/72 px-6 py-4.5">
            <Button
              variant="outline"
              type="button"
              className="rounded-full border-slate-200/85 bg-white/70 px-5"
              onClick={() => handlePromptDialogOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="rounded-full px-5"
              onClick={() => void handleSaveSystemPrompt()}
              disabled={isSavingPrompt || promptEditorValue.trim().length > 2000}
            >
              {isSavingPrompt ? "保存中..." : "保存"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
