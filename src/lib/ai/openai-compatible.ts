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

// 有些 OpenAI 兼容服务会把 content 返回成字符串，
// 也有些会返回 content parts 数组，这里统一抽成纯文本。
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

/**
 * OpenAI compatible 调用走原始 HTTP，而不是官方 SDK。
 * 这样更容易兼容多家“长得像 OpenAI”的上游服务。
 */
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
      // 当前 phase 还没接流式输出，这里显式关闭 stream，保持返回结构简单稳定。
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
