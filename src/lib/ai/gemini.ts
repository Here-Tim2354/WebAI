import { Content, GoogleGenAI } from "@google/genai";
import { getServerEnv } from "@/lib/env/server";
import { ChatMessage } from "@/lib/schemas/chat";
import { getSystemInstruction } from "./system-instruction";

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

export async function generateAssistantReply(messages: ChatMessage[]) {
  const env = getServerEnv();
  const systemInstruction = getSystemInstruction(messages);
  const contents = toGeminiContents(messages);

  if (contents.length === 0) {
    throw new Error("至少需要一条用户消息才能发起对话。");
  }

  const client = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,
    httpOptions: env.GEMINI_BASE_URL
      ? {
          baseUrl: env.GEMINI_BASE_URL,
        }
      : undefined,
  });

  const response = await client.models.generateContent({
    model: env.GEMINI_MODEL,
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
