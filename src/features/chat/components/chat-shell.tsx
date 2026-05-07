"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircleIcon } from "lucide-react";
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
import { AIModel } from "@/lib/schemas/model";
import { AuthPanel } from "./auth-panel";
import { ChatHeader } from "./chat-header";
import { ConversationSidebar } from "./conversation-sidebar";
import { ChatInput } from "./chat-input";
import { useChatSession } from "../hooks/use-chat-session";
import { useFetchedModels } from "../hooks/use-fetched-models";
import { useChatWorkspace } from "../hooks/use-chat-workspace";
import { useMessageScroll } from "../hooks/use-message-scroll";
import { copyTextToClipboard } from "../lib/clipboard";
import { useGeminiRuntimeConfig } from "../lib/gemini-runtime-config";
import type { EditMessageUpdate } from "./message-bubble";
import { MessageList } from "./message-list";
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

// 前端链路既可能抛 Error，也可能抛非 Error 值，需要统一收口成人类可读消息。
function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "暂时无法完成操作，请稍后再试。";
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
  const {
    geminiRuntimeConfig,
    saveGeminiRuntimeConfig,
    clearGeminiRuntimeConfig,
  } = useGeminiRuntimeConfig(user?.id);
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

  const activeGeminiRuntimeConfig =
    Object.keys(geminiRuntimeConfig).length > 0
      ? geminiRuntimeConfig
      : undefined;

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

  const {
    fetchedModels,
    isLoadingFetchedModels,
    isFetchingGeminiModels,
    updatingFetchedModelId,
    loadFetchedModels,
    fetchGeminiModels,
    updateFetchedModel,
    deleteFetchedModel,
  } = useFetchedModels({
    enabled: Boolean(user),
    onAvailableModelsSynced: syncAvailableModels,
    onRuntimeConfigSaved: saveGeminiRuntimeConfig,
    onWorkspaceError: setWorkspaceError,
    onWorkspaceNotice: showWorkspaceNotice,
  });

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
    saveGeminiRuntimeConfig(nextConfig);
  }

  async function handleFetchGeminiModels(config: GeminiRuntimeConfig) {
    await fetchGeminiModels(config);
  }

  async function handleUpdateFetchedModel(
    modelId: string,
    updates: {
      isEnabled?: boolean;
      isDefault?: boolean;
    },
  ) {
    await updateFetchedModel(modelId, updates);
  }

  async function handleDeleteFetchedModel(modelId: string) {
    await deleteFetchedModel(modelId);
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

      clearGeminiRuntimeConfig();
      setUser(null);
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
      await copyTextToClipboard(message.content);
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

          <ChatHeader
            activeConversation={activeConversation}
            activeConversationId={activeConversationId}
            availableModels={availableModels}
            selectedModel={selectedModel}
            selectedModelId={selectedModelId}
            currentSystemPrompt={currentSystemPrompt}
            isTogglingFavorite={isTogglingFavorite}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            onSelectModel={handleSelectModel}
            onToggleFavoriteConversation={handleToggleFavoriteConversation}
            onOpenPromptDialog={() => handlePromptDialogOpenChange(true)}
          />

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
