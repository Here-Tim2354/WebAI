import { getServerEnv, requireServerEnvValue } from "@/lib/env/server";
import { ChatMessage } from "@/lib/schemas/chat";
import { ResolvedAIModel } from "@/lib/supabase/model-registry";
import { getSystemInstruction } from "./system-instruction";

type GenerateWithOpenAICompatibleOptions = {
  model: ResolvedAIModel;
  conversationSystemPrompt?: string | null;
};

type OpenAICompatibleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function toOpenAICompatibleMessages(
  messages: ChatMessage[],
  conversationSystemPrompt?: string | null,
): OpenAICompatibleMessage[] {
  const systemInstruction = getSystemInstruction(messages, {
    conversationSystemPrompt,
  });
  const chatMessages = messages
    .filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        message.content.trim().length > 0,
    )
    .map<OpenAICompatibleMessage>((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));

  if (!systemInstruction) {
    return chatMessages;
  }

  return [
    {
      role: "system",
      content: systemInstruction,
    },
    ...chatMessages,
  ];
}

function extractAssistantText(payload: OpenAICompatibleResponse) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");
  }

  return "";
}

export async function generateWithOpenAICompatible(
  messages: ChatMessage[],
  options: GenerateWithOpenAICompatibleOptions,
) {
  const env = getServerEnv();
  const apiKey = requireServerEnvValue(
    env.OPENAI_COMPATIBLE_API_KEY,
    "缺少 OPENAI_COMPATIBLE_API_KEY。",
  );
  const baseUrl = normalizeBaseUrl(
    options.model.baseUrl ??
      env.OPENAI_COMPATIBLE_BASE_URL ??
      "https://api.openai.com/v1",
  );
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model.upstreamModelId,
      messages: toOpenAICompatibleMessages(
        messages,
        options.conversationSystemPrompt,
      ),
      stream: false,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | OpenAICompatibleResponse
    | {
        error?: {
          message?: string;
        };
      }
    | null;

  if (!response.ok) {
    throw new Error(
      payload && "error" in payload
        ? payload.error?.message ?? "OpenAI 兼容模型调用失败。"
        : "OpenAI 兼容模型调用失败。",
    );
  }

  const text = extractAssistantText(payload as OpenAICompatibleResponse);

  if (!text) {
    throw new Error("OpenAI 兼容模型返回了空内容，请稍后重试。");
  }

  return text;
}
