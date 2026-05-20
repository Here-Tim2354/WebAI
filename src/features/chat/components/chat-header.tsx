"use client";

import {
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  NotebookPenIcon,
  PanelLeftOpenIcon,
  StarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { Conversation } from "@/lib/schemas/conversation";
import { AIModel } from "@/lib/schemas/model";
import { ModelIcon } from "./model-icon";

function GitHubMarkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.61-3.37-1.18-3.37-1.18a2.65 2.65 0 0 0-1.11-1.46c-.91-.62.07-.61.07-.61a2.1 2.1 0 0 1 1.53 1.03 2.13 2.13 0 0 0 2.91.83 2.14 2.14 0 0 1 .63-1.34c-2.22-.25-4.56-1.11-4.56-4.95a3.87 3.87 0 0 1 1.03-2.68 3.6 3.6 0 0 1 .1-2.64s.84-.27 2.75 1.02a9.47 9.47 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64a3.86 3.86 0 0 1 1.03 2.68c0 3.85-2.34 4.7-4.57 4.95a2.39 2.39 0 0 1 .68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

type ChatHeaderProps = {
  activeConversation: Conversation | undefined;
  activeConversationId: string | null;
  availableModels: AIModel[];
  selectedModel: AIModel | null;
  selectedModelId: string | null;
  currentSystemPrompt: string | null;
  isTogglingFavorite: boolean;
  isInteractionLocked: boolean;
  onOpenMobileSidebar: () => void;
  onSelectModel: (modelId: string) => void | Promise<void>;
  onToggleFavoriteConversation: () => void | Promise<void>;
  onOpenPromptDialog: () => void;
};

export function ChatHeader({
  activeConversation,
  activeConversationId,
  availableModels,
  selectedModel,
  selectedModelId,
  currentSystemPrompt,
  isTogglingFavorite,
  isInteractionLocked,
  onOpenMobileSidebar,
  onSelectModel,
  onToggleFavoriteConversation,
  onOpenPromptDialog,
}: ChatHeaderProps) {
  return (
    <header className="relative z-10 px-4 pt-4 pb-3 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-9 w-full max-w-4xl grid-cols-[auto_1fr_auto] items-center gap-3">
        <div className="flex items-center justify-start">
          <Button
            variant="outline"
            size="icon-sm"
            className="h-9 w-10 shrink-0 rounded-[12px] border-border/70 bg-background/88 shadow-none lg:hidden"
            type="button"
            onClick={onOpenMobileSidebar}
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
                  disabled={isInteractionLocked}
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
              className="w-[min(calc(100vw-2rem),22rem)] rounded-[16px] border border-border/70 bg-white/96 p-1.5 shadow-[0_18px_50px_rgba(58,84,132,0.12)] backdrop-blur-xl"
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
                        void onSelectModel(model.id);
                      }}
                      disabled={isInteractionLocked}
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
          <Tooltip side="bottom" content="GitHub 仓库">
            <Button
              render={
                <a
                  href="https://github.com/Here-Tim2354/WebAI"
                  target="_blank"
                  rel="noreferrer"
                />
              }
              variant="outline"
              size="icon-sm"
              className="h-9 w-10 rounded-[12px] border-border/70 bg-background/82 text-muted-foreground shadow-none"
              aria-label="打开 WebAI GitHub 仓库"
            >
              <GitHubMarkIcon className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip side="bottom" content="收藏">
            <Button
              variant="outline"
              size="icon-sm"
              className={`h-9 w-10 rounded-[12px] shadow-none ${
                activeConversation?.isFavorite
                  ? "border-amber-200/90 bg-amber-50/88 text-amber-600 hover:bg-amber-100/82"
                  : "border-border/70 bg-background/82 text-muted-foreground"
              }`}
              type="button"
              onClick={() => void onToggleFavoriteConversation()}
              disabled={!activeConversationId || isTogglingFavorite || isInteractionLocked}
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
          <Tooltip side="bottom" content="修改提示词">
            <Button
              variant="outline"
              size="icon-sm"
              className={`h-9 w-10 rounded-[12px] shadow-none ${
                currentSystemPrompt?.trim()
                  ? "border-sky-200/90 bg-sky-50/88 text-sky-700 hover:bg-sky-100/82"
                  : "border-border/70 bg-background/82 text-muted-foreground"
              }`}
              type="button"
              onClick={onOpenPromptDialog}
              disabled={isInteractionLocked}
              aria-label="编辑会话级提示词"
            >
              <NotebookPenIcon className="size-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
