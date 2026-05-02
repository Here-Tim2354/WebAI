"use client";

import { useCallback, useEffect, useState } from "react";
import { chatSessionResponseSchema, ChatMessage } from "@/lib/schemas/chat";
import {
  Conversation,
  conversationListResponseSchema,
  conversationResponseSchema,
} from "@/lib/schemas/conversation";
import { AIModel, aiModelListResponseSchema } from "@/lib/schemas/model";
import {
  DEFAULT_THINKING_LEVEL,
  ThinkingLevel,
} from "@/lib/schemas/thinking";

type UseChatWorkspaceOptions = {
  initialConversations: Conversation[];
  initialModels: AIModel[];
  syncConversationMessages: (
    conversationId: string,
    messages: ChatMessage[],
  ) => void;
  removeConversationMessages: (conversationId: string) => void;
};

type CreateConversationOptions = {
  activate?: boolean;
  modelId?: string | null;
  systemPrompt?: string | null;
  webSearchEnabled?: boolean;
  thinkingLevel?: ThinkingLevel;
  consumeDraftControls?: boolean;
};

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
 * useChatWorkspace 专门负责“聊天工作区里的会话编排语义”：
 * 会话列表、当前激活会话、草稿控制项、模型列表同步以及会话级 patch 都集中收在这里。
 */
