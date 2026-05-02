import { z } from "zod";
import {
  DEFAULT_THINKING_LEVEL,
  thinkingLevelSchema,
} from "./thinking";

export const conversationSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  systemPrompt: z.string().max(2000).nullable(),
  modelId: z.string().uuid().nullable(),
  webSearchEnabled: z.boolean(),
  thinkingLevel: thinkingLevelSchema,
  status: z.enum(["active", "archived"]),
  archivedAt: z.string().nullable(),
  isFavorite: z.boolean(),
  favoritedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const conversationListResponseSchema = z.object({
  conversations: z.array(conversationSchema),
});

export const conversationResponseSchema = z.object({
  conversation: conversationSchema,
});

export const conversationStatusSchema = z.enum(["active", "archived"]);

export const createConversationRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional(),
  systemPrompt: z
    .string()
    .trim()
    .max(2000, "会话级提示词不能超过 2000 个字符。")
    .optional(),
  modelId: z.string().uuid("模型标识不正确。").optional(),
  webSearchEnabled: z.boolean().optional(),
  thinkingLevel: thinkingLevelSchema.optional().default(DEFAULT_THINKING_LEVEL),
});

export const updateConversationRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "标题不能为空。")
    .max(100, "标题不能超过 100 个字符。")
    .optional(),
  systemPrompt: z
    .string()
    .trim()
    .max(2000, "会话级提示词不能超过 2000 个字符。")
    .optional(),
  modelId: z.string().uuid("模型标识不正确。").optional(),
  webSearchEnabled: z.boolean().optional(),
  thinkingLevel: thinkingLevelSchema.optional(),
  status: conversationStatusSchema.optional(),
}).refine(
  (value) =>
    value.title !== undefined ||
    value.systemPrompt !== undefined ||
    value.modelId !== undefined ||
    value.webSearchEnabled !== undefined ||
    value.thinkingLevel !== undefined ||
    value.status !== undefined,
  {
    message: "至少需要提供一个可更新字段。",
  },
);

export const conversationSearchResponseSchema = z.object({
  conversations: z.array(conversationSchema),
});

export const branchConversationRequestSchema = z.object({
  messageId: z.string().uuid("消息标识不正确。"),
});

export type Conversation = z.infer<typeof conversationSchema>;
