import { ChatMessage, GeminiRuntimeConfig } from "@/lib/schemas/chat";
import { SupabaseClient } from "@supabase/supabase-js";
import { RuntimeAIModel } from "@/lib/supabase/model-registry";
import { streamWithGemini } from "./gemini";
import { ThinkingLevel } from "@/lib/schemas/thinking";

type StreamAssistantReplyOptions = {
  model?: RuntimeAIModel | null;
  conversationSystemPrompt?: string | null;
  webSearchEnabled?: boolean;
  urls?: string[];
  supabase?: SupabaseClient;
  thinkingLevel?: ThinkingLevel;
  geminiRuntimeConfig?: GeminiRuntimeConfig;
  abortSignal?: AbortSignal;
};

/**
 * AI 流式调用入口固定走 Gemini。
 * 上层聊天接口始终按“增量文本片段”消费，不再保留一次性整段返回的旧模式。
 */
export async function* streamAssistantReply(
  messages: ChatMessage[],
  options?: StreamAssistantReplyOptions,
) {
  yield* streamWithGemini(messages, {
    conversationSystemPrompt: options?.conversationSystemPrompt,
    webSearchEnabled: options?.webSearchEnabled,
    urls: options?.urls,
    supabase: options?.supabase,
    thinkingLevel: options?.model?.capabilities.reasoning
      ? options?.thinkingLevel
      : undefined,
    runtimeConfig: options?.geminiRuntimeConfig,
    modelName: options?.model?.upstreamModelId,
    modelBaseUrl: options?.model?.baseUrl,
    abortSignal: options?.abortSignal,
  });
}
