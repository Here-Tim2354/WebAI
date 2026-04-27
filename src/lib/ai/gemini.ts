import { Content, GoogleGenAI } from "@google/genai";
import { SupabaseClient } from "@supabase/supabase-js";
import { downloadAttachmentBuffer } from "@/lib/attachments";
import { getServerEnv, requireServerEnvValue } from "@/lib/env/server";
import { ChatMessage, MessageAttachment } from "@/lib/schemas/chat";
import { getSystemInstruction } from "./system-instruction";

type GenerateWithGeminiOptions = {
  conversationSystemPrompt?: string | null;
  webSearchEnabled?: boolean;
  urls?: string[];
  supabase?: SupabaseClient;
  modelName?: string;
  abortSignal?: AbortSignal;
};

function normalizeUrls(urls?: string[]) {
  if (!urls) {
    return [];
  }

  return Array.from(
    new Set(
      urls
        .map((url) => url.trim())
        .filter((url) => url.length > 0),
    ),
  );
}

function withUrlContextPrompt(messages: ChatMessage[], urls: string[]) {
  if (urls.length === 0) {
    return messages;
  }

  const nextMessages = [...messages];
  const lastUserMessageIndex = [...nextMessages].findLastIndex(
    (message) => message.role === "user" && message.content.trim().length > 0,
  );

  if (lastUserMessageIndex === -1) {
    return nextMessages;
  }

  const lastUserMessage = nextMessages[lastUserMessageIndex];
  nextMessages[lastUserMessageIndex] = {
    ...lastUserMessage,
    content: `${lastUserMessage.content}\n\n请结合以下 URL 作为上下文来源：\n${urls
      .map((url, index) => `${index + 1}. ${url}`)
      .join("\n")}`,
  };

  return nextMessages;
}

// Gemini SDK 的历史消息结构不是 role/content，而是 Content.parts。
// 这里把统一消息模型转换成 Gemini 期望的 contents 格式。
async function toGeminiAttachmentParts(
  supabase: SupabaseClient | undefined,
  attachments: MessageAttachment[] | undefined,
) {
  if (!supabase || !attachments || attachments.length === 0) {
    return [];
  }

  const parts = [];

  for (const attachment of attachments) {
    const buffer = await downloadAttachmentBuffer(supabase, attachment);

    if (
      attachment.kind === "file" &&
      (
        attachment.mimeType === "text/plain" ||
        attachment.mimeType === "text/markdown" ||
        attachment.mimeType === "text/csv"
      )
    ) {
      parts.push({
        text: [
          `附件：${attachment.fileName}`,
          buffer.toString("utf8"),
        ].join("\n\n"),
      });
      continue;
    }

    parts.push({
      text: `附件：${attachment.fileName}`,
    });
    parts.push({
      inlineData: {
        mimeType: attachment.mimeType,
        data: buffer.toString("base64"),
      },
    });
  }

  return parts;
}

async function toGeminiContents(
  messages: ChatMessage[],
  supabase?: SupabaseClient,
): Promise<Content[]> {
  const normalizedMessages = messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        (
          message.content.trim().length > 0 ||
          (message.metadata.attachments?.length ?? 0) > 0
        ),
    );

  const contents: Content[] = [];

  for (const message of normalizedMessages) {
    const attachmentParts = message.role === "user"
      ? await toGeminiAttachmentParts(supabase, message.metadata.attachments)
      : [];
    const parts = [
      ...attachmentParts,
      ...(message.content.trim().length > 0 ? [{ text: message.content }] : []),
    ];

    if (parts.length === 0) {
      continue;
    }

    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts,
    });
  }

  return contents;
}

/**
 * Gemini 流式调用走 @google/genai SDK。
 * SDK 的 chunk.text 在不同模型上既可能是增量，也可能是已累计文本，
 * 这里统一折算成“只向上层产出新增片段”。
 */
export async function* streamWithGemini(
  messages: ChatMessage[],
  options?: GenerateWithGeminiOptions,
) {
  const env = getServerEnv();
  const apiKey = requireServerEnvValue(
    env.GEMINI_API_KEY,
    "缺少 GEMINI_API_KEY。",
  );
  const normalizedUrls = normalizeUrls(options?.urls);
  const messagesWithUrlContext = withUrlContextPrompt(messages, normalizedUrls);
  const hasAttachments = messagesWithUrlContext.some(
    (message) => (message.metadata.attachments?.length ?? 0) > 0,
  );
  const systemInstruction = getSystemInstruction(messagesWithUrlContext, {
    conversationSystemPrompt: options?.conversationSystemPrompt,
  });
  const contents = await toGeminiContents(
    messagesWithUrlContext,
    options?.supabase,
  );

  if (contents.length === 0) {
    throw new Error("至少需要一条用户消息才能发起对话。");
  }

  const client = new GoogleGenAI({
    apiKey,
    httpOptions: env.GEMINI_BASE_URL
      ? {
          // 预留给代理网关或兼容层的 baseUrl 覆写能力。
          baseUrl: env.GEMINI_BASE_URL,
        }
      : undefined,
  });

  const response = await client.models.generateContentStream({
    model: options?.modelName ?? env.GEMINI_MODEL,
    contents,
    config: {
      ...(systemInstruction
        ? {
            // Gemini 把 system prompt 放在 config.systemInstruction，而不是消息列表里。
            systemInstruction,
          }
        : {}),
      ...(!hasAttachments && (options?.webSearchEnabled || normalizedUrls.length > 0)
        ? {
            tools: [
              ...(options?.webSearchEnabled ? [{ googleSearch: {} }] : []),
              ...(normalizedUrls.length > 0 ? [{ urlContext: {} }] : []),
            ],
          }
        : {}),
      abortSignal: options?.abortSignal,
    },
  });
  let aggregatedText = "";

  for await (const chunk of response) {
    const chunkText = chunk.text ?? "";

    if (!chunkText) {
      continue;
    }

    const delta = chunkText.startsWith(aggregatedText)
      ? chunkText.slice(aggregatedText.length)
      : chunkText;

    if (!delta) {
      continue;
    }

    aggregatedText += delta;
    yield delta;
  }

  if (!aggregatedText.trim()) {
    throw new Error("Gemini 返回了空内容，请稍后重试。");
  }
}
