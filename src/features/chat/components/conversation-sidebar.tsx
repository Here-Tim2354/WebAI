"use client";

import { useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CameraIcon,
  EllipsisIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  LogOutIcon,
  MessageSquareTextIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilLineIcon,
  PlusIcon,
  RefreshCwIcon,
  StarIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AuthUser } from "@/lib/schemas/auth";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GeminiRuntimeConfig } from "@/lib/schemas/chat";
import { Conversation } from "@/lib/schemas/conversation";
import { FetchedModel } from "@/lib/schemas/model";
import { PROTECTED_GEMINI_MODEL_IDS } from "@/lib/ai/gemini-model-catalog";

type ConversationSidebarProps = {
  conversations: Conversation[];
  archivedConversations: Conversation[];
  favoriteConversations: Conversation[];
  activeConversationId: string | null;
  isCreating: boolean;
  isDeletingConversationId: string | null;
  isArchivingConversationId: string | null;
  isRestoringConversationId: string | null;
  isLoadingArchivedConversations: boolean;
  isLoadingFavoriteConversations: boolean;
  fetchedModels: FetchedModel[];
  isLoadingFetchedModels: boolean;
  isFetchingGeminiModels: boolean;
  updatingFetchedModelId: string | null;
  isSigningOut: boolean;
  streamingConversationIds: string[];
  currentUser: AuthUser;
  geminiRuntimeConfig: GeminiRuntimeConfig;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onCreateConversation: () => Promise<void>;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onArchiveConversation: (conversationId: string) => Promise<void>;
  onRestoreConversation: (conversationId: string) => Promise<void>;
  onLoadArchivedConversations: () => Promise<void>;
  onLoadFavoriteConversations: () => Promise<void>;
  onSaveGeminiRuntimeConfig: (config: GeminiRuntimeConfig) => void;
  onLoadFetchedModels: () => Promise<void>;
  onFetchGeminiModels: (config: GeminiRuntimeConfig) => Promise<void>;
  onUpdateFetchedModel: (
    modelId: string,
    updates: {
      isEnabled?: boolean;
      isDefault?: boolean;
    },
  ) => Promise<void>;
  onDeleteFetchedModel: (modelId: string) => Promise<void>;
  onUpdateProfile: (displayName: string) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onUpdatePassword: (password: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

// 会话列表展示时间不需要精确到秒，统一收口成适合中文界面的简洁格式。
function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatFetchedModelCapabilities(model: FetchedModel) {
  const capabilities = model.capabilities;
  const labels: string[] = [];

  if (capabilities.webSearch || capabilities.googleSearch || capabilities.urlContext) {
    labels.push("联网");
  }

  if (capabilities.image || capabilities.video) {
    labels.push("视觉");
  }

  if (capabilities.audio) {
    labels.push("音频");
  }

  if (capabilities.files) {
    labels.push("文件");
  }

  if (capabilities.reasoning) {
    labels.push("思考");
  }

  if (capabilities.functionCalling || capabilities.tools) {
    labels.push("工具");
  }

  if (capabilities.structuredOutputs) {
    labels.push("结构化");
  }

  if (capabilities.codeExecution) {
    labels.push("代码");
  }

  return labels.length > 0 ? labels.slice(0, 4).join(" / ") : "文本";
}

function getAvatarFallback(user: AuthUser) {
  const name = user.displayName?.trim() || user.email?.trim();

  return name?.[0]?.toUpperCase() ?? <UserRoundIcon className="size-5" />;
}

function getAvatarImageSrc(avatarUrl: string | null) {
  if (!avatarUrl) {
    return null;
  }

  if (
    avatarUrl.startsWith("http://") ||
    avatarUrl.startsWith("https://") ||
    avatarUrl.startsWith("/")
  ) {
    return avatarUrl;
  }

  return `/api/profile/avatar?path=${encodeURIComponent(avatarUrl)}`;
}

function UserAvatar({
  user,
  className,
  imageClassName,
}: {
  user: AuthUser;
  className?: string;
  imageClassName?: string;
}) {
  const avatarSrc = getAvatarImageSrc(user.avatarUrl);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-[12px] border border-blue-200/80 bg-blue-50 text-sm font-semibold text-blue-700 shadow-[0_6px_18px_rgba(37,99,235,0.13)] ring-2 ring-white",
        className,
      )}
    >
      {avatarSrc ? (
        // 头像走受控 API 读取私有 Storage 对象，需要保留原生 img 的 cookie 请求行为。
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc}
          alt="用户头像"
          className={cn("size-full object-cover", imageClassName)}
        />
      ) : (
        getAvatarFallback(user)
      )}
    </span>
  );
}

