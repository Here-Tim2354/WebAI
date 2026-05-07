"use client";

import { useCallback, useRef, useState } from "react";
import {
  ChatMessage,
  GeminiRuntimeConfig,
  MessageAttachment,
  createChatMessage,
} from "@/lib/schemas/chat";
import { Conversation } from "@/lib/schemas/conversation";
import { ThinkingLevel } from "@/lib/schemas/thinking";
import {
  MAX_URL_CONTEXT_ITEMS,
  normalizeUrlCandidate,
} from "../lib/url-context";
import {
  consumeAssistantStream,
  createCancelledAssistantMessage,
  isAbortError,
} from "../lib/chat-stream";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "消息发送失败，请稍后再试。";
}

type SubmitOptions = {
  conversationId: string;
  content: string;
  urls?: string[];
  attachments?: MessageAttachment[];
  selectedModelId?: string | null;
  thinkingLevel?: ThinkingLevel;
  geminiRuntimeConfig?: GeminiRuntimeConfig;
  onConversationSynced: (conversation: Conversation) => void;
};

type EditMessageOptions = SubmitOptions & {
  messageId: string;
  content: string;
  urls?: string[];
  attachments?: MessageAttachment[];
};

type RegenerateAssistantMessageOptions = Omit<SubmitOptions, "content"> & {
  messageId: string;
  webSearchEnabled?: boolean;
  urls?: string[];
  attachments?: MessageAttachment[];
};

export type AddUrlContextResult =
  | "added"
  | "duplicate"
  | "invalid"
  | "limit";

/**
 * useChatSession 管的是“消息交互状态”，不是整个页面状态：
 * 输入框内容、发送中状态、各会话消息缓存都集中收在消息会话层。
 */
