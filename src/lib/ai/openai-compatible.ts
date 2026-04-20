import { getServerEnv, requireServerEnvValue } from "@/lib/env/server";
import { ChatMessage } from "@/lib/schemas/chat";
import { RuntimeAIModel } from "@/lib/supabase/model-registry";
import { getSystemInstruction } from "./system-instruction";

type GenerateWithOpenAICompatibleOptions = {
  model: RuntimeAIModel;
  conversationSystemPrompt?: string | null;
  abortSignal?: AbortSignal;
};

type OpenAICompatibleMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAICompatibleStreamChunk = {
  choices?: Array<{
    delta?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
};

// 允许数据库里配置的 base_url 带尾部斜杠，真正拼接请求路径前统一清洗一次。
function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

// OpenAI 兼容接口要求 messages 是 role/content 结构。
// system prompt 不作为单独字段传，而是显式插入为第一条 system 消息。
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

// 有些 OpenAI 兼容服务会把 delta.content 返回成字符串，
// 也有些会返回 content parts 数组，这里统一抽成纯文本。
function extractAssistantDelta(payload: OpenAICompatibleStreamChunk) {
  const content = payload.choices?.[0]?.delta?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => part.text ?? "")
      .join("");
  }

  return "";
}

/**
 * OpenAI compatible 流式调用走原始 HTTP，而不是官方 SDK。
 * 这样更容易兼容多家“长得像 OpenAI”的上游服务，也方便直接消费 SSE chunk。
 */
export async function* streamWithOpenAICompatible(
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
      stream: true,
    }),
    signal: options.abortSignal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | {
          error?: {
            message?: string;
          };
        }
      | null;

    throw new Error(
      payload && "error" in payload
        ? payload.error?.message ?? "OpenAI 兼容模型调用失败。"
        : "OpenAI 兼容模型调用失败。",
    );
  }

  if (!response.body) {
    throw new Error("OpenAI 兼容模型未返回流式响应体。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasDelta = false;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const lines = event
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data:"));

        for (const line of lines) {
          const payload = line.slice("data:".length).trim();

          if (!payload) {
            continue;
          }

          if (payload === "[DONE]") {
            continue;
          }

          let parsedChunk: OpenAICompatibleStreamChunk;

          try {
            parsedChunk = JSON.parse(payload) as OpenAICompatibleStreamChunk;
          } catch {
            continue;
          }

          const delta = extractAssistantDelta(parsedChunk);

          if (!delta) {
            continue;
          }

          hasDelta = true;
          yield delta;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!hasDelta) {
    throw new Error("OpenAI 兼容模型返回了空内容，请稍后重试。");
  }
}