function WebAILogo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-blue-200/80 bg-[linear-gradient(135deg,#eef6ff,#ffffff)] shadow-[0_6px_16px_rgba(37,99,235,0.1)]",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        className="size-6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9 27V12h3.8l2.4 8.8 2.9-8.8h3.4l2.9 8.8 2.4-8.8H31v15h-3.7v-8.4L24.8 27h-3.1L19.8 20 17.5 27h-3.1l-2.5-8.4V27H9Z"
          fill="#2563eb"
        />
        <circle cx="30.5" cy="10.5" r="3.5" fill="#60a5fa" />
        <path d="M27 31c3.2-6.7 6.8-10.4 11-12.2-6.5.6-10.9 3.3-14.5 8.4Z" fill="#0f172a" />
      </svg>
    </span>
  );
}

function getUserDisplayName(user: AuthUser) {
  return user.displayName?.trim() || user.email?.trim() || "WebAI 用户";
}

/**
 * 侧栏负责“会话导航”和“会话管理”两类交互：
 * 侧栏承接切换、新建、重命名、删除和退出登录等会话管理操作。
 */
export function ConversationSidebar({
  conversations,
  archivedConversations,
  favoriteConversations,
  activeConversationId,
  isCreating,
  isDeletingConversationId,
  isArchivingConversationId,
  isRestoringConversationId,
  isLoadingArchivedConversations,
  isLoadingFavoriteConversations,
  fetchedModels,
  isLoadingFetchedModels,
  isFetchingGeminiModels,
  updatingFetchedModelId,
  isSigningOut,
  streamingConversationIds,
  currentUser,
  geminiRuntimeConfig,
  mobileOpen,
  onMobileOpenChange,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onArchiveConversation,
  onRestoreConversation,
  onLoadArchivedConversations,
  onLoadFavoriteConversations,
  onSaveGeminiRuntimeConfig,
  onLoadFetchedModels,
  onFetchGeminiModels,
  onUpdateFetchedModel,
  onDeleteFetchedModel,
  onUpdateProfile,
  onUploadAvatar,
  onUpdatePassword,
  onSignOut,
}: ConversationSidebarProps) {
  const collapsedTrackClass =
    "lg:flex lg:size-11 lg:items-center lg:justify-center lg:self-center";
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<string | null>(
    null,
  );
  const [pendingDeleteConversation, setPendingDeleteConversation] =
    useState<Conversation | null>(null);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isFavoriteDialogOpen, setIsFavoriteDialogOpen] = useState(false);
  const [isGeminiSettingsDialogOpen, setIsGeminiSettingsDialogOpen] =
    useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [geminiApiKeyDraft, setGeminiApiKeyDraft] = useState("");
  const [geminiBaseUrlDraft, setGeminiBaseUrlDraft] = useState("");
  const [geminiSettingsError, setGeminiSettingsError] = useState<string | null>(
    null,
  );
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [passwordConfirmDraft, setPasswordConfirmDraft] = useState("");
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const streamingConversationIdSet = new Set(streamingConversationIds);

  // 重命名采用“局部编辑态 + 提交后调用父层 API”的模式，
  // 这样侧栏只关心输入交互，不直接碰数据访问细节。
  const handleRenameSubmit: React.FormEventHandler<HTMLFormElement> = async (
    event,
  ) => {
    event.preventDefault();

    const conversationId = editingConversationId;

    if (!conversationId) {
      return;
    }

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
  };

  async function handleCreateConversationClick() {
    try {
      await onCreateConversation();
      onMobileOpenChange(false);
    } catch {
      // 创建失败时保留抽屉，方便继续操作。
    }
  }

  function handleSelectConversation(conversationId: string) {
    onSelectConversation(conversationId);
    onMobileOpenChange(false);
  }

  async function handleConfirmDeleteConversation() {
    const conversation = pendingDeleteConversation;

    if (!conversation) {
      return;
    }

    setPendingDeleteConversation(null);

    try {
      await onDeleteConversation(conversation.id);
    } catch {
      // 删除失败由工作区顶部错误提示承接，不再用确认弹窗硬控用户。
    }
  }

  async function handleArchiveConversationClick(conversationId: string) {
    try {
      await onArchiveConversation(conversationId);
    } catch {
      // 归档失败时保留列表状态，由父层错误提示说明原因。
    }
  }

  async function handleOpenArchiveDialog() {
    setIsArchiveDialogOpen(true);
    await onLoadArchivedConversations();
  }

  async function handleOpenFavoriteDialog() {
    setIsFavoriteDialogOpen(true);
    await onLoadFavoriteConversations();
  }

  async function handleOpenGeminiSettingsDialog() {
    setGeminiApiKeyDraft(geminiRuntimeConfig.apiKey ?? "");
    setGeminiBaseUrlDraft(geminiRuntimeConfig.baseUrl ?? "");
    setGeminiSettingsError(null);
    setIsGeminiSettingsDialogOpen(true);
    await onLoadFetchedModels();
  }

  function handleOpenAccountDialog() {
    setDisplayNameDraft(currentUser.displayName ?? "");
    setPasswordDraft("");
    setPasswordConfirmDraft("");
    setAccountMessage(null);
    setAccountError(null);
    setIsAccountDialogOpen(true);
  }

  async function handleSaveProfile() {
    setAccountError(null);
    setAccountMessage(null);
    setIsSavingProfile(true);

    try {
      await onUpdateProfile(displayNameDraft.trim());
      setAccountMessage("资料已保存。");
    } catch (error) {
      setAccountError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "资料保存失败。",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleAvatarFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    setAccountError(null);
    setAccountMessage(null);
    setIsUploadingAvatar(true);

    try {
      await onUploadAvatar(file);
      setAccountMessage("头像已更新。");
    } catch (error) {
      setAccountError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "头像上传失败。",
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleSavePassword() {
    setAccountError(null);
    setAccountMessage(null);

    if (passwordDraft !== passwordConfirmDraft) {
      setAccountError("两次输入的密码不一致。");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      await onUpdatePassword(passwordDraft);
      setPasswordDraft("");
      setPasswordConfirmDraft("");
      setAccountMessage("密码已修改。");
    } catch (error) {
      setAccountError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "密码修改失败。",
      );
    } finally {
      setIsUpdatingPassword(false);
    }
  }

  function handleSaveGeminiSettings() {
    const nextBaseUrl = geminiBaseUrlDraft.trim();

    if (nextBaseUrl) {
      try {
        const parsedUrl = new URL(nextBaseUrl);

        if (parsedUrl.protocol !== "https:") {
          throw new Error("invalid protocol");
        }
      } catch {
        setGeminiSettingsError("Gemini URL 需要是合法的 https 地址。");
        return;
      }
    }

    onSaveGeminiRuntimeConfig({
      apiKey: geminiApiKeyDraft.trim() || undefined,
      baseUrl: nextBaseUrl || undefined,
    });
    setIsGeminiSettingsDialogOpen(false);
  }

  async function handleFetchGeminiModelsClick() {
    setGeminiSettingsError(null);

    try {
      await onFetchGeminiModels({
        apiKey: geminiApiKeyDraft.trim() || undefined,
        baseUrl: geminiBaseUrlDraft.trim() || undefined,
      });
    } catch (error) {
      setGeminiSettingsError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "拉取模型失败。",
      );
    }
  }

  async function handleToggleFetchedModel(model: FetchedModel) {
    setGeminiSettingsError(null);

    try {
      await onUpdateFetchedModel(model.id, {
        isEnabled: !model.isEnabled,
      });
    } catch (error) {
      setGeminiSettingsError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "模型状态更新失败。",
      );
    }
  }

  async function handleSetDefaultFetchedModel(model: FetchedModel) {
    setGeminiSettingsError(null);

    try {
      await onUpdateFetchedModel(model.id, {
        isDefault: true,
      });
    } catch (error) {
      setGeminiSettingsError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "默认模型更新失败。",
      );
    }
  }

  async function handleDeleteFetchedModel(model: FetchedModel) {
    setGeminiSettingsError(null);

    try {
      await onDeleteFetchedModel(model.id);
    } catch (error) {
      setGeminiSettingsError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "模型删除失败。",
      );
    }
  }

  async function handleRestoreConversationClick(conversationId: string) {
    try {
      await onRestoreConversation(conversationId);
    } catch {
      // 恢复失败时保留归档区，方便重试。
    }
  }

  async function handleSignOutClick() {
    try {
      await onSignOut();
      onMobileOpenChange(false);
    } catch {
      // 退出失败时保留工作区上下文。
    }
  }

  // 为了同时复用桌面端 aside 和移动端 Sheet，
  // 实际侧栏内容被抽成一个共享片段，避免维护两套会话列表 DOM。
  const sidebarContent = (
    <div className="flex h-full flex-col gap-4 overflow-x-hidden px-3 py-4 sm:px-4">
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          isCollapsed && "lg:grid lg:justify-center lg:justify-items-center lg:gap-4",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center gap-3",
            isCollapsed && "lg:hidden",
          )}
        >
          <WebAILogo />
          <div className={cn("min-w-0 self-center", isCollapsed && "lg:hidden")}>
            <strong className="block truncate text-sm font-medium text-foreground">
              WebAI
            </strong>
          </div>
        </div>

        <Button
          variant="ghost"
          className={cn(
            "hidden lg:inline-flex",
            isCollapsed &&
              `${collapsedTrackClass} lg:rounded-[8px] lg:border lg:border-border/70 lg:bg-muted/55 lg:shadow-none`,
          )}
          type="button"
          onClick={() => setIsCollapsed((current) => !current)}
          aria-label={isCollapsed ? "展开侧栏" : "收起侧栏"}
        >
          {isCollapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
        </Button>

        {isCollapsed ? (
          <WebAILogo className={cn("hidden", collapsedTrackClass)} />
        ) : null}
      </div>

      <Button
        className={cn(
          "h-10 w-full rounded-[8px] border border-border/70 bg-background/92 text-foreground shadow-none hover:bg-muted/70",
          isCollapsed && "lg:hidden",
        )}
        variant="outline"
        type="button"
        onClick={() => void handleCreateConversationClick()}
        disabled={isCreating}
      >
        <PlusIcon data-icon="inline-start" />
        <span>{isCreating ? "创建中..." : "新对话"}</span>
      </Button>

      {isCollapsed ? (
        <Button
          variant="ghost"
          className={cn(
            "hidden rounded-[8px] border border-border/70 bg-background/92 text-foreground shadow-none hover:bg-muted/70",
            collapsedTrackClass,
          )}
          type="button"
          onClick={() => void handleCreateConversationClick()}
          disabled={isCreating}
          aria-label={isCreating ? "正在创建对话" : "新对话"}
        >
          <PlusIcon className="size-5" />
        </Button>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col" aria-label="会话列表">
        <div
          className={cn(
            "mb-2 flex items-center justify-between gap-2 px-1",
            isCollapsed && "lg:justify-center lg:px-0",
          )}
        >
          <span
            className={cn(
              "text-[0.72rem] font-medium tracking-[0.18em] text-muted-foreground uppercase",
              isCollapsed && "lg:hidden",
            )}
          >
            最近对话
          </span>
          <Badge
            variant="secondary"
            className={cn("rounded-[7px] px-2 py-0.5", isCollapsed && "lg:hidden")}
          >
            {conversations.length}
          </Badge>
        </div>

        <ScrollArea
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-0.5 pr-1",
            isCollapsed && "lg:items-center lg:pr-0",
          )}
        >
          {conversations.length === 0 ? (
            <div
              className={cn(
                "rounded-[8px] border border-dashed border-border/75 bg-background/55 px-4 py-4 text-sm leading-6 text-muted-foreground",
                isCollapsed && "lg:hidden",
              )}
            >
              还没有对话。
            </div>
          ) : (
            conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;
              const isEditing = conversation.id === editingConversationId;
              const isDeleting = conversation.id === isDeletingConversationId;
              const isArchiving = conversation.id === isArchivingConversationId;
              const isStreaming = streamingConversationIdSet.has(conversation.id);

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "w-full rounded-[8px] border border-transparent bg-transparent transition-colors hover:bg-muted/40",
                    isActive && !isCollapsed &&
                      "border-border/70 bg-background/88",
                    isCollapsed && "lg:w-14",
                  )}
                >
                  {isEditing ? (
                    <form className="w-full p-3" onSubmit={handleRenameSubmit}>
                      <Input
                        autoFocus
                        value={titleDraft}
                        className="h-10 rounded-[8px] border-border/70 bg-background/92"
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onBlur={() => {
                          // blur 直接收口编辑态，保证点击其它会话或空白区时不会残留半编辑状态。
                          setEditingConversationId(null);
                          setTitleDraft("");
                        }}
                      />
                    </form>
                  ) : (
                    <div className={cn("flex w-full items-start gap-2 p-1.5", isCollapsed && "lg:block lg:p-0")}>
                      <button
                        className={cn(
                          "flex min-w-0 flex-1 items-start gap-3 rounded-[8px] px-3 py-2.5 text-left",
                          isCollapsed &&
                            "lg:size-14 lg:flex-none lg:items-center lg:justify-center lg:self-center lg:rounded-[8px] lg:px-0 lg:py-0",
                          isCollapsed && isActive && "lg:bg-muted/55",
                        )}
                        type="button"
                        title={conversation.title}
                        onClick={() => handleSelectConversation(conversation.id)}
                      >
                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-[8px] text-accent-foreground ring-1 ring-border/60",
                            isActive ? "bg-blue-50/90 text-primary" : "bg-background/88 text-muted-foreground",
                            isCollapsed && "lg:size-9 lg:rounded-[8px]",
                          )}
                        >
                          {isStreaming ? (
                            <LoaderCircleIcon className="size-4 animate-spin" />
                          ) : (
                            <MessageSquareTextIcon className="size-4" />
                          )}
                        </div>
                        <div className={cn("min-w-0 flex-1", isCollapsed && "lg:hidden")}>
                          <strong className="block truncate text-sm font-medium text-foreground">
                            {conversation.title}
                          </strong>
                          <span className="block text-xs text-muted-foreground">
                            {isStreaming ? "正在回复" : formatUpdatedAt(conversation.updatedAt)}
                          </span>
                        </div>
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className={cn(isCollapsed && "lg:hidden")}
                            />
                          }
                        >
                          <EllipsisIcon />
                          <span className="sr-only">对话操作</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" align="end" className="w-40">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingConversationId(conversation.id);
                                setTitleDraft(conversation.title);
                              }}
                              disabled={isStreaming}
                            >
                              <PencilLineIcon />
                              重命名
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                void handleArchiveConversationClick(conversation.id)
                              }
                              disabled={isArchiving || isStreaming}
                            >
                              <ArchiveIcon />
                              {isArchiving ? "归档中..." : "归档"}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setPendingDeleteConversation(conversation)}
                              disabled={isDeleting || isStreaming}
                            >
                              <Trash2Icon />
                              {isDeleting ? "删除中..." : "删除"}
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </ScrollArea>
      </section>

      <div
        className={cn(
          "flex items-center border-t border-border/60 px-1 pt-3",
          isCollapsed ? "lg:justify-center lg:px-0" : "justify-stretch",
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className={cn(
                  "h-auto w-full justify-start rounded-[8px] px-2 py-2 text-muted-foreground hover:bg-blue-50/80 hover:text-foreground",
                  isCollapsed && "lg:mx-auto lg:size-14 lg:px-0",
                )}
                type="button"
                aria-label="用户菜单"
              />
            }
          >
            <UserAvatar user={currentUser} className="size-11" />
            <span className={cn("ml-3 min-w-0 flex-1 text-left", isCollapsed && "lg:hidden")}>
              <span className="block truncate text-sm font-medium text-foreground">
                {getUserDisplayName(currentUser)}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {currentUser.email ?? "邮箱未显示"}
              </span>
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleOpenAccountDialog}>
                <UserRoundIcon />
                个人账户
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => void handleOpenFavoriteDialog()}>
                <StarIcon />
                收藏
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleOpenArchiveDialog()}>
                <ArchiveIcon />
                归档区
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleOpenGeminiSettingsDialog()}>
                <KeyRoundIcon />
                Gemini 设置
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void handleSignOutClick()}
                disabled={isSigningOut}
              >
                <LogOutIcon />
                {isSigningOut ? "退出中..." : "退出登录"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden border-r border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(245,249,255,0.9))] backdrop-blur-xl transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen",
          isCollapsed ? "lg:w-[5.75rem]" : "lg:w-[22rem]",
        )}
      >
        {sidebarContent}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[min(88vw,24rem)] border-r border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,249,255,0.98))] p-0 backdrop-blur-xl"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>会话侧栏</SheetTitle>
            <SheetDescription>查看、新建、切换和管理当前用户的历史会话。</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col overflow-hidden">{sidebarContent}</div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={isFavoriteDialogOpen}
        onOpenChange={(open) => {
          setIsFavoriteDialogOpen(open);
        }}
      >
        <DialogContent className="w-[min(92vw,42rem)] max-w-[42rem] overflow-hidden rounded-[10px] border border-border/70 bg-white/97 p-0 shadow-[0_24px_56px_rgba(46,79,134,0.12)] sm:!max-w-[42rem]">
          <DialogHeader className="px-7 pt-5 pb-3">
            <DialogTitle className="text-[1.15rem] leading-none font-medium tracking-normal text-foreground">
              收藏
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              查看你标记过的会话，点击后会直接跳转。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[24rem] overflow-y-auto border-t border-border/60 bg-slate-50/45 px-7 py-4">
            {isLoadingFavoriteConversations ? (
              <div className="py-4 text-sm text-muted-foreground">
                正在读取收藏会话...
              </div>
            ) : favoriteConversations.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">
                还没有收藏会话。
              </div>
            ) : (
              favoriteConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-[6px] px-3 py-2.5 text-left transition-colors hover:bg-white/80"
                  onClick={() => {
                    handleSelectConversation(conversation.id);
                    setIsFavoriteDialogOpen(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {conversation.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {conversation.favoritedAt
                        ? `收藏于 ${formatUpdatedAt(conversation.favoritedAt)}`
                        : formatUpdatedAt(conversation.updatedAt)}
                    </span>
                  </span>
                  <StarIcon
                    className="size-4 shrink-0 text-amber-500"
                    fill="currentColor"
                  />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isArchiveDialogOpen}
        onOpenChange={(open) => {
          setIsArchiveDialogOpen(open);
        }}
      >
        <DialogContent className="w-[min(92vw,42rem)] max-w-[42rem] overflow-hidden rounded-[10px] border border-border/70 bg-white/97 p-0 shadow-[0_24px_56px_rgba(46,79,134,0.12)] sm:!max-w-[42rem]">
          <DialogHeader className="px-7 pt-5 pb-3">
            <DialogTitle className="text-[1.15rem] leading-none font-medium tracking-normal text-foreground">
              归档区
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              归档后的会话不会出现在最近对话中，可以在这里恢复。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[24rem] overflow-y-auto border-t border-border/60 bg-slate-50/45 px-7 py-4">
            {isLoadingArchivedConversations ? (
              <div className="py-4 text-sm text-muted-foreground">
                正在读取归档会话...
              </div>
            ) : archivedConversations.length === 0 ? (
              <div className="py-4 text-sm text-muted-foreground">
                还没有归档会话。
              </div>
            ) : (
              archivedConversations.map((conversation) => {
                const isRestoring =
                  conversation.id === isRestoringConversationId;

                return (
                  <div
                    key={conversation.id}
                    className="flex items-center justify-between gap-3 rounded-[6px] px-3 py-2.5"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        handleSelectConversation(conversation.id);
                        setIsArchiveDialogOpen(false);
                      }}
                    >
                      <span className="block truncate text-sm font-medium text-foreground">
                        {conversation.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {conversation.archivedAt
                          ? `归档于 ${formatUpdatedAt(conversation.archivedAt)}`
                          : formatUpdatedAt(conversation.updatedAt)}
                      </span>
                    </button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-[6px] border-border/70 bg-white px-3 shadow-none"
                      type="button"
                      onClick={() =>
                        void handleRestoreConversationClick(conversation.id)
                      }
                      disabled={isRestoring}
                    >
                      <ArchiveRestoreIcon data-icon="inline-start" />
                      {isRestoring ? "恢复中" : "恢复"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAccountDialogOpen}
        onOpenChange={(open) => {
          setIsAccountDialogOpen(open);

          if (!open) {
            setAccountError(null);
            setAccountMessage(null);
          }
        }}
      >
        <DialogContent className="w-[min(92vw,42rem)] max-w-[42rem] overflow-hidden rounded-[10px] border border-border/70 bg-white/97 p-0 shadow-[0_24px_56px_rgba(46,79,134,0.12)] sm:!max-w-[42rem]">
          <DialogHeader className="px-7 pt-5 pb-3">
            <DialogTitle className="text-[1.15rem] leading-none font-medium tracking-normal text-foreground">
              个人账户
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              管理头像、昵称和登录密码。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 border-t border-border/60 bg-slate-50/45 px-7 py-4">
            <section className="flex flex-col items-start gap-4 sm:flex-row">
              <UserAvatar user={currentUser} className="size-14 rounded-[10px] text-base" />
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-base font-medium text-foreground">
                  {currentUser.displayName || currentUser.email || "WebAI 用户"}
                </strong>
                <span className="mt-1 block truncate text-sm text-muted-foreground">
                  {currentUser.email ?? "邮箱未显示"}
                </span>
                <div className="mt-3 flex justify-end">
                  <label className="inline-flex h-8 cursor-pointer items-center justify-center gap-2 rounded-[6px] border border-border/70 bg-white px-3 text-sm font-medium text-foreground shadow-none transition-colors hover:bg-muted/70">
                    {isUploadingAvatar ? (
                      <RefreshCwIcon className="size-4 animate-spin" />
                    ) : (
                      <CameraIcon className="size-4" />
                    )}
                    {isUploadingAvatar ? "上传中" : "更换头像"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => void handleAvatarFileChange(event)}
                      disabled={isUploadingAvatar}
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-muted-foreground">
                  昵称
                </span>
                <Input
                  value={displayNameDraft}
                  className="h-11 rounded-[6px] border-border/70 bg-white text-left"
                  placeholder="显示名称"
                  onChange={(event) => setDisplayNameDraft(event.target.value)}
                />
              </label>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-[6px] border-border/70 bg-white px-4 shadow-none"
                  onClick={() => void handleSaveProfile()}
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? "保存中" : "保存资料"}
                </Button>
              </div>
            </section>

            <section className="space-y-3 border-t border-border/60 pt-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <KeyRoundIcon className="size-4 text-muted-foreground" />
                修改密码
              </div>
              <Input
                type="password"
                value={passwordDraft}
                className="h-11 rounded-[6px] border-border/70 bg-white text-left"
                placeholder="新密码，至少 8 位"
                onChange={(event) => setPasswordDraft(event.target.value)}
              />
              <Input
                type="password"
                value={passwordConfirmDraft}
                className="h-11 rounded-[6px] border-border/70 bg-white text-left"
                placeholder="再次输入新密码"
                onChange={(event) => setPasswordConfirmDraft(event.target.value)}
              />
              <Button
                type="button"
                className="h-9 self-start rounded-[6px] px-4"
                onClick={() => void handleSavePassword()}
                disabled={
                  isUpdatingPassword ||
                  !passwordDraft ||
                  !passwordConfirmDraft
                }
              >
                {isUpdatingPassword ? "修改中" : "修改密码"}
              </Button>
            </section>

            {accountError ? (
              <p className="rounded-[6px] border border-red-100 bg-red-50 px-3 py-2 text-xs leading-5 text-red-600">
                {accountError}
              </p>
            ) : null}
            {accountMessage ? (
              <p className="rounded-[6px] border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
                {accountMessage}
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isGeminiSettingsDialogOpen}
        onOpenChange={(open) => {
          setIsGeminiSettingsDialogOpen(open);

          if (!open) {
            setGeminiSettingsError(null);
          }
        }}
      >
        <DialogContent
          className="flex max-h-[min(45rem,calc(100vh-2rem))] w-[min(92vw,52rem)] max-w-[52rem] flex-col overflow-hidden rounded-[10px] border border-border/70 bg-white/97 p-0 shadow-[0_24px_56px_rgba(46,79,134,0.12)] sm:!max-w-[52rem]"
          style={{
            width: "min(92vw, 52rem)",
            maxWidth: "min(92vw, 52rem)",
          }}
        >
          <DialogHeader className="px-7 pt-5 pb-3">
            <DialogTitle className="text-[1.15rem] leading-none font-medium tracking-normal text-foreground">
              Gemini
            </DialogTitle>
            <p className="text-sm leading-6 text-muted-foreground">
              当前仅支持Gemini端点格式。非Gemini模型暂不可用
            </p>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-hidden border-t border-border/60 bg-slate-50/45 px-7 py-4">
            <div className="space-y-3">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Key
                </span>
                <Input
                  type="password"
                  value={geminiApiKeyDraft}
                  className="h-11 rounded-[6px] border-border/70 bg-white"
                  placeholder="GEMINI_API_KEY"
                  onChange={(event) => setGeminiApiKeyDraft(event.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-muted-foreground">
                  URL
                </span>
                <Input
                  value={geminiBaseUrlDraft}
                  className="h-11 rounded-[6px] border-border/70 bg-white"
                  placeholder="https://generativelanguage.googleapis.com"
                  onChange={(event) => setGeminiBaseUrlDraft(event.target.value)}
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {isLoadingFetchedModels
                  ? "读取模型中"
                  : `${fetchedModels.length} 个模型`}
              </span>
              <Button
                variant="outline"
                className="h-9 rounded-[6px] border-border/70 bg-white px-4 shadow-none"
                type="button"
                onClick={() => void handleFetchGeminiModelsClick()}
                disabled={isFetchingGeminiModels}
              >
                <RefreshCwIcon
                  className={cn(
                    "size-4",
                    isFetchingGeminiModels && "animate-spin",
                  )}
                />
                {isFetchingGeminiModels ? "拉取中" : "拉取模型"}
              </Button>
            </div>
            <div className="max-h-[28rem] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
              {fetchedModels.length === 0 ? (
                <div className="rounded-[6px] border border-dashed border-border/70 bg-white px-3 py-3 text-sm text-muted-foreground">
                  暂无模型
                </div>
              ) : (
                fetchedModels.map((model) => {
                  const isUpdating = updatingFetchedModelId === model.id;
                  const isUnsupported = !model.catalogMatched;
                  const isProtectedDefaultModel =
                    PROTECTED_GEMINI_MODEL_IDS.has(model.modelId);

                  return (
                    <div
                      key={model.id}
                      className="group flex min-w-0 flex-col items-start gap-3 rounded-[6px] border border-border/65 bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="grid w-full min-w-0 flex-1 grid-cols-1 items-start gap-1.5 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,0.9fr)_5rem] sm:items-center sm:gap-4">
                        <div className="min-w-0 truncate text-[0.92rem] font-medium text-foreground">
                          {model.label}
                        </div>
                        <div
                          className="min-w-0 truncate text-[0.78rem] text-muted-foreground"
                          title={model.modelId}
                        >
                          {formatFetchedModelCapabilities(model)}
                        </div>
                        <span
                          className={cn(
                            "inline-flex w-fit items-center rounded-[6px] px-2 py-0.5 text-[0.7rem] font-medium",
                            model.catalogMatched
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600",
                          )}
                        >
                          {model.catalogMatched ? "支持" : "不支持"}
                        </span>
                      </div>
                      <div className="flex w-full shrink-0 items-center justify-start gap-2 sm:w-36 sm:justify-end">
                        {isUnsupported ? (
                          <span className="h-6 w-12" aria-hidden="true" />
                        ) : (
                          <Button
                            variant="ghost"
                            className={cn(
                              "h-6 w-12 rounded-[7px] px-2 text-[0.7rem] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
                              model.isDefault && "text-[#002FA7]",
                            )}
                            type="button"
                            onClick={() => void handleSetDefaultFetchedModel(model)}
                            disabled={isUpdating || model.isDefault}
                          >
                            默认
                          </Button>
                        )}
                        <button
                          type="button"
                          className={cn(
                            "inline-flex h-6 w-11 shrink-0 items-center rounded-[999px] border p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                            model.isEnabled && !isUnsupported
                              ? "border-[#002FA7] bg-[#002FA7]"
                              : "border-slate-200 bg-slate-200",
                          )}
                          onClick={() => void handleToggleFetchedModel(model)}
                          disabled={isUpdating || isUnsupported}
                          aria-label={
                            isUnsupported
                              ? "不支持的模型不可启用"
                              : model.isEnabled
                                ? "停用模型"
                                : "启用模型"
                          }
                        >
                          <span
                            className={cn(
                              "block size-5 rounded-[999px] bg-white shadow-sm transition-transform",
                              model.isEnabled && !isUnsupported && "translate-x-5",
                            )}
                          />
                        </button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={cn(
                            "size-7 rounded-[6px] text-muted-foreground hover:bg-red-50 hover:text-red-600",
                            isProtectedDefaultModel &&
                              "cursor-not-allowed opacity-35 hover:bg-transparent hover:text-muted-foreground",
                          )}
                          type="button"
                          onClick={() => void handleDeleteFetchedModel(model)}
                          disabled={isUpdating || isProtectedDefaultModel}
                          aria-label={
                            isProtectedDefaultModel ? "默认模型不可删除" : "删除模型"
                          }
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {geminiSettingsError ? (
              <p className="text-sm leading-6 text-red-600">
                {geminiSettingsError}
              </p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-border/50 bg-slate-50/45 px-7 py-3">
            <Button
              variant="outline"
              className="h-10 rounded-[6px] border-border/70 bg-white px-5 shadow-none"
              type="button"
              onClick={() => setIsGeminiSettingsDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              className="h-10 rounded-[6px] px-5"
              type="button"
              onClick={handleSaveGeminiSettings}
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDeleteConversation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteConversation(null);
          }
        }}
      >
        <DialogContent className="w-[min(92vw,42rem)] max-w-[42rem] overflow-hidden rounded-[10px] border border-border/70 bg-white/97 p-0 shadow-[0_24px_56px_rgba(46,79,134,0.12)] sm:!max-w-[42rem]">
          <DialogHeader className="px-7 pt-5 pb-3">
            <DialogTitle className="text-[1.15rem] leading-none font-medium tracking-normal text-foreground">
              是否删除这个对话?
            </DialogTitle>
            <DialogDescription className="max-w-[60ch] text-sm leading-6 text-muted-foreground">
              {pendingDeleteConversation
                ? `“${pendingDeleteConversation.title}” 删除后将无法恢复，相关消息记录也会一起移除。`
                : "删除后将无法恢复，相关消息记录也会一起移除。"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-3 border-t border-border/50 bg-slate-50/45 px-7 py-3">
            <Button
              variant="outline"
              className="h-10 rounded-[6px] border-border/70 bg-white px-5 shadow-none"
              type="button"
              onClick={() => setPendingDeleteConversation(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              className="h-10 rounded-[6px] bg-red-600 px-5 text-white hover:bg-red-700"
              type="button"
              onClick={() => void handleConfirmDeleteConversation()}
              disabled={
                pendingDeleteConversation
                  ? isDeletingConversationId === pendingDeleteConversation.id
                  : false
              }
            >
              {pendingDeleteConversation &&
              isDeletingConversationId === pendingDeleteConversation.id
                ? "删除中..."
                : "确认删除"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