export function useChatWorkspace({
  initialConversations,
  initialModels,
  syncConversationMessages,
  removeConversationMessages,
}: UseChatWorkspaceOptions) {
  const [conversations, setConversations] = useState(
    sortConversations(initialConversations),
  );
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>(
    [],
  );
  const [favoriteConversations, setFavoriteConversations] = useState<Conversation[]>(
    [],
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isDeletingConversationId, setIsDeletingConversationId] = useState<
    string | null
  >(null);
  const [isArchivingConversationId, setIsArchivingConversationId] = useState<
    string | null
  >(null);
  const [isRestoringConversationId, setIsRestoringConversationId] = useState<
    string | null
  >(null);
  const [isLoadingArchivedConversations, setIsLoadingArchivedConversations] =
    useState(false);
  const [isLoadingFavoriteConversations, setIsLoadingFavoriteConversations] =
    useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<AIModel[]>(initialModels);
  const [draftModelId, setDraftModelId] = useState<string | null>(
    getDefaultModelId(initialModels),
  );
  const [draftSystemPrompt, setDraftSystemPrompt] = useState<string | null>(null);
  const [draftWebSearchEnabled, setDraftWebSearchEnabled] = useState(true);
  const [draftThinkingLevel, setDraftThinkingLevel] = useState<ThinkingLevel>(
    DEFAULT_THINKING_LEVEL,
  );

  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  ) ?? archivedConversations.find(
    (conversation) => conversation.id === activeConversationId,
  ) ?? favoriteConversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const selectedModelId = activeConversation?.modelId ?? draftModelId;
  const currentSystemPrompt = activeConversation?.systemPrompt ?? draftSystemPrompt;
  const currentWebSearchEnabled =
    activeConversation?.webSearchEnabled ?? draftWebSearchEnabled;
  const currentThinkingLevel =
    activeConversation?.thinkingLevel ?? draftThinkingLevel;
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

  const resetDraftConversationControls = useCallback((models = availableModels) => {
    setDraftModelId(getDefaultModelId(models));
    setDraftSystemPrompt(null);
    setDraftWebSearchEnabled(true);
    setDraftThinkingLevel(DEFAULT_THINKING_LEVEL);
  }, [availableModels]);

  // upsert 的目标是“有则更新，无则插入”，这样重命名、拉取详情、发送消息后都能复用同一入口刷新列表。
  const upsertConversation = useCallback((nextConversation: Conversation) => {
    setConversations((current) => {
      const remaining = current.filter(
        (conversation) => conversation.id !== nextConversation.id,
      );

      return sortConversations([nextConversation, ...remaining]);
    });
  }, []);

  const syncFavoriteConversation = useCallback((nextConversation: Conversation) => {
    setFavoriteConversations((current) => {
      const remaining = current.filter(
        (conversation) => conversation.id !== nextConversation.id,
      );

      if (!nextConversation.isFavorite) {
        return remaining;
      }

      return [...remaining, nextConversation].sort((left, right) =>
        (right.favoritedAt ?? right.updatedAt).localeCompare(
          left.favoritedAt ?? left.updatedAt,
        ),
      );
    });
  }, []);

  /**
   * 当前新建会话仍走“空参数快速创建”模式：
   * 但首条消息发送前如果已有草稿控制项，会在这里把 model / system prompt 一并落进去。
   */
  const createConversation = useCallback(async (
    options?: CreateConversationOptions,
  ) => {
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
          webSearchEnabled: options?.webSearchEnabled,
          thinkingLevel: options?.thinkingLevel,
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
  }, [resetDraftConversationControls, syncConversationMessages, upsertConversation]);

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
  }, [activeConversationId, syncConversationMessages, upsertConversation]);

  const handleCreateConversation = useCallback(async () => {
    try {
      await createConversation({ activate: true });
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    }
  }, [createConversation]);

  const handleRenameConversation = useCallback(async (
    conversationId: string,
    title: string,
  ) => {
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
  }, [upsertConversation]);

  const patchConversationControls = useCallback(async (
    conversationId: string,
    updates: {
      modelId?: string;
      systemPrompt?: string;
      webSearchEnabled?: boolean;
      thinkingLevel?: ThinkingLevel;
    },
  ) => {
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
  }, []);

  const handleSelectModel = useCallback(async (modelId: string) => {
    setWorkspaceError(null);

    if (!activeConversationId || !activeConversation) {
      // 空白首页还没有真实会话，只把模型作为草稿控制项保存到本地。
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
  }, [
    activeConversation,
    activeConversationId,
    patchConversationControls,
    upsertConversation,
  ]);

  const saveSystemPrompt = useCallback(async (nextSystemPrompt: string | null) => {
    setWorkspaceError(null);

    if (!activeConversationId || !activeConversation) {
      // system prompt 和模型一样，在首条消息创建会话时才真正落库。
      setDraftSystemPrompt(nextSystemPrompt);
      return;
    }

    const nextConversation = await patchConversationControls(
      activeConversationId,
      {
        systemPrompt: nextSystemPrompt ?? "",
      },
    );
    upsertConversation(nextConversation);
  }, [
    activeConversation,
    activeConversationId,
    patchConversationControls,
    upsertConversation,
  ]);

  const toggleWebSearchEnabled = useCallback(async () => {
    setWorkspaceError(null);

    if (!activeConversationId || !activeConversation) {
      setDraftWebSearchEnabled((current) => !current);
      return;
    }

    const previousConversation = activeConversation;
    const nextWebSearchEnabled = !activeConversation.webSearchEnabled;

    upsertConversation({
      ...activeConversation,
      webSearchEnabled: nextWebSearchEnabled,
    });

    try {
      const nextConversation = await patchConversationControls(
        activeConversationId,
        {
          webSearchEnabled: nextWebSearchEnabled,
        },
      );
      upsertConversation(nextConversation);
    } catch (error) {
      upsertConversation(previousConversation);
      setWorkspaceError(getErrorMessage(error));
    }
  }, [
    activeConversation,
    activeConversationId,
    patchConversationControls,
    upsertConversation,
  ]);

  const handleDeleteConversation = useCallback(async (conversationId: string) => {
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
  }, [removeConversationMessages, resetDraftConversationControls]);

  const loadArchivedConversations = useCallback(async () => {
    setIsLoadingArchivedConversations(true);
    setWorkspaceError(null);

    try {
      const response = await fetch("/api/conversations?status=archived");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "读取归档区失败。");
      }

      const parsed = conversationListResponseSchema.parse(payload);
      setArchivedConversations(sortConversations(parsed.conversations));
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
    } finally {
      setIsLoadingArchivedConversations(false);
    }
  }, []);

  const loadFavoriteConversations = useCallback(async () => {
    setIsLoadingFavoriteConversations(true);
    setWorkspaceError(null);

    try {
      const response = await fetch("/api/conversations?favorite=true");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "读取收藏失败。");
      }

      const parsed = conversationListResponseSchema.parse(payload);
      setFavoriteConversations(parsed.conversations);
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
    } finally {
      setIsLoadingFavoriteConversations(false);
    }
  }, []);

  const handleToggleFavoriteConversation = useCallback(async () => {
    if (!activeConversationId || !activeConversation) {
      return;
    }

    setIsTogglingFavorite(true);
    setWorkspaceError(null);

    const previousConversation = activeConversation;
    const nextIsFavorite = !activeConversation.isFavorite;
    const optimisticConversation = {
      ...activeConversation,
      isFavorite: nextIsFavorite,
      favoritedAt: nextIsFavorite ? new Date().toISOString() : null,
    };

    // 收藏操作需要同时维护 active / archived / favorite 三份列表视图。
    // 先乐观更新能让菜单响应更快，失败时再按 previousConversation 回滚。
    if (activeConversation.status === "archived") {
      setArchivedConversations((current) =>
        sortConversations(
          current.map((conversation) =>
            conversation.id === activeConversationId
              ? optimisticConversation
              : conversation,
          ),
        ),
      );
    } else {
      upsertConversation(optimisticConversation);
    }
    syncFavoriteConversation(optimisticConversation);

    try {
      const response = await fetch(
        `/api/conversations/${activeConversationId}/favorite`,
        {
          method: nextIsFavorite ? "POST" : "DELETE",
        },
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "收藏操作失败。");
      }

      const parsed = conversationResponseSchema.parse(payload);

      if (parsed.conversation.status === "archived") {
        setArchivedConversations((current) =>
          sortConversations(
            current.map((conversation) =>
              conversation.id === parsed.conversation.id
                ? parsed.conversation
                : conversation,
            ),
          ),
        );
      } else {
        upsertConversation(parsed.conversation);
      }
      syncFavoriteConversation(parsed.conversation);
    } catch (error) {
      if (previousConversation.status === "archived") {
        setArchivedConversations((current) =>
          sortConversations(
            current.map((conversation) =>
              conversation.id === previousConversation.id
                ? previousConversation
                : conversation,
            ),
          ),
        );
      } else {
        upsertConversation(previousConversation);
      }
      syncFavoriteConversation(previousConversation);
      setWorkspaceError(getErrorMessage(error));
    } finally {
      setIsTogglingFavorite(false);
    }
  }, [
    activeConversation,
    activeConversationId,
    syncFavoriteConversation,
    upsertConversation,
  ]);

  const handleSelectThinkingLevel = useCallback(async (
    thinkingLevel: ThinkingLevel,
  ) => {
    setWorkspaceError(null);

    if (!activeConversationId || !activeConversation) {
      setDraftThinkingLevel(thinkingLevel);
      return;
    }

    const previousConversation = activeConversation;

    upsertConversation({
      ...activeConversation,
      thinkingLevel,
    });

    try {
      const nextConversation = await patchConversationControls(
        activeConversationId,
        {
          thinkingLevel,
        },
      );
      upsertConversation(nextConversation);
    } catch (error) {
      upsertConversation(previousConversation);
      setWorkspaceError(getErrorMessage(error));
    }
  }, [
    activeConversation,
    activeConversationId,
    patchConversationControls,
    upsertConversation,
  ]);

  const handleArchiveConversation = useCallback(async (conversationId: string) => {
    setIsArchivingConversationId(conversationId);
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "archived" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "归档失败。");
      }

      const parsed = conversationResponseSchema.parse(payload);
      setConversations((current) => {
        const remaining = current.filter(
          (conversation) => conversation.id !== conversationId,
        );

        // 如果归档的是当前会话，自动切到下一条 active 会话；
        // 没有下一条时回到空白草稿态。
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
      setArchivedConversations((current) =>
        sortConversations([parsed.conversation, ...current.filter(
          (conversation) => conversation.id !== conversationId,
        )]),
      );
      syncFavoriteConversation(parsed.conversation);
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    } finally {
      setIsArchivingConversationId(null);
    }
  }, [resetDraftConversationControls, syncFavoriteConversation]);

  const handleRestoreConversation = useCallback(async (conversationId: string) => {
    setIsRestoringConversationId(conversationId);
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "active" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "恢复归档失败。");
      }

      const parsed = conversationResponseSchema.parse(payload);
      setArchivedConversations((current) =>
        current.filter((conversation) => conversation.id !== conversationId),
      );
      upsertConversation(parsed.conversation);
      syncFavoriteConversation(parsed.conversation);
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    } finally {
      setIsRestoringConversationId(null);
    }
  }, [syncFavoriteConversation, upsertConversation]);

  const handleBranchConversation = useCallback(async (
    conversationId: string,
    messageId: string,
  ) => {
    setWorkspaceError(null);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/branch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "创建分支会话失败。");
      }

      const parsed = chatSessionResponseSchema.parse(payload);
      // 分支返回的是完整会话快照，必须同时写入会话列表和消息缓存，
      // 否则切到新会话时会出现空消息或再次拉取闪烁。
      upsertConversation(parsed.conversation);
      syncConversationMessages(parsed.conversation.id, parsed.messages);
      setActiveConversationId(parsed.conversation.id);

      return parsed.conversation;
    } catch (error) {
      const message = getErrorMessage(error);
      setWorkspaceError(message);
      throw new Error(message);
    }
  }, [syncConversationMessages, upsertConversation]);

  const ensureConversationId = useCallback(async () => {
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
        webSearchEnabled: draftWebSearchEnabled,
        thinkingLevel: draftThinkingLevel,
        consumeDraftControls: true,
      });
      return conversation.id;
    } catch (error) {
      setWorkspaceError(getErrorMessage(error));
      return null;
    }
  }, [
    activeConversationId,
    createConversation,
    draftModelId,
    draftSystemPrompt,
    draftThinkingLevel,
    draftWebSearchEnabled,
  ]);

  const resetAfterSignOut = useCallback(() => {
    setConversations([]);
    setArchivedConversations([]);
    setFavoriteConversations([]);
    setActiveConversationId(null);
    setAvailableModels(initialModels);
    resetDraftConversationControls(initialModels);
    setWorkspaceError(null);
    setIsLoadingConversation(false);
    setIsCreatingConversation(false);
    setIsDeletingConversationId(null);
    setIsArchivingConversationId(null);
    setIsRestoringConversationId(null);
    setIsLoadingArchivedConversations(false);
    setIsLoadingFavoriteConversations(false);
    setIsTogglingFavorite(false);
  }, [initialModels, resetDraftConversationControls]);

  return {
    conversations,
    archivedConversations,
    favoriteConversations,
    activeConversationId,
    activeConversation,
    selectedModelId,
    selectedModel,
    currentSystemPrompt,
    currentWebSearchEnabled,
    currentThinkingLevel,
    groupedModels,
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
  };
}
