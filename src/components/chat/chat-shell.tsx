"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  NotebookPenIcon,
  PanelLeftOpenIcon,
  StarIcon,
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
import { AuthUser } from "@/lib/schemas/auth";
import { GeminiRuntimeConfig, MessageAttachment } from "@/lib/schemas/chat";
import { Conversation } from "@/lib/schemas/conversation";
import {
  AIModel,
  FetchedModel,
  fetchedModelListResponseSchema,
  fetchGeminiModelsResponseSchema,
} from "@/lib/schemas/model";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { AuthPanel } from "./auth-panel";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatInput } from "./chat-input";
import type { EditMessageUpdate } from "./message-bubble";
import { MessageList } from "./message-list";
import { ModelIcon } from "./model-icon";
import { useChatSession } from "./use-chat-session";
import { useChatWorkspace } from "./use-chat-workspace";
import { useMessageScroll } from "./use-message-scroll";
import {
  WorkspaceNotice,
  WorkspaceNoticeState,
} from "./workspace-notice";

type ChatShellProps = {
  initialUser: AuthUser | null;
  initialConversations: Conversation[];
  initialModels: AIModel[];
  initialAuthMessage?: string | null;
  initialAuthMessageType?: "info" | "error";
};

const LEGACY_GEMINI_RUNTIME_CONFIG_STORAGE_KEY = "webai.gemini.runtimeConfig";

function getGeminiRuntimeConfigStorageKey(userId: string) {
  return `webai.gemini.runtimeConfig.${userId}`;
}

// 前端链路既可能抛 Error，也可能抛非 Error 值，需要统一收口成人类可读消息。
function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "暂时无法完成操作，请稍后再试。";
}

function normalizeGeminiRuntimeConfig(config: GeminiRuntimeConfig) {
  const apiKey = config.apiKey?.trim();
  const baseUrl = config.baseUrl?.trim();

  return {
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
}

function loadStoredGeminiRuntimeConfig(userId: string): GeminiRuntimeConfig {
  try {
    const rawConfig = window.localStorage.getItem(
      getGeminiRuntimeConfigStorageKey(userId),
    );

    if (!rawConfig) {
      return {};
    }

    const parsedConfig = JSON.parse(rawConfig) as GeminiRuntimeConfig;

    return normalizeGeminiRuntimeConfig({
      apiKey:
        typeof parsedConfig.apiKey === "string"
          ? parsedConfig.apiKey
          : undefined,
      baseUrl:
        typeof parsedConfig.baseUrl === "string"
          ? parsedConfig.baseUrl
          : undefined,
    });
  } catch {
    return {};
  }
}

function copyTextWithFallback(text: string) {
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    const copied = document.execCommand("copy");

    if (!copied) {
      throw new Error("复制失败，当前浏览器没有开放剪贴板权限。");
    }
  } finally {
    textarea.parentNode?.removeChild(textarea);
  }
}

