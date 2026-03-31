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
  "complete",
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
});

export const chatSessionResponseSchema = z.object({
  conversation: conversationSchema,
  messages: z.array(chatMessageSchema),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;

type CreateChatMessageInput = {
  id?: string;
  role: ChatMessage["role"];
  content: string;
  status: ChatMessage["status"];
};

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
