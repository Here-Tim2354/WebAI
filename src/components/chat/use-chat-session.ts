"use client";

import { useCallback, useRef, useState } from "react";
import {
  ChatMessage,
  chatStreamEventSchema,
  createChatMessage,
} from "@/lib/schemas/chat";
import { Conversation } from "@/lib/schemas/conversation";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "消息发送失败，请稍后再试。";
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function mergeAssistantMessageParts(
  previousMessage: ChatMessage | null,
  nextMessage: ChatMessage,
) {
  if (nextMessage.role !== "assistant") {
    return nextMessage;
  }

  if (!previousMessage || previousMessage.role !== "assistant") {
    return {
      ...nextMessage,
      parts: nextMessage.content
        ? [
            {
              type: "text" as const,
              text: nextMessage.content,
            },
          ]
        : [],
    };
  }

  if (!nextMessage.content) {
    return {
      ...nextMessage,
      parts: [],
    };
  }

  if (!previousMessage.content) {
    return {
      ...nextMessage,
      parts: [
        {
          type: "text" as const,
          text: nextMessage.content,
        },
      ],
    };
  }

  if (nextMessage.content === previousMessage.content) {
    return {
      ...nextMessage,
      parts: previousMessage.parts,
    };
  }

  if (nextMessage.content.startsWith(previousMessage.content)) {
    const appendedText = nextMessage.content.slice(previousMessage.content.length);

    if (!appendedText) {
      return {
        ...nextMessage,
        parts: previousMessage.parts,
      };
    }

    return {
      ...nextMessage,
      parts: [
        ...previousMessage.parts,
        {
          type: "text" as const,
          text: appendedText,
        },
      ],
    };
  }

  return {
    ...nextMessage,
    parts: [
      {
        type: "text" as const,
        text: nextMessage.content,
      },
    ],
  };
}

type SubmitOptions = {
  conversationId: string;
  content: string;
  selectedModelId?: string | null;
  onConversationSynced: (conversation: Conversation) => void;
};

type EditMessageOptions = SubmitOptions & {
  messageId: string;
  content: string;
  urls?: string[];
};

type RegenerateAssistantMessageOptions = Omit<SubmitOptions, "content"> & {
  messageId: string;
  webSearchEnabled?: boolean;
  urls?: string[];
};

export type AddUrlContextResult =
  | "added"
  | "duplicate"
  | "invalid"
  | "limit";

const MAX_URL_CONTEXT_ITEMS = 4;

function normalizeUrlCandidate(url: string) {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const candidateUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedUrl)
      ? trimmedUrl
      : `https://${trimmedUrl}`;
    const normalizedUrl = new URL(candidateUrl);

    if (
      normalizedUrl.protocol !== "http:" &&
      normalizedUrl.protocol !== "https:"
    ) {
      return null;
    }

    return normalizedUrl.toString();
  } catch {
    return null;
  }
}

/**
 * useChatSession 管的是“消息交互状态”，不是整个页面状态：
 * 输入框内容、发送中状态、各会话消息缓存都集中收在这里。
 */