export function useChatSession() {
  const [conversationMessages, setConversationMessages] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [urlContextInputValue, setUrlContextInputValue] = useState("");
  const [urlContextUrls, setUrlContextUrls] = useState<string[]>([]);
  const [draftAttachments, setDraftAttachments] = useState<MessageAttachment[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isUrlContextPanelOpen, setIsUrlContextPanelOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [streamingConversationId, setStreamingConversationId] = useState<
    string | null
  >(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamingConversationIdRef = useRef<string | null>(null);

  const getMessages = useCallback((conversationId: string | null) => {
    if (!conversationId) {
      return [];
    }

    return conversationMessages[conversationId] ?? [];
  }, [conversationMessages]);

  const syncConversationMessages = useCallback((
    conversationId: string,
    messages: ChatMessage[],
  ) => {
    setConversationMessages((current) => ({
      ...current,
      [conversationId]: messages,
    }));
  }, []);

  const removeConversationMessages = useCallback((conversationId: string) => {
    setConversationMessages((current) => {
      const next = { ...current };
      // 被删除的会话不应该继续在本地缓存中占一个键位。
      delete next[conversationId];
      return next;
    });
  }, []);

  // updater 形式能保证在异步发送和多次状态更新交错时仍基于最新消息列表计算。
  const updateConversationMessages = useCallback((
    conversationId: string,
    updater: (messages: ChatMessage[]) => ChatMessage[],
  ) => {
    setConversationMessages((current) => ({
      ...current,
      [conversationId]: updater(current[conversationId] ?? []),
    }));
  }, []);

  const replaceMessage = useCallback((
    conversationId: string,
    previousMessageId: string,
    nextMessage: ChatMessage,
  ) => {
    updateConversationMessages(conversationId, (current) => {
      const previousMessageIndex = current.findIndex(
        (message) => message.id === previousMessageId,
      );

      if (previousMessageIndex === -1) {
        return [...current, nextMessage];
      }

      const nextMessages = [...current];
      nextMessages[previousMessageIndex] = nextMessage;
      return nextMessages;
    });
  }, [updateConversationMessages]);

  const markAssistantMessageCancelled = useCallback((
    conversationId: string,
    currentAssistantMessageId: string,
    latestAssistantMessage: ChatMessage,
  ) => {
    updateConversationMessages(conversationId, (current) => {
      const nextMessages = [...current];
      const replaceIndex = nextMessages.findIndex(
        (message) => message.id === currentAssistantMessageId,
      );
      const latestIndex = nextMessages.findIndex(
        (message) => message.id === latestAssistantMessage.id,
      );
      const activeAssistantIndex = [...nextMessages]
        .reverse()
        .findIndex((message) =>
          message.role === "assistant" &&
          (message.status === "pending" || message.status === "streaming")
        );
      const fallbackIndex =
        activeAssistantIndex === -1
          ? -1
          : nextMessages.length - 1 - activeAssistantIndex;
      const targetIndex =
        replaceIndex !== -1
          ? replaceIndex
          : latestIndex !== -1
            ? latestIndex
            : fallbackIndex;

      if (targetIndex !== -1) {
        nextMessages[targetIndex] = createCancelledAssistantMessage({
          ...latestAssistantMessage,
          id: nextMessages[targetIndex].id,
        });
        return nextMessages;
      }

      return [
        ...nextMessages,
        createCancelledAssistantMessage(latestAssistantMessage),
      ];
    });
  }, [updateConversationMessages]);

  const addUrlContextUrl = useCallback((candidateUrl?: string): AddUrlContextResult => {
    const normalizedUrl = normalizeUrlCandidate(
      candidateUrl ?? urlContextInputValue,
    );

    if (!normalizedUrl) {
      return "invalid";
    }

    if (urlContextUrls.includes(normalizedUrl)) {
      setUrlContextInputValue("");
      setIsUrlContextPanelOpen(true);
      return "duplicate";
    }

    if (urlContextUrls.length >= MAX_URL_CONTEXT_ITEMS) {
      return "limit";
    }

    setUrlContextUrls([...urlContextUrls, normalizedUrl]);
    setUrlContextInputValue("");
    setIsUrlContextPanelOpen(true);

    return "added";
  }, [urlContextInputValue, urlContextUrls]);

  const removeUrlContextUrl = useCallback((targetUrl: string) => {
    setUrlContextUrls((current) =>
      current.filter((currentUrl) => currentUrl !== targetUrl),
    );
  }, []);

  const toggleUrlContextPanel = useCallback(() => {
    setIsUrlContextPanelOpen((current) => !current);
  }, []);

  const uploadAttachments = useCallback(async (files: File[]) => {
    setIsUploadingAttachments(true);

    try {
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/attachments/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "附件上传失败。");
      }

      return payload.attachments as MessageAttachment[];
    } finally {
      setIsUploadingAttachments(false);
    }
  }, []);

  const stopStreaming = useCallback(() => {
    const conversationId = streamingConversationIdRef.current;

    if (conversationId) {
      // 同时通知服务端和中断浏览器 fetch：
      // 服务端负责停止模型流与写 cancelled，前端 abort 负责尽快结束本地 reader。
      void fetch("/api/chat/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
        }),
      }).catch(() => null);
    }

    abortControllerRef.current?.abort();
  }, []);

  const handleSubmit = useCallback(async ({
    conversationId,
    content: submittedContent,
    urls,
    attachments,
    selectedModelId,
    thinkingLevel,
    geminiRuntimeConfig,
    onConversationSynced,
  }: SubmitOptions) => {
    const content = submittedContent.trim();
    const submittedUrlContextUrls = urls ?? urlContextUrls;
    const submittedAttachments = attachments ?? draftAttachments;

    if (
      (
        content.length === 0 &&
        submittedUrlContextUrls.length === 0 &&
        submittedAttachments.length === 0
      ) ||
      isSubmitting
    ) {
      return;
    }

    const userMessage = createChatMessage({
      role: "user",
      content,
      status: "complete",
      metadata:
        submittedUrlContextUrls.length > 0 || submittedAttachments.length > 0
          ? {
              ...(submittedUrlContextUrls.length > 0
                ? { urls: submittedUrlContextUrls }
                : {}),
              ...(submittedAttachments.length > 0
                ? { attachments: submittedAttachments }
                : {}),
            }
          : {},
    });
    const assistantPlaceholder = createChatMessage({
      role: "assistant",
      content: "",
      status: "pending",
    });
    const abortController = new AbortController();
    let currentAssistantMessageId = assistantPlaceholder.id;
    let latestAssistantMessage = assistantPlaceholder;

    // 先乐观写入用户消息和 assistant 占位，让界面立即响应。
    // 如果请求失败，catch 分支会把占位消息转成 error/cancelled 状态。
    updateConversationMessages(conversationId, (current) => [
      ...current.filter((message) => message.role !== "error"),
      userMessage,
      assistantPlaceholder,
    ]);
    setUrlContextInputValue("");
    setUrlContextUrls([]);
    setDraftAttachments([]);
    setIsUrlContextPanelOpen(false);
    setIsSubmitting(true);
    setStreamingConversationId(conversationId);
    streamingConversationIdRef.current = conversationId;
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          content,
          modelId: selectedModelId ?? undefined,
          thinkingLevel,
          geminiRuntimeConfig,
          urls:
            submittedUrlContextUrls.length > 0
              ? submittedUrlContextUrls
              : undefined,
          attachments:
            submittedAttachments.length > 0 ? submittedAttachments : undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "模型暂时不可用。");
      }

      const result = await consumeAssistantStream({
        response,
        conversationId,
        assistantPlaceholder,
        replaceMessage,
        onConversationSynced,
      });
      currentAssistantMessageId = result.currentAssistantMessageId;
      latestAssistantMessage = result.latestAssistantMessage;
    } catch (error) {
      if (isAbortError(error)) {
        markAssistantMessageCancelled(
          conversationId,
          currentAssistantMessageId,
          latestAssistantMessage,
        );
        return;
      }

      const nextAssistantMessage = createChatMessage({
        id: currentAssistantMessageId,
        role: "assistant",
        content: latestAssistantMessage.content || getErrorMessage(error),
        status: "error",
        metadata: latestAssistantMessage.metadata,
      });

      latestAssistantMessage = nextAssistantMessage;
      replaceMessage(
        conversationId,
        currentAssistantMessageId,
        nextAssistantMessage,
      );
    } finally {
      abortControllerRef.current = null;
      setIsSubmitting(false);
      setStreamingConversationId(null);
      streamingConversationIdRef.current = null;
    }
  }, [
    isSubmitting,
    markAssistantMessageCancelled,
    replaceMessage,
    updateConversationMessages,
    urlContextUrls,
    draftAttachments,
  ]);

  const editMessageAndRegenerate = useCallback(async ({
    conversationId,
    messageId,
    content,
    urls,
    attachments,
    selectedModelId,
    thinkingLevel,
    geminiRuntimeConfig,
    onConversationSynced,
  }: EditMessageOptions) => {
    const trimmedContent = content.trim();
    const submittedUrlContextUrls = urls;
    const submittedAttachments = attachments;

    if (
      trimmedContent.length === 0 &&
      (submittedUrlContextUrls?.length ?? 0) === 0 &&
      (submittedAttachments?.length ?? 0) === 0
    ) {
      return;
    }

    if (isSubmitting) {
      return;
    }

    const previousMessages = conversationMessages[conversationId] ?? [];
    const assistantPlaceholder = createChatMessage({
      role: "assistant",
      content: "",
      status: "pending",
    });
    const abortController = new AbortController();
    let currentAssistantMessageId = assistantPlaceholder.id;
    let latestAssistantMessage = assistantPlaceholder;
    let responseAccepted = false;
    let restoredPreviousMessages = false;

    updateConversationMessages(conversationId, (current) => {
      const targetMessageIndex = current.findIndex(
        (message) => message.id === messageId,
      );

      if (targetMessageIndex === -1) {
        return current;
      }

      const nextMessages = current.slice(0, targetMessageIndex + 1);
      // 覆盖式编辑会截断目标消息之后的上下文，并立刻追加新的 assistant 占位。
      // 这和服务端 PATCH 的“编辑 + 删除后续 + 重新生成”保持同一语义。
      nextMessages[targetMessageIndex] = {
        ...nextMessages[targetMessageIndex],
        content: trimmedContent,
        metadata:
          submittedUrlContextUrls === undefined && submittedAttachments === undefined
            ? nextMessages[targetMessageIndex].metadata
            : {
                ...nextMessages[targetMessageIndex].metadata,
                ...(submittedUrlContextUrls !== undefined
                  ? { urls: submittedUrlContextUrls }
                  : {}),
                ...(submittedAttachments !== undefined
                  ? { attachments: submittedAttachments }
                  : {}),
              },
        parts: trimmedContent
          ? [
              {
                type: "text",
                text: trimmedContent,
              },
            ]
          : [],
        status: "complete",
      };

      return [...nextMessages, assistantPlaceholder];
    });
    setIsSubmitting(true);
    setStreamingConversationId(conversationId);
    streamingConversationIdRef.current = conversationId;
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          content: trimmedContent,
          modelId: selectedModelId ?? undefined,
          thinkingLevel,
          geminiRuntimeConfig,
          urls: submittedUrlContextUrls,
          attachments: submittedAttachments,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        // 重新生成失败时还原旧 assistant 消息，避免用户丢失原回复。
        syncConversationMessages(conversationId, previousMessages);
        restoredPreviousMessages = true;
        throw new Error(payload?.error?.message ?? "编辑消息失败。");
      }

      responseAccepted = true;
      const result = await consumeAssistantStream({
        response,
        conversationId,
        assistantPlaceholder,
        replaceMessage,
        onConversationSynced,
      });
      currentAssistantMessageId = result.currentAssistantMessageId;
      latestAssistantMessage = result.latestAssistantMessage;
    } catch (error) {
      if (isAbortError(error)) {
        markAssistantMessageCancelled(
          conversationId,
          currentAssistantMessageId,
          latestAssistantMessage,
        );
        return;
      }

      if (!responseAccepted) {
        if (!restoredPreviousMessages) {
          syncConversationMessages(conversationId, previousMessages);
        }
        throw error;
      }

      const nextAssistantMessage = createChatMessage({
        id: currentAssistantMessageId,
        role: "assistant",
        content: latestAssistantMessage.content || getErrorMessage(error),
        status: "error",
        metadata: latestAssistantMessage.metadata,
      });

      replaceMessage(
        conversationId,
        currentAssistantMessageId,
        nextAssistantMessage,
      );
      throw error;
    } finally {
      abortControllerRef.current = null;
      setIsSubmitting(false);
      setStreamingConversationId(null);
      streamingConversationIdRef.current = null;
    }
  }, [
    conversationMessages,
    isSubmitting,
    markAssistantMessageCancelled,
    replaceMessage,
    syncConversationMessages,
    updateConversationMessages,
  ]);

  const regenerateAssistantMessage = useCallback(async ({
    conversationId,
    messageId,
    selectedModelId,
    thinkingLevel,
    webSearchEnabled,
    urls,
    attachments,
    geminiRuntimeConfig,
    onConversationSynced,
  }: RegenerateAssistantMessageOptions) => {
    if (isSubmitting) {
      return;
    }

    const previousMessages = conversationMessages[conversationId] ?? [];
    const submittedUrlContextUrls = urls ?? [];
    const submittedAttachments = attachments ?? [];
    const assistantPlaceholder = createChatMessage({
      role: "assistant",
      content: "",
      status: "pending",
    });
    const abortController = new AbortController();
    let currentAssistantMessageId = assistantPlaceholder.id;
    let latestAssistantMessage = assistantPlaceholder;
    let responseAccepted = false;
    let restoredPreviousMessages = false;

    updateConversationMessages(conversationId, (current) => {
      const targetMessageIndex = current.findIndex(
        (message) => message.id === messageId,
      );

      if (targetMessageIndex === -1) {
        return current;
      }

      const nextMessages = current.slice(0, targetMessageIndex);

      if (
        submittedUrlContextUrls.length > 0 ||
        submittedAttachments.length > 0
      ) {
        // 重新生成允许临时覆盖“上一条 user 消息”的 URL/附件上下文。
        // 服务端也会同步更新这条 user 消息的 metadata，保证历史和 UI 一致。
        for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
          if (nextMessages[index].role !== "user") {
            continue;
          }

          nextMessages[index] = {
            ...nextMessages[index],
            metadata: {
              ...nextMessages[index].metadata,
              ...(submittedUrlContextUrls.length > 0
                ? { urls: submittedUrlContextUrls }
                : {}),
              ...(submittedAttachments.length > 0
                ? { attachments: submittedAttachments }
                : {}),
            },
          };
          break;
        }
      }

      return [...nextMessages, assistantPlaceholder];
    });
    setUrlContextInputValue("");
    setUrlContextUrls([]);
    setDraftAttachments([]);
    setIsUrlContextPanelOpen(false);
    setIsSubmitting(true);
    setStreamingConversationId(conversationId);
    streamingConversationIdRef.current = conversationId;
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(`/api/messages/${messageId}/regenerate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId,
          modelId: selectedModelId ?? undefined,
          thinkingLevel,
          webSearchEnabled,
          geminiRuntimeConfig,
          urls:
            submittedUrlContextUrls.length > 0
              ? submittedUrlContextUrls
              : undefined,
          attachments:
            submittedAttachments.length > 0 ? submittedAttachments : undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        // 编辑失败时恢复原消息列表，避免前端停在一个服务端没有接受的乐观状态。
        syncConversationMessages(conversationId, previousMessages);
        restoredPreviousMessages = true;
        throw new Error(payload?.error?.message ?? "重新生成失败。");
      }

      responseAccepted = true;
      const result = await consumeAssistantStream({
        response,
        conversationId,
        assistantPlaceholder,
        replaceMessage,
        onConversationSynced,
      });
      currentAssistantMessageId = result.currentAssistantMessageId;
      latestAssistantMessage = result.latestAssistantMessage;
    } catch (error) {
      if (restoredPreviousMessages) {
        throw error;
      }

      if (isAbortError(error)) {
        markAssistantMessageCancelled(
          conversationId,
          currentAssistantMessageId,
          latestAssistantMessage,
        );
        return;
      }

      if (!responseAccepted) {
        if (!restoredPreviousMessages) {
          syncConversationMessages(conversationId, previousMessages);
        }
        throw error;
      }

      const nextAssistantMessage = createChatMessage({
        id: currentAssistantMessageId,
        role: "assistant",
        content: latestAssistantMessage.content || getErrorMessage(error),
        status: "error",
        metadata: latestAssistantMessage.metadata,
      });

      replaceMessage(
        conversationId,
        currentAssistantMessageId,
        nextAssistantMessage,
      );
      throw error;
    } finally {
      abortControllerRef.current = null;
      setIsSubmitting(false);
      setStreamingConversationId(null);
      streamingConversationIdRef.current = null;
    }
  }, [
    conversationMessages,
    isSubmitting,
    markAssistantMessageCancelled,
    replaceMessage,
    syncConversationMessages,
    updateConversationMessages,
  ]);

  return {
    conversationMessages,
    urlContextInputValue,
    urlContextUrls,
    draftAttachments,
    isUploadingAttachments,
    isUrlContextPanelOpen,
    isSubmitting,
    streamingConversationId,
    setUrlContextInputValue,
    setUrlContextUrls,
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
  };
}