/**
 * ChatShell 承担“页面壳组件”的职责：
 * 负责把工作区编排逻辑、消息交互逻辑和具体 UI 结构拼到一起。
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
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
  const [promptEditorValue, setPromptEditorValue] = useState("");
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [geminiRuntimeConfig, setGeminiRuntimeConfig] =
    useState<GeminiRuntimeConfig>({});
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [isLoadingFetchedModels, setIsLoadingFetchedModels] = useState(false);
  const [isFetchingGeminiModels, setIsFetchingGeminiModels] = useState(false);
  const [updatingFetchedModelId, setUpdatingFetchedModelId] =
    useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] =
    useState<WorkspaceNoticeState>(null);
  const {
    urlContextInputValue,
    urlContextUrls,
    draftAttachments,
    isUploadingAttachments,
    isUrlContextPanelOpen,
    isSubmitting,
    setUrlContextInputValue,
    setDraftAttachments,
    getMessages,
    handleSubmit,
    editMessageAndRegenerate,
    regenerateAssistantMessage,
    stopStreaming,
    addUrlContextUrl,
    removeUrlContextUrl,
    toggleUrlContextPanel,
    uploadAttachments,
    syncConversationMessages,
    removeConversationMessages,
  } = useChatSession();
  const {
    conversations,
    archivedConversations,
    favoriteConversations,
    activeConversation,
    activeConversationId,
    selectedModelId,
    selectedModel,
    currentSystemPrompt,
    currentWebSearchEnabled,
    currentThinkingLevel,
    availableModels,
    syncAvailableModels,
    workspaceError,
    isCreatingConversation,
    isDeletingConversationId,
    isArchivingConversationId,
    isRestoringConversationId,
    isLoadingArchivedConversations,
    isLoadingFavoriteConversations,
    isTogglingFavorite,
    isLoadingConversation,
    setActiveConversationId,
    setWorkspaceError,
    handleCreateConversation,
    handleRenameConversation,
    handleDeleteConversation,
    handleArchiveConversation,
    handleRestoreConversation,
    handleBranchConversation,
    handleSelectModel,
    handleSelectThinkingLevel,
    handleToggleFavoriteConversation,
    loadArchivedConversations,
    loadFavoriteConversations,
    saveSystemPrompt,
    toggleWebSearchEnabled,
    ensureConversationId,
    upsertConversation,
    resetAfterSignOut,
  } = useChatWorkspace({
    initialConversations,
    initialModels,
    syncConversationMessages,
    removeConversationMessages,
  });
  const messages = getMessages(activeConversationId);
  const {
    messageEndRef,
    scrollContainerRef,
    showJumpToLatest,
    handleScroll,
    handleWheelCapture,
    handleTouchStartCapture,
    handleTouchMoveCapture,
    scrollToLatest,
  } = useMessageScroll({ messages });
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (!user?.id) {
      setGeminiRuntimeConfig({});
      return;
    }

    // Gemini Key / URL 属于用户本机运行时配置，只保存在浏览器 localStorage。
    // storage key 按用户隔离，避免多人共用同一浏览器时沿用上一个账号的端点配置。
    window.localStorage.removeItem(LEGACY_GEMINI_RUNTIME_CONFIG_STORAGE_KEY);
    setGeminiRuntimeConfig(loadStoredGeminiRuntimeConfig(user.id));
  }, [user?.id]);

  const activeGeminiRuntimeConfig =
    Object.keys(geminiRuntimeConfig).length > 0
      ? geminiRuntimeConfig
      : undefined;

  const syncFetchedModelState = useCallback((models: FetchedModel[]) => {
    // Gemini 设置弹窗看到的是完整列表；聊天顶部模型选择只接收已启用模型。
    // 两层状态在同一个入口同步，避免 UI 勾选状态和实际可调用模型产生漂移。
    setFetchedModels(models);
    syncAvailableModels(models.filter((model) => model.isEnabled));
  }, [syncAvailableModels]);

  const showWorkspaceNotice = useCallback((
    notice: NonNullable<WorkspaceNoticeState>,
    duration?: number,
  ) => {
    setWorkspaceNotice(notice);

    if (!duration) {
      return;
    }

    window.setTimeout(() => {
      setWorkspaceNotice((current) =>
        current?.id === notice.id ? null : current,
      );
    }, duration);
  }, []);

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
      await saveSystemPrompt(nextSystemPrompt);
      setIsPromptDialogOpen(false);
      setPromptEditorValue("");
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
    } finally {
      setIsSavingPrompt(false);
    }
  }

  function handleSaveGeminiRuntimeConfig(nextConfig: GeminiRuntimeConfig) {
    const normalizedConfig = normalizeGeminiRuntimeConfig(nextConfig);

    setGeminiRuntimeConfig(normalizedConfig);

    if (!user?.id) {
      return;
    }

    const storageKey = getGeminiRuntimeConfigStorageKey(user.id);

    if (Object.keys(normalizedConfig).length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify(normalizedConfig),
    );
  }

  const loadFetchedModels = useCallback(async () => {
    setIsLoadingFetchedModels(true);
    setWorkspaceError(null);

    try {
      const response = await fetch("/api/models/fetched");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "模型列表读取失败。");
      }

      const parsed = fetchedModelListResponseSchema.parse(payload);
      syncFetchedModelState(parsed.models);
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    } finally {
      setIsLoadingFetchedModels(false);
    }
  }, [setWorkspaceError, syncFetchedModelState]);

  async function handleFetchGeminiModels(config: GeminiRuntimeConfig) {
    const normalizedConfig = normalizeGeminiRuntimeConfig(config);

    if (!normalizedConfig.apiKey) {
      throw new Error("请先填写 API Key。");
    }

    // 拉取动作同时保存本机配置，后续聊天请求可以继续使用同一组 Key / URL。
    handleSaveGeminiRuntimeConfig(normalizedConfig);
    setIsFetchingGeminiModels(true);
    setWorkspaceError(null);

    try {
      const response = await fetch("/api/models/gemini/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedConfig),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "拉取 Gemini 模型失败。");
      }

      const parsed = fetchGeminiModelsResponseSchema.parse(payload);
      syncFetchedModelState(parsed.models);
      showWorkspaceNotice({
        id: Date.now(),
        type: "success",
        title: "模型已更新",
        description: `拉取 ${parsed.summary.fetched} 个，写入 ${parsed.summary.upserted} 个，跳过 ${parsed.summary.skipped} 个。`,
      }, 3600);
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    } finally {
      setIsFetchingGeminiModels(false);
    }
  }

  async function handleUpdateFetchedModel(
    modelId: string,
    updates: {
      isEnabled?: boolean;
      isDefault?: boolean;
    },
  ) {
    setUpdatingFetchedModelId(modelId);
    setWorkspaceError(null);

    try {
      // 启用、默认与删除都让服务端返回完整模型列表。
      // 前端不局部猜测结果，避免浏览器重复实现默认项唯一约束和不支持模型规则。
      const response = await fetch(`/api/models/fetched/${modelId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "模型更新失败。");
      }

      const parsed = fetchedModelListResponseSchema.parse(payload);
      syncFetchedModelState(parsed.models);
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    } finally {
      setUpdatingFetchedModelId(null);
    }
  }

  async function handleDeleteFetchedModel(modelId: string) {
    setUpdatingFetchedModelId(modelId);
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/models/fetched/${modelId}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "模型删除失败。");
      }

      const parsed = fetchedModelListResponseSchema.parse(payload);
      syncFetchedModelState(parsed.models);
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    } finally {
      setUpdatingFetchedModelId(null);
    }
  }

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadFetchedModels().catch(() => null);
  }, [loadFetchedModels, user]);

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

      if (user?.id) {
        window.localStorage.removeItem(
          getGeminiRuntimeConfigStorageKey(user.id),
        );
      }
      window.localStorage.removeItem(LEGACY_GEMINI_RUNTIME_CONFIG_STORAGE_KEY);
      setUser(null);
      setGeminiRuntimeConfig({});
      resetAfterSignOut();
      router.refresh();
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    } finally {
      setIsSigningOut(false);
    }
  }

  const handleSendMessage = useCallback(async (
    content: string,
    attachments?: MessageAttachment[],
    urls?: string[],
  ) => {
    setWorkspaceError(null);

    const conversationId = await ensureConversationId();

    if (!conversationId) {
      return;
    }

    await handleSubmit({
      conversationId,
      content,
      urls,
      attachments,
      selectedModelId,
      thinkingLevel: currentThinkingLevel,
      geminiRuntimeConfig: activeGeminiRuntimeConfig,
      // handleSubmit 只知道聊天接口返回了最新会话，
      // 具体怎么把它并回列表由 ChatShell 决定。
      onConversationSynced(conversation) {
        upsertConversation(conversation);
      },
    });
  }, [
    ensureConversationId,
    currentThinkingLevel,
    activeGeminiRuntimeConfig,
    handleSubmit,
    selectedModelId,
    setWorkspaceError,
    upsertConversation,
  ]);

  const handleCopyMessage = useCallback(async (message: { content: string }) => {
    setWorkspaceError(null);

    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(message.content);
          return;
        } catch {
          copyTextWithFallback(message.content);
          return;
        }
      }

      copyTextWithFallback(message.content);
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
      throw error;
    }
  }, [setWorkspaceError]);

  const handleEditMessage = useCallback(async (
    message: { id: string },
    update: EditMessageUpdate,
  ) => {
    setWorkspaceError(null);

    if (!activeConversationId) {
      return;
    }

    try {
      await editMessageAndRegenerate({
        conversationId: activeConversationId,
        messageId: message.id,
        content: update.content,
        urls: update.urls,
        attachments: update.attachments,
        selectedModelId,
        thinkingLevel: currentThinkingLevel,
        geminiRuntimeConfig: activeGeminiRuntimeConfig,
        onConversationSynced(conversation) {
          upsertConversation(conversation);
        },
      });
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
    }
  }, [
    activeConversationId,
    activeGeminiRuntimeConfig,
    currentThinkingLevel,
    editMessageAndRegenerate,
    selectedModelId,
    setWorkspaceError,
    upsertConversation,
  ]);

  const handleBranchFromMessage = useCallback(async (message: { id: string }) => {
    setWorkspaceError(null);

    if (!activeConversationId) {
      return;
    }

    const noticeId = Date.now();
    showWorkspaceNotice({
      id: noticeId,
      type: "loading",
      title: "正在创建对话分支",
      description: "正在复制当前上下文。",
    });

    try {
      await handleBranchConversation(activeConversationId, message.id);
      showWorkspaceNotice({
        id: noticeId + 1,
        type: "success",
        title: "分支已创建",
        description: "已切换到新的对话分支。",
      }, 2200);
    } catch (error) {
      const message = getErrorMessage(error);
      showWorkspaceNotice({
        id: noticeId + 2,
        type: "error",
        title: "分支创建失败",
        description: message,
      }, 3200);
    }
  }, [
    activeConversationId,
    handleBranchConversation,
    setWorkspaceError,
    showWorkspaceNotice,
  ]);

  const handleRegenerateMessage = useCallback(async (message: { id: string }) => {
    setWorkspaceError(null);

    if (!activeConversationId) {
      return;
    }

    try {
      await regenerateAssistantMessage({
        conversationId: activeConversationId,
        messageId: message.id,
        selectedModelId,
        thinkingLevel: currentThinkingLevel,
        webSearchEnabled: currentWebSearchEnabled,
        geminiRuntimeConfig: activeGeminiRuntimeConfig,
        urls: urlContextUrls,
        onConversationSynced(conversation) {
          upsertConversation(conversation);
        },
      });
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
    }
  }, [
    activeConversationId,
    activeGeminiRuntimeConfig,
    currentThinkingLevel,
    currentWebSearchEnabled,
    regenerateAssistantMessage,
    selectedModelId,
    setWorkspaceError,
    upsertConversation,
    urlContextUrls,
  ]);

  const handleJumpToLatest = useCallback(() => {
    scrollToLatest();
  }, [scrollToLatest]);

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
      <WorkspaceNotice notice={workspaceNotice} />
      <div className="flex h-[100dvh] overflow-hidden bg-background lg:flex-row">
        <ConversationSidebar
          conversations={conversations}
          archivedConversations={archivedConversations}
          favoriteConversations={favoriteConversations}
          activeConversationId={activeConversationId}
          isCreating={isCreatingConversation}
          isDeletingConversationId={isDeletingConversationId}
          isArchivingConversationId={isArchivingConversationId}
          isRestoringConversationId={isRestoringConversationId}
          isLoadingArchivedConversations={isLoadingArchivedConversations}
          isLoadingFavoriteConversations={isLoadingFavoriteConversations}
          fetchedModels={fetchedModels}
          isLoadingFetchedModels={isLoadingFetchedModels}
          isFetchingGeminiModels={isFetchingGeminiModels}
          updatingFetchedModelId={updatingFetchedModelId}
          isSigningOut={isSigningOut}
          currentUserEmail={user.email}
          geminiRuntimeConfig={geminiRuntimeConfig}
          mobileOpen={isMobileSidebarOpen}
          onMobileOpenChange={setIsMobileSidebarOpen}
          onCreateConversation={handleCreateConversation}
          onSelectConversation={setActiveConversationId}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onArchiveConversation={handleArchiveConversation}
          onRestoreConversation={handleRestoreConversation}
          onLoadArchivedConversations={loadArchivedConversations}
          onLoadFavoriteConversations={loadFavoriteConversations}
          onSaveGeminiRuntimeConfig={handleSaveGeminiRuntimeConfig}
          onLoadFetchedModels={loadFetchedModels}
          onFetchGeminiModels={handleFetchGeminiModels}
          onUpdateFetchedModel={handleUpdateFetchedModel}
          onDeleteFetchedModel={handleDeleteFetchedModel}
          onSignOut={handleSignOut}
        />

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(193,225,255,0.54),transparent_24%),radial-gradient(circle_at_top_center,rgba(158,204,255,0.2),transparent_28%),linear-gradient(180deg,rgba(238,247,255,0.96),rgba(244,249,255,0.98)_32%,rgba(244,249,255,0.98))]" />

          <header className="relative z-10 px-4 pt-4 pb-3 sm:px-6 lg:px-8">
            <div className="mx-auto grid min-h-9 w-full max-w-4xl grid-cols-[auto_1fr_auto] items-center gap-3">
              <div className="flex items-center justify-start">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="h-9 w-10 shrink-0 rounded-[12px] border-border/70 bg-background/88 shadow-none lg:hidden"
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  aria-label="打开会话侧栏"
                >
                  <PanelLeftOpenIcon className="size-4" />
                </Button>
              </div>

              <div className="flex min-w-0 justify-start">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex h-9 w-[min(62vw,15rem)] items-center justify-between gap-2.5 rounded-[13px] border border-slate-300/70 bg-white/26 px-3 text-left text-[0.8rem] font-medium text-slate-600 transition-colors hover:border-slate-400/80 hover:bg-white/42 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70"
                        aria-label="选择模型"
                      />
                    }
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {selectedModel ? (
                        <ModelIcon
                          model={selectedModel}
                          className="size-4 shrink-0 text-slate-500"
                        />
                      ) : (
                        <BotIcon className="size-4 shrink-0 text-slate-400" />
                      )}
                      <span className="truncate text-[0.84rem]">
                        {selectedModel?.label ?? "默认模型"}
                      </span>
                    </span>
                    <ChevronDownIcon className="size-3.5 shrink-0 text-slate-400" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="bottom"
                    align="start"
                    sideOffset={9}
                    className="w-[22rem] rounded-[16px] border border-border/70 bg-white/96 p-1.5 shadow-[0_18px_50px_rgba(58,84,132,0.12)] backdrop-blur-xl"
                  >
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="px-3 pt-2 pb-1 text-[0.7rem] tracking-[0.16em] uppercase">
                        Gemini
                      </DropdownMenuLabel>
                      {availableModels.map((model) => {
                        const isActive = model.id === selectedModelId;
                        const capabilitySummary = [
                          model.capabilities.reasoning ? "推理" : null,
                          model.capabilities.image ? "图像" : null,
                          model.capabilities.files ? "文件" : null,
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
                                      : "Gemini 原生模型"}
                                  </div>
                                </div>
                              </div>
                              {isActive ? (
                                <span className="inline-flex size-5 items-center justify-center rounded-[10px] bg-slate-900 text-white">
                                  <CheckIcon className="size-3.5" />
                                </span>
                              ) : null}
                            </div>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Tooltip
                  side="bottom"
                  content="收藏"
                >
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className={`h-9 w-10 rounded-[12px] shadow-none ${
                      activeConversation?.isFavorite
                        ? "border-amber-200/90 bg-amber-50/88 text-amber-600 hover:bg-amber-100/82"
                        : "border-border/70 bg-background/82 text-muted-foreground"
                    }`}
                    type="button"
                    onClick={() => void handleToggleFavoriteConversation()}
                    disabled={!activeConversationId || isTogglingFavorite}
                    aria-label={
                      activeConversation?.isFavorite ? "取消收藏会话" : "收藏会话"
                    }
                  >
                    <StarIcon
                      className="size-4"
                      fill={activeConversation?.isFavorite ? "currentColor" : "none"}
                    />
                  </Button>
                </Tooltip>
                <Tooltip
                  side="bottom"
                  content="修改提示词"
                >
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className={`h-9 w-10 rounded-[12px] shadow-none ${
                      currentSystemPrompt?.trim()
                        ? "border-sky-200/90 bg-sky-50/88 text-sky-700 hover:bg-sky-100/82"
                        : "border-border/70 bg-background/82 text-muted-foreground"
                    }`}
                    type="button"
                    onClick={() => handlePromptDialogOpenChange(true)}
                    aria-label="编辑会话级提示词"
                  >
                    <NotebookPenIcon className="size-4" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          </header>

          {workspaceError ? (
            <div className="relative z-10 px-4 pt-4 pb-3 sm:px-6 lg:px-8">
              <Alert
                variant="destructive"
                className="rounded-[16px] border-red-200/80 bg-red-50/88 text-red-700 shadow-none"
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
            {hasMessages ? (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-9 bg-gradient-to-b from-background/54 to-transparent" />
            ) : null}
            <MessageList
              messages={messages}
              messageEndRef={messageEndRef}
              scrollContainerRef={scrollContainerRef}
              loadingHint={isLoadingConversation ? "请稍等，我们正在从数据库同步当前会话。" : null}
              actionsDisabled={isSubmitting || isLoadingConversation}
              supportsImages={selectedModel?.capabilities.image ?? false}
              supportsFiles={selectedModel?.capabilities.files ?? false}
              isUploadingAttachments={isUploadingAttachments}
              onCopyMessage={handleCopyMessage}
              onEditMessage={handleEditMessage}
              onUploadAttachments={uploadAttachments}
              onBranchFromMessage={handleBranchFromMessage}
              onRegenerateMessage={handleRegenerateMessage}
              onScroll={handleScroll}
              onWheelCapture={handleWheelCapture}
              onTouchStartCapture={handleTouchStartCapture}
              onTouchMoveCapture={handleTouchMoveCapture}
              showJumpToLatest={showJumpToLatest}
              onJumpToLatest={handleJumpToLatest}
            />
            <div className="relative z-20 shrink-0 pt-4">
              {hasMessages ? (
                <div className="pointer-events-none absolute inset-x-0 -top-8 h-10 bg-gradient-to-t from-background/88 to-transparent" />
              ) : null}
              <div className="mx-auto w-full max-w-4xl">
                <ChatInput
                  webSearchEnabled={currentWebSearchEnabled}
                  urlContextInputValue={urlContextInputValue}
                  urlContextUrls={urlContextUrls}
                  attachments={draftAttachments}
                  isUrlContextPanelOpen={isUrlContextPanelOpen}
                  supportsWebSearch={selectedModel?.capabilities.webSearch ?? false}
                  supportsUrlContext={selectedModel?.capabilities.urlContext ?? false}
                  supportsImages={selectedModel?.capabilities.image ?? false}
                  supportsFiles={selectedModel?.capabilities.files ?? false}
                  supportsReasoning={selectedModel?.capabilities.reasoning ?? false}
                  thinkingLevel={currentThinkingLevel}
                  isUploadingAttachments={isUploadingAttachments}
                  onToggleWebSearch={toggleWebSearchEnabled}
                  onThinkingLevelChange={handleSelectThinkingLevel}
                  onUrlContextInputChange={setUrlContextInputValue}
                  onAttachmentsChange={setDraftAttachments}
                  onToggleUrlContextPanel={toggleUrlContextPanel}
                  onAddUrlContextUrl={addUrlContextUrl}
                  onRemoveUrlContextUrl={removeUrlContextUrl}
                  onUploadAttachments={uploadAttachments}
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
          className="flex aspect-square max-h-[calc(100vh-2rem)] max-w-none flex-col gap-0 overflow-hidden rounded-[18px] border border-border/70 bg-white/97 p-0 shadow-[0_28px_64px_rgba(46,79,134,0.14)] sm:max-w-none"
          style={{
            width: "min(calc(100vw - 2rem), 40rem, calc(100vh - 2rem))",
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="pt-1 text-[1.18rem] leading-none tracking-[-0.02em] text-foreground">
              会话级提示词
            </DialogTitle>
            <DialogDescription className="space-y-1 text-[0.8rem] leading-5 text-muted-foreground">
              <span className="block">它只作用于当前这次对话。</span>
              <span className="block">
                若当前还是空白首页，则会先保存在本页草稿里，直到你真正发送第一条消息。
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
            <Textarea
              value={promptEditorValue}
              onChange={(event) => setPromptEditorValue(event.target.value)}
              placeholder="例如：请默认用简洁、结构化的中文回答。"
              className="min-h-0 flex-1 resize-none rounded-[14px] border-border/80 bg-slate-50/55 px-5 py-4 text-[0.95rem] leading-8 shadow-none [field-sizing:fixed]"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              当前长度：{promptEditorValue.trim().length} / 2000
            </p>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 rounded-b-[18px] border-t border-border/70 bg-slate-50/72 px-6 py-4.5">
            <Button
              variant="outline"
              type="button"
              className="rounded-[12px] border-slate-200/85 bg-white/70 px-5"
              onClick={() => handlePromptDialogOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="rounded-[12px] px-5"
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
