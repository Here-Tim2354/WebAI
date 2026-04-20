import { z } from "zod";
import { conversationSchema } from "./conversation";

export const chatMessageRoleSchema = z.enum([
  "user",
  "assistant",
  "system",
  "error",
]);

export const chatMessageStatusSchema = z.enum([
  "pending",
  "streaming",
  "complete",
  "cancelled",
  "error",
]);

export const chatMessagePartSchema = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
});

export const chatMessageSchema = z.object({
  id: z.string().min(1),
  role: chatMessageRoleSchema,
  content: z.string(),
  parts: z.array(chatMessagePartSchema).default([]),
  status: chatMessageStatusSchema,
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
});

export const chatResponseSchema = z.object({
  message: chatMessageSchema,
});

export const sendMessageRequestSchema = z.object({
  conversationId: z.string().uuid("会话标识不正确。"),
  content: z.string().trim().min(1, "消息不能为空。"),
  modelId: z.string().trim().min(1, "模型标识不能为空。").optional(),
});

export const cancelChatRequestSchema = z.object({
  conversationId: z.string().uuid("会话标识不正确。"),
});

export const chatSessionResponseSchema = z.object({
  conversation: conversationSchema,
  messages: z.array(chatMessageSchema),
});

export const assistantMessageCreatedEventSchema = z.object({
  type: z.literal("assistant-message-created"),
  message: chatMessageSchema,
});

export const assistantMessageUpdatedEventSchema = z.object({
  type: z.literal("assistant-message-updated"),
  message: chatMessageSchema,
});

export const conversationUpdatedEventSchema = z.object({
  type: z.literal("conversation-updated"),
  conversation: conversationSchema,
});

export const chatDoneEventSchema = z.object({
  type: z.literal("done"),
  conversation: conversationSchema,
  message: chatMessageSchema,
});

export const chatStreamEventSchema = z.union([
  assistantMessageCreatedEventSchema,
  assistantMessageUpdatedEventSchema,
  conversationUpdatedEventSchema,
  chatDoneEventSchema,
]);

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>;

type CreateChatMessageInput = {
  id?: string;
  role: ChatMessage["role"];
  content: string;
  status: ChatMessage["status"];
};

// createChatMessage 是前端本地构造消息对象的统一入口。
// 即使消息还没落库，也先保持与 schema 一致，避免 UI 处理“半结构化消息”。
export function createChatMessage(input: CreateChatMessageInput): ChatMessage {
  return {
    id: input.id ?? crypto.randomUUID(),
    role: input.role,
    content: input.content,
    parts: input.content
      ? [
          {
            type: "text",
            text: input.content,
          },
        ]
      : [],
    status: input.status,
  };
}
