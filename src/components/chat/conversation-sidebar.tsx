"use client";

import { useState } from "react";
import {
  EllipsisIcon,
  LogOutIcon,
  MessageSquareTextIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PencilLineIcon,
  PlusIcon,
  Trash2Icon,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Conversation } from "@/lib/schemas/conversation";

type ConversationSidebarProps = {
  conversations: Conversation[];
  activeConversationId: string | null;
  isCreating: boolean;
  isDeletingConversationId: string | null;
  isSigningOut: boolean;
  currentUserEmail: string | null;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
  onCreateConversation: () => Promise<void>;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => Promise<void>;
  onDeleteConversation: (conversationId: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

// 会话列表展示时间不需要精确到秒，这里统一收口成适合中文界面的简洁格式。
function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

/**
 * 侧栏负责“会话导航”和“会话管理”两类交互：
 * 切换、新建、重命名、删除、退出登录都从这里发起。
 */
export function ConversationSidebar({
  conversations,
  activeConversationId,
  isCreating,
  isDeletingConversationId,
  isSigningOut,
  currentUserEmail,
  mobileOpen,
  onMobileOpenChange,
  onCreateConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
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
  const [titleDraft, setTitleDraft] = useState("");

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
      // 创建失败时保留当前抽屉，方便继续操作。
    }
  }

  function handleSelectConversation(conversationId: string) {
    onSelectConversation(conversationId);
    onMobileOpenChange(false);
  }

  async function handleConfirmDeleteConversation() {
    if (!pendingDeleteConversation) {
      return;
    }

    try {
      await onDeleteConversation(pendingDeleteConversation.id);
      setPendingDeleteConversation(null);
    } catch {
      // 删除失败时保留确认弹窗，避免用户误判操作已完成。
    }
  }

  async function handleSignOutClick() {
    try {
      await onSignOut();
      onMobileOpenChange(false);
    } catch {
      // 退出失败时保留当前上下文。
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
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] border border-border/70 bg-background/92 text-sm font-semibold shadow-none">
            W
          </div>
          <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
            <span className="block text-[0.68rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
              Workspace
            </span>
            <strong className="block truncate text-sm font-medium text-foreground">
              WebAI
            </strong>
            <span className="block truncate text-xs text-muted-foreground">
              {currentUserEmail ?? "已登录"}
            </span>
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
          <div
            className={cn(
              "hidden rounded-[8px] border border-border/70 bg-background/92 text-sm font-semibold",
              collapsedTrackClass,
            )}
          >
            W
          </div>
        ) : null}
      </div>

      <Button
        className={cn(
          "h-10 rounded-[8px] border border-border/70 bg-background/92 text-foreground shadow-none hover:bg-muted/70",
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

              return (
                <div
                  key={conversation.id}
                  className={cn(
                    "rounded-[8px] border border-transparent bg-transparent transition-colors hover:bg-muted/40",
                    isActive && !isCollapsed &&
                      "border-border/70 bg-background/88",
                    isCollapsed && "lg:w-14",
                  )}
                >
                  {isEditing ? (
                    <form className="p-3" onSubmit={handleRenameSubmit}>
                      <Input
                        autoFocus
                        value={titleDraft}
                        className="h-10 rounded-[8px] border-border/70 bg-background/92"
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onBlur={() => {
                          // 这里用 blur 直接收口编辑态，保证点击其它会话或空白区时不会残留半编辑状态。
                          setEditingConversationId(null);
                          setTitleDraft("");
                        }}
                      />
                    </form>
                  ) : (
                    <div className={cn("flex items-start gap-2 p-1.5", isCollapsed && "lg:block lg:p-0")}>
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
                          <MessageSquareTextIcon className="size-4" />
                        </div>
                        <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
                          <strong className="block truncate text-sm font-medium text-foreground">
                            {conversation.title}
                          </strong>
                          <span className="block text-xs text-muted-foreground">
                            {formatUpdatedAt(conversation.updatedAt)}
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
                            >
                              <PencilLineIcon />
                              重命名
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                          <DropdownMenuSeparator />
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setPendingDeleteConversation(conversation)}
                              disabled={isDeleting}
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
          "flex items-center justify-between gap-3 border-t border-border/60 pt-3 px-1",
          isCollapsed && "lg:flex-col lg:px-0",
        )}
      >
        <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
          <span className="block text-[0.68rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Status
          </span>
          <strong className="block text-sm font-medium text-foreground">
            {conversations.length > 0 ? `${conversations.length} 个对话` : "暂无对话"}
          </strong>
          <span className="block text-xs text-muted-foreground">
            当前工作区已连接 Supabase
          </span>
        </div>
        <Button
          variant="ghost"
          className={cn(
            "rounded-[8px] text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            isCollapsed && "lg:mx-auto lg:size-10",
          )}
          type="button"
          onClick={() => void handleSignOutClick()}
          disabled={isSigningOut}
        >
          <LogOutIcon data-icon="inline-start" />
          <span className={cn(isCollapsed && "lg:hidden")}>
            {isSigningOut ? "退出中..." : "退出登录"}
          </span>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden border-r border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(245,249,255,0.9))] backdrop-blur-xl transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen",
          isCollapsed ? "lg:w-[5.75rem]" : "lg:w-[20rem]",
        )}
      >
        {sidebarContent}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-[min(88vw,22rem)] border-r border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(245,249,255,0.98))] p-0 backdrop-blur-xl"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>会话侧栏</SheetTitle>
            <SheetDescription>查看、新建、切换和管理当前用户的历史会话。</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col overflow-hidden">{sidebarContent}</div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={pendingDeleteConversation !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteConversation(null);
          }
        }}
      >
        <DialogContent className="max-w-[28rem] rounded-[10px] border border-border/70 bg-white/97 p-0 shadow-[0_24px_56px_rgba(46,79,134,0.12)]">
          <DialogHeader className="px-4 pt-4 pb-2">
            <div className="inline-flex size-10 items-center justify-center rounded-[8px] bg-red-50 text-red-600">
              <Trash2Icon className="size-5" />
            </div>
            <DialogTitle className="pt-1 text-[1.2rem] leading-none tracking-[-0.02em] text-foreground">
              是否删除这个对话?
            </DialogTitle>
            <DialogDescription className="max-w-[60ch] text-sm leading-7 text-muted-foreground">
              {pendingDeleteConversation
                ? `“${pendingDeleteConversation.title}” 删除后将无法恢复，相关消息记录也会一起移除。`
                : "删除后将无法恢复，相关消息记录也会一起移除。"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-3 border-t border-border/50 bg-slate-50/70 px-6 py-2">
            <Button
              variant="outline"
              className="h-10 rounded-[8px] px-5"
              type="button"
              onClick={() => setPendingDeleteConversation(null)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              className="h-10 rounded-[8px] bg-red-600 px-5 text-white hover:bg-red-700"
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
