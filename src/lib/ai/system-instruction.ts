import { ChatMessage } from "@/lib/schemas/chat";

export function getSystemInstruction(messages: ChatMessage[]) {
  const inlineSystemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  if (inlineSystemMessages.length > 0) {
    return inlineSystemMessages.join("\n\n");
  }

  return "";
}
