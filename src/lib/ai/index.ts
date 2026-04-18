import { ChatMessage } from "@/lib/schemas/chat";
import { ResolvedAIModel } from "@/lib/supabase/model-registry";
import { generateWithGemini } from "./gemini";
import { generateWithOpenAICompatible } from "./openai-compatible";

type GenerateAssistantReplyOptions = {
  model?: ResolvedAIModel | null;
  conversationSystemPrompt?: string | null;
};

/**
 * AI 调用入口只做 provider 分发，不掺杂 provider 细节。
 * 这样上层聊天接口只关心“给我回复”，而不是“该走哪个 SDK / HTTP 协议”。
 */
export async function generateAssistantReply(
  messages: ChatMessage[],
  options?: GenerateAssistantReplyOptions,
) {
  if (options?.model?.provider === "openai_compatible") {
    return generateWithOpenAICompatible(messages, {
      model: options.model,
      conversationSystemPrompt: options.conversationSystemPrompt,
    });
  }

  return generateWithGemini(messages, {
    conversationSystemPrompt: options?.conversationSystemPrompt,
    modelName:
      options?.model?.provider === "gemini"
        ? options.model.upstreamModelId
        : undefined,
  });
}
