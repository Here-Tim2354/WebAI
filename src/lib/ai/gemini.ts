import { Content, GoogleGenAI } from "@google/genai";
import { getServerEnv, requireServerEnvValue } from "@/lib/env/server";
import { ChatMessage } from "@/lib/schemas/chat";
import { getSystemInstruction } from "./system-instruction";

type GenerateWithGeminiOptions = {
  conversationSystemPrompt?: string | null;
  modelName?: string;
};

// Gemini SDK 的历史消息结构不是 role/content，而是 Content.parts。
// 这里把统一消息模型转换成 Gemini 期望的 contents 格式。
function toGeminiContents(messages: ChatMessage[]): Content[] {
  return messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        message.content.trim().length > 0,
    )
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
}

/**
 * Gemini 调用走 @google/genai SDK。
 * system instruction 和 contents 是分开的两个参数，这和 OpenAI compatible 的组装方式不同。
 */
export async function generateWithGemini(
  messages: ChatMessage[],
  options?: GenerateWithGeminiOptions,
) {
  const env = getServerEnv();
  const apiKey = requireServerEnvValue(
    env.GEMINI_API_KEY,
    "缺少 GEMINI_API_KEY。",
  );
  const systemInstruction = getSystemInstruction(messages, {
    conversationSystemPrompt: options?.conversationSystemPrompt,
  });
  const contents = toGeminiContents(messages);

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

  const response = await client.models.generateContent({
    model: options?.modelName ?? env.GEMINI_MODEL,
    contents,
    config: systemInstruction
      ? {
          // Gemini 把 system prompt 放在 config.systemInstruction，而不是消息列表里。
          systemInstruction,
        }
      : undefined,
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini 返回了空内容，请稍后重试。");
  }

  return text;
}
