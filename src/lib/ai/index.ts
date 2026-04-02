import { ChatMessage } from "@/lib/schemas/chat";
import { ResolvedAIModel } from "@/lib/supabase/model-registry";
import { generateWithGemini } from "./gemini";
import { generateWithOpenAICompatible } from "./openai-compatible";

type GenerateAssistantReplyOptions = {
  model?: ResolvedAIModel | null;
  conversationSystemPrompt?: string | null;
};

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
