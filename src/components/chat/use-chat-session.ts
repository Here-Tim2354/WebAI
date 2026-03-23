"use client";

import { useState } from "react";
import {
  ChatMessage,
  chatResponseSchema,
  createChatMessage,
} from "@/lib/schemas/chat";

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "消息发送失败，请稍后再试。";
}

export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleResetConversation() {
    setMessages([]);
    setInputValue("");
  }

  function handlePromptSelect(prompt: string) {
    setInputValue(prompt);
  }

  async function handleSubmit() {
    const content = inputValue.trim();

    if (!content || isSubmitting) {
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

    const nextConversation = [
      ...messages.filter((message) => message.role !== "error"),
      userMessage,
    ];

    setMessages((current) => [...current, userMessage, assistantPlaceholder]);
    setInputValue("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextConversation,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Gemini 暂时不可用。");
      }

      const parsed = chatResponseSchema.parse(payload);

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantPlaceholder.id ? parsed.message : message,
        ),
      );
    } catch (error) {
      setMessages((current) =>
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
  }

  return {
    messages,
    inputValue,
    isSubmitting,
    setInputValue,
    handlePromptSelect,
    handleResetConversation,
    handleSubmit,
  };
}
