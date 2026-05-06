import { ChatMessage } from "@/lib/schemas/chat";

type SystemInstructionOptions = {
  conversationSystemPrompt?: string | null;
};

/**
 * 系统指令来源有两类：
 * 1. 会话级 system prompt
 * 2. 消息流里的 inline system message
 * 调用层把它们合并成 Gemini 可直接使用的单一字符串。
 */
export function getSystemInstruction(
  messages: ChatMessage[],
  options?: SystemInstructionOptions,
) {
  const conversationSystemPrompt =
    options?.conversationSystemPrompt?.trim() ?? "";
  const inlineSystemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  const instructionParts = [
    conversationSystemPrompt,
    ...inlineSystemMessages,
  ].filter(Boolean);

  // 统一用双换行拼接，保留段落边界，避免系统规则和会话提示词粘连。
  if (instructionParts.length > 0) {
    return instructionParts.join("\n\n");
  }

  return "";
}
