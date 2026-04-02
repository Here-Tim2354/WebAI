"use client";

import { useCallback, useState } from "react";
import {
  ChatMessage,
  chatSessionResponseSchema,
  createChatMessage,
} from "@/lib/schemas/chat";
import { Conversation } from "@/lib/schemas/conversation";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "消息发送失败，请稍后再试。";
}

type SubmitOptions = {
  activeConversationId: string | null;
  ensureConversationId: () => Promise<string | null>;
  selectedModelId?: string | null;
  onConversationSynced: (conversation: Conversation) => void;
};

export function useChatSession() {
  const [conversationMessages, setConversationMessages] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      delete next[conversationId];
      return next;
    });
  }, []);

  function updateConversationMessages(
    conversationId: string,
    updater: (messages: ChatMessage[]) => ChatMessage[],
  ) {
    setConversationMessages((current) => ({
      ...current,
      [conversationId]: updater(current[conversationId] ?? []),
    }));
  }

  const handlePromptSelect = useCallback((prompt: string) => {
    setInputValue(prompt);
  }, []);

  const handleSubmit = useCallback(async ({
    activeConversationId,
    ensureConversationId,
    selectedModelId,
    onConversationSynced,
  }: SubmitOptions) => {
    const content = inputValue.trim();

    if (!content || isSubmitting) {
      return;
    }

    const conversationId =
      activeConversationId ?? (await ensureConversationId());

    if (!conversationId) {
      return;
    }

    const userMessage = createChatMessage({
      role: "user",
      content,
      status: "complete",
    });
    const assistantPlaceholder = createChatMessage({
      role: "assistant",
      content: "",
      status: "pending",
    });

    updateConversationMessages(conversationId, (current) => [
      ...current.filter((message) => message.role !== "error"),
      userMessage,
      assistantPlaceholder,
    ]);
    setInputValue("");
    setIsSubmitting(true);

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
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "模型暂时不可用。");
      }

      const parsed = chatSessionResponseSchema.parse(payload);
      syncConversationMessages(conversationId, parsed.messages);
      onConversationSynced(parsed.conversation);
    } catch (error) {
      updateConversationMessages(conversationId, (current) =>
        current.map((message) =>
          message.id === assistantPlaceholder.id
            ? createChatMessage({
                id: assistantPlaceholder.id,
                role: "error",
                content: getErrorMessage(error),
                status: "error",
              })
            : message,
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [inputValue, isSubmitting, syncConversationMessages]);

  return {
    conversationMessages,
    inputValue,
    isSubmitting,
    setInputValue,
    getMessages,
    handlePromptSelect,
    handleSubmit,
    syncConversationMessages,
    removeConversationMessages,
  };
}
