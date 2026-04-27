import { ChatMessage } from "@/lib/schemas/chat";
import { SupabaseClient } from "@supabase/supabase-js";
import { RuntimeAIModel } from "@/lib/supabase/model-registry";
import { streamWithGemini } from "./gemini";
import { streamWithOpenAICompatible } from "./openai-compatible";

type StreamAssistantReplyOptions = {
  model?: RuntimeAIModel | null;
  conversationSystemPrompt?: string | null;
  webSearchEnabled?: boolean;
  urls?: string[];
  supabase?: SupabaseClient;
  abortSignal?: AbortSignal;
};

/**
 * AI 流式调用入口只做 provider 分发，不掺杂 provider 细节。
 * 上层聊天接口始终按“增量文本片段”消费，不再保留一次性整段返回的旧模式。
 */
export async function* streamAssistantReply(
  messages: ChatMessage[],
  options?: StreamAssistantReplyOptions,
) {
  if (options?.model?.provider === "openai_compatible") {
    yield* streamWithOpenAICompatible(messages, {
      model: options.model,
      conversationSystemPrompt: options.conversationSystemPrompt,
      abortSignal: options.abortSignal,
    });

    return;
  }

  yield* streamWithGemini(messages, {
    conversationSystemPrompt: options?.conversationSystemPrompt,
    webSearchEnabled: options?.webSearchEnabled,
    urls: options?.urls,
    supabase: options?.supabase,
    modelName:
      options?.model?.provider === "gemini"
        ? options.model.upstreamModelId
        : undefined,
    abortSignal: options?.abortSignal,
  });
}