export function useChatSession() {
  const [conversationMessages, setConversationMessages] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [urlContextInputValue, setUrlContextInputValue] = useState("");
  const [urlContextUrls, setUrlContextUrls] = useState<string[]>([]);
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

  const addUrlContextUrl = useCallback((candidateUrl?: string): AddUrlContextResult => {
    const normalizedUrl = normalizeUrlCandidate(
      candidateUrl ?? urlContextInputValue,
    );

    if (!normalizedUrl) {
      return "invalid";
    }

    let result = "invalid" as AddUrlContextResult;
    setUrlContextUrls((current) => {
      if (current.includes(normalizedUrl)) {
        result = "duplicate";
        return current;
      }

      if (current.length >= MAX_URL_CONTEXT_ITEMS) {
        result = "limit";
        return current;
      }

      result = "added";
      return [...current, normalizedUrl];
    });

    if (result === "added") {
      setUrlContextInputValue("");
      setIsUrlContextPanelOpen(true);
    }

    return result;
  }, [urlContextInputValue]);

  const removeUrlContextUrl = useCallback((targetUrl: string) => {
    setUrlContextUrls((current) =>
      current.filter((currentUrl) => currentUrl !== targetUrl),
    );
  }, []);

  const toggleUrlContextPanel = useCallback(() => {
    setIsUrlContextPanelOpen((current) => !current);
  }, []);

  const stopStreaming = useCallback(() => {
    const conversationId = streamingConversationIdRef.current;

    if (conversationId) {
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

  const consumeAssistantStream = useCallback(async ({
    response,
    conversationId,
    assistantPlaceholder,
    onConversationSynced,
  }: {
    response: Response;
    conversationId: string;
    assistantPlaceholder: ChatMessage;
    onConversationSynced: (conversation: Conversation) => void;
  }) => {
    if (!response.body) {
      throw new Error("聊天接口未返回流式响应。");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentAssistantMessageId = assistantPlaceholder.id;
    let latestAssistantMessage = assistantPlaceholder;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (!trimmedLine) {
            continue;
          }

          const parsedEvent = chatStreamEventSchema.parse(
            JSON.parse(trimmedLine),
          );

          switch (parsedEvent.type) {
            case "assistant-message-created": {
              const nextAssistantMessage = mergeAssistantMessageParts(
                latestAssistantMessage,
                parsedEvent.message,
              );
              currentAssistantMessageId = nextAssistantMessage.id;
              latestAssistantMessage = nextAssistantMessage;
              replaceMessage(
                conversationId,
                assistantPlaceholder.id,
                nextAssistantMessage,
              );
              break;
            }
            case "assistant-message-updated": {
              const nextAssistantMessage = mergeAssistantMessageParts(
                latestAssistantMessage,
                parsedEvent.message,
              );
              const previousAssistantMessageId = currentAssistantMessageId;
              currentAssistantMessageId = nextAssistantMessage.id;
              latestAssistantMessage = nextAssistantMessage;
              replaceMessage(
                conversationId,
                previousAssistantMessageId,
                nextAssistantMessage,
              );
              break;
            }
            case "conversation-updated": {
              onConversationSynced(parsedEvent.conversation);
              break;
            }
            case "done": {
              const nextAssistantMessage = mergeAssistantMessageParts(
                latestAssistantMessage,
                parsedEvent.message,
              );
              const previousAssistantMessageId = currentAssistantMessageId;
              currentAssistantMessageId = nextAssistantMessage.id;
              latestAssistantMessage = nextAssistantMessage;
              replaceMessage(
                conversationId,
                previousAssistantMessageId,
                nextAssistantMessage,
              );
              onConversationSynced(parsedEvent.conversation);
              break;
            }
          }
        }
      }

      const trailingLine = buffer.trim();

      if (trailingLine) {
        const parsedEvent = chatStreamEventSchema.parse(
          JSON.parse(trailingLine),
        );

        if (parsedEvent.type === "done") {
          const nextAssistantMessage = mergeAssistantMessageParts(
            latestAssistantMessage,
            parsedEvent.message,
          );
          const previousAssistantMessageId = currentAssistantMessageId;
          currentAssistantMessageId = nextAssistantMessage.id;
          latestAssistantMessage = nextAssistantMessage;
          replaceMessage(
            conversationId,
            previousAssistantMessageId,
            nextAssistantMessage,
          );
          onConversationSynced(parsedEvent.conversation);
        }
      }

      return {
        currentAssistantMessageId,
        latestAssistantMessage,
      };
    } finally {
      reader.releaseLock();
    }
  }, [replaceMessage]);

  const handleSubmit = useCallback(async ({
    conversationId,
    content: submittedContent,
    selectedModelId,
    onConversationSynced,
  }: SubmitOptions) => {
    const content = submittedContent.trim();
    const submittedUrlContextUrls = urlContextUrls;

    if (!content || isSubmitting) {
      return;
    }

    const userMessage = createChatMessage({
      role: "user",
      content,
      status: "complete",
      metadata:
        submittedUrlContextUrls.length > 0
          ? { urls: submittedUrlContextUrls }
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

    updateConversationMessages(conversationId, (current) => [
      ...current.filter((message) => message.role !== "error"),
      userMessage,
      assistantPlaceholder,
    ]);
    setUrlContextInputValue("");
    setUrlContextUrls([]);
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
          urls:
            submittedUrlContextUrls.length > 0
              ? submittedUrlContextUrls
              : undefined,
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
        onConversationSynced,
      });
      currentAssistantMessageId = result.currentAssistantMessageId;
      latestAssistantMessage = result.latestAssistantMessage;
    } catch (error) {
      const nextAssistantMessage = createChatMessage({
        id: currentAssistantMessageId,
        role: "assistant",
        content: isAbortError(error)
          ? latestAssistantMessage.content
          : latestAssistantMessage.content || getErrorMessage(error),
        status: isAbortError(error) ? "cancelled" : "error",
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
    consumeAssistantStream,
    isSubmitting,
    replaceMessage,
    updateConversationMessages,
    urlContextUrls,
  ]);

  const editMessageAndRegenerate = useCallback(async ({
    conversationId,
    messageId,
    content,
    urls,
    selectedModelId,
    onConversationSynced,
  }: EditMessageOptions) => {
    const trimmedContent = content.trim();

    if (!trimmedContent || isSubmitting) {
      return;
    }

    const previousMessages = conversationMessages[conversationId] ?? [];
    const submittedUrlContextUrls = urls;
    const assistantPlaceholder = createChatMessage({
      role: "assistant",
      content: "",
      status: "pending",
    });
    const abortController = new AbortController();
    let currentAssistantMessageId = assistantPlaceholder.id;
    let latestAssistantMessage = assistantPlaceholder;

    updateConversationMessages(conversationId, (current) => {
      const targetMessageIndex = current.findIndex(
        (message) => message.id === messageId,
      );

      if (targetMessageIndex === -1) {
        return current;
      }

      const nextMessages = current.slice(0, targetMessageIndex + 1);
      nextMessages[targetMessageIndex] = {
        ...nextMessages[targetMessageIndex],
        content: trimmedContent,
        metadata:
          submittedUrlContextUrls === undefined
            ? nextMessages[targetMessageIndex].metadata
            : {
                ...nextMessages[targetMessageIndex].metadata,
                urls: submittedUrlContextUrls,
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
          urls: submittedUrlContextUrls,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        syncConversationMessages(conversationId, previousMessages);
        throw new Error(payload?.error?.message ?? "编辑消息失败。");
      }

      const result = await consumeAssistantStream({
        response,
        conversationId,
        assistantPlaceholder,
        onConversationSynced,
      });
      currentAssistantMessageId = result.currentAssistantMessageId;
      latestAssistantMessage = result.latestAssistantMessage;
    } catch (error) {
      if (isAbortError(error)) {
        const nextAssistantMessage = createChatMessage({
          id: currentAssistantMessageId,
          role: "assistant",
          content: latestAssistantMessage.content,
          status: "cancelled",
        });

        replaceMessage(
          conversationId,
          currentAssistantMessageId,
          nextAssistantMessage,
        );
        return;
      }

      const nextAssistantMessage = createChatMessage({
        id: currentAssistantMessageId,
        role: "assistant",
        content: latestAssistantMessage.content || getErrorMessage(error),
        status: "error",
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
    consumeAssistantStream,
    conversationMessages,
    isSubmitting,
    replaceMessage,
    syncConversationMessages,
    updateConversationMessages,
  ]);

  const regenerateAssistantMessage = useCallback(async ({
    conversationId,
    messageId,
    selectedModelId,
    webSearchEnabled,
    urls,
    onConversationSynced,
  }: RegenerateAssistantMessageOptions) => {
    if (isSubmitting) {
      return;
    }

    const previousMessages = conversationMessages[conversationId] ?? [];
    const submittedUrlContextUrls = urls ?? [];
    const assistantPlaceholder = createChatMessage({
      role: "assistant",
      content: "",
      status: "pending",
    });
    const abortController = new AbortController();
    let currentAssistantMessageId = assistantPlaceholder.id;
    let latestAssistantMessage = assistantPlaceholder;
    let restoredPreviousMessages = false;

    updateConversationMessages(conversationId, (current) => {
      const targetMessageIndex = current.findIndex(
        (message) => message.id === messageId,
      );

      if (targetMessageIndex === -1) {
        return current;
      }

      const nextMessages = current.slice(0, targetMessageIndex);

      if (submittedUrlContextUrls.length > 0) {
        for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
          if (nextMessages[index].role !== "user") {
            continue;
          }

          nextMessages[index] = {
            ...nextMessages[index],
            metadata: {
              ...nextMessages[index].metadata,
              urls: submittedUrlContextUrls,
            },
          };
          break;
        }
      }

      return [...nextMessages, assistantPlaceholder];
    });
    setUrlContextInputValue("");
    setUrlContextUrls([]);
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
          webSearchEnabled,
          urls:
            submittedUrlContextUrls.length > 0
              ? submittedUrlContextUrls
              : undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        syncConversationMessages(conversationId, previousMessages);
        restoredPreviousMessages = true;
        throw new Error(payload?.error?.message ?? "重新生成失败。");
      }

      const result = await consumeAssistantStream({
        response,
        conversationId,
        assistantPlaceholder,
        onConversationSynced,
      });
      currentAssistantMessageId = result.currentAssistantMessageId;
      latestAssistantMessage = result.latestAssistantMessage;
    } catch (error) {
      if (restoredPreviousMessages) {
        throw error;
      }

      if (isAbortError(error)) {
        const nextAssistantMessage = createChatMessage({
          id: currentAssistantMessageId,
          role: "assistant",
          content: latestAssistantMessage.content,
          status: "cancelled",
        });

        replaceMessage(
          conversationId,
          currentAssistantMessageId,
          nextAssistantMessage,
        );
        return;
      }

      const nextAssistantMessage = createChatMessage({
        id: currentAssistantMessageId,
        role: "assistant",
        content: latestAssistantMessage.content || getErrorMessage(error),
        status: "error",
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
    consumeAssistantStream,
    conversationMessages,
    isSubmitting,
    replaceMessage,
    syncConversationMessages,
    updateConversationMessages,
  ]);

  return {
    conversationMessages,
    urlContextInputValue,
    urlContextUrls,
    isUrlContextPanelOpen,
    isSubmitting,
    streamingConversationId,
    setUrlContextInputValue,
    getMessages,
    handleSubmit,
    editMessageAndRegenerate,
    regenerateAssistantMessage,
    stopStreaming,
    addUrlContextUrl,
    removeUrlContextUrl,
    toggleUrlContextPanel,
    syncConversationMessages,
    removeConversationMessages,
  };
}
