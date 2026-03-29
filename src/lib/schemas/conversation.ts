import { z } from "zod";

export const conversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  status: z.enum(["active", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const conversationListResponseSchema = z.object({
  conversations: z.array(conversationSchema),
});

export const conversationResponseSchema = z.object({
  conversation: conversationSchema,
});

export const createConversationRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
});

export const updateConversationRequestSchema = z.object({
  title: z.string().trim().min(1, "标题不能为空。").max(100, "标题不能超过 100 个字符。"),
});

export type Conversation = z.infer<typeof conversationSchema>;
