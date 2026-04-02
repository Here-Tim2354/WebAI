import { ChatMessage } from "@/lib/schemas/chat";

type SystemInstructionOptions = {
  conversationSystemPrompt?: string | null;
};

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

  if (instructionParts.length > 0) {
    return instructionParts.join("\n\n");
  }

  return "";
}
