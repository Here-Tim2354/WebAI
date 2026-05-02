import {
  Content,
  GoogleGenAI,
  ThinkingLevel as GeminiThinkingLevel,
} from "@google/genai";
import { SupabaseClient } from "@supabase/supabase-js";
import { downloadAttachmentBuffer } from "@/lib/attachments";
import { getServerEnv, requireServerEnvValue } from "@/lib/env/server";
import { ChatMessage, MessageAttachment } from "@/lib/schemas/chat";
import { ThinkingLevel } from "@/lib/schemas/thinking";
import { getSystemInstruction } from "./system-instruction";
import { AssistantStreamDelta } from "./types";

type GenerateWithGeminiOptions = {
  conversationSystemPrompt?: string | null;
  webSearchEnabled?: boolean;
  urls?: string[];
  supabase?: SupabaseClient;
  modelName?: string;
  thinkingLevel?: ThinkingLevel;
  abortSignal?: AbortSignal;
};

type GeminiStreamChunkPart = {
  text?: string;
  thought?: boolean;
};

type GeminiStreamChunk = {
  text?: string;
  candidates?: Array<{
    content?: {
      parts?: GeminiStreamChunkPart[];
    };
  }>;
};

const geminiThinkingLevelMap = {
  minimal: GeminiThinkingLevel.MINIMAL,
  low: GeminiThinkingLevel.LOW,
  medium: GeminiThinkingLevel.MEDIUM,
  high: GeminiThinkingLevel.HIGH,
} as const satisfies Record<ThinkingLevel, GeminiThinkingLevel>;

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
  // URL Context 是请求级能力，不直接改数据库里的消息正文。
  // 这里只在发给 Gemini 前临时增强最后一条用户消息。
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
    // 附件保存在私有 Storage 中，模型调用前才下载成 Gemini 可消费的 part。
    const buffer = await downloadAttachmentBuffer(supabase, attachment);

    if (
      attachment.kind === "file" &&
      (
        attachment.mimeType === "text/plain" ||
        attachment.mimeType === "text/markdown" ||
        attachment.mimeType === "text/csv"
      )
    ) {
      // 文本类文件直接展开成 text part，比 inlineData 更利于模型读取具体内容。
      parts.push({
        text: [
          `附件：${attachment.fileName}`,
          buffer.toString("utf8"),
        ].join("\n\n"),
      });
      continue;
    }

    // 图片和 PDF 继续用 inlineData。前置 text part 只负责告诉模型附件名。
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
  // Gemini 上下文里只给最新用户消息附加二进制/文本附件。
  // 历史 user 消息仍保留正文，避免每次重新生成都重复下载和传输所有旧附件。
  const latestUserMessageId = [...normalizedMessages]
    .reverse()
    .find((message) => message.role === "user")?.id;

  const contents: Content[] = [];

  for (const message of normalizedMessages) {
    const attachmentParts =
      message.role === "user" && message.id === latestUserMessageId
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
): AsyncGenerator<AssistantStreamDelta> {
  const env = getServerEnv();
  const apiKey = requireServerEnvValue(
    env.GEMINI_API_KEY,
    "缺少 GEMINI_API_KEY。",
  );
  const normalizedUrls = normalizeUrls(options?.urls);
  const messagesWithUrlContext = withUrlContextPrompt(messages, normalizedUrls);
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
      ...(options?.webSearchEnabled || normalizedUrls.length > 0
        ? {
            tools: [
              ...(options?.webSearchEnabled ? [{ googleSearch: {} }] : []),
              ...(normalizedUrls.length > 0 ? [{ urlContext: {} }] : []),
            ],
          }
        : {}),
      ...(options?.thinkingLevel
        ? {
            thinkingConfig: {
              // Gemini 3 Flash 不支持彻底关闭 thinking；minimal 是最低档。
              thinkingLevel: geminiThinkingLevelMap[options.thinkingLevel],
              includeThoughts: true,
            },
          }
        : {}),
      abortSignal: options?.abortSignal,
    },
  });
  let aggregatedText = "";
  let aggregatedThought = "";

  for await (const chunk of response) {
    const normalizedChunk = chunk as GeminiStreamChunk;
    const parts = normalizedChunk.candidates?.[0]?.content?.parts ?? [];
    let hasTextPart = false;

    for (const part of parts) {
      if (!part.text) {
        continue;
      }

      hasTextPart = true;

      if (part.thought) {
        const delta = part.text.startsWith(aggregatedThought)
          ? part.text.slice(aggregatedThought.length)
          : part.text;

        if (!delta) {
          continue;
        }

        aggregatedThought += delta;
        yield {
          type: "thought",
          delta,
        };
        continue;
      }

      const delta = part.text.startsWith(aggregatedText)
        ? part.text.slice(aggregatedText.length)
        : part.text;

      if (!delta) {
        continue;
      }

      aggregatedText += delta;
      yield {
        type: "text",
        delta,
      };
    }

    if (hasTextPart) {
      continue;
    }

    const chunkText = normalizedChunk.text ?? "";

    if (!chunkText) {
      continue;
    }

    const delta = chunkText.startsWith(aggregatedText)
      ? chunkText.slice(aggregatedText.length)
      : chunkText;

    // 不同 Gemini 模型可能返回“累计文本”或“增量文本”。
    // 上层只接受 delta，这里把两种格式统一成新增片段。
    if (!delta) {
      continue;
    }

    aggregatedText += delta;
    yield {
      type: "text",
      delta,
    };
  }

  if (!aggregatedText.trim()) {
    throw new Error("Gemini 返回了空内容，请稍后重试。");
  }
}
