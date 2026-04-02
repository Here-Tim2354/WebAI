import { Content, GoogleGenAI } from "@google/genai";
import { getServerEnv, requireServerEnvValue } from "@/lib/env/server";
import { ChatMessage } from "@/lib/schemas/chat";
import { getSystemInstruction } from "./system-instruction";

type GenerateWithGeminiOptions = {
  conversationSystemPrompt?: string | null;
  modelName?: string;
};

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
          baseUrl: env.GEMINI_BASE_URL,
        }
      : undefined,
  });

  const response = await client.models.generateContent({
    model: options?.modelName ?? env.GEMINI_MODEL,
    contents,
    config: systemInstruction
      ? {
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
