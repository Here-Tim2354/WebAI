export const DEFAULT_CONVERSATION_TITLE = "新会话";

const AUTO_TITLE_MAX_CHARS = 10;

export function createAutoConversationTitle(content: string) {
  const normalizedContent = content.replace(/\s+/g, " ").trim();

  if (!normalizedContent) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  const characters = Array.from(normalizedContent);

  if (characters.length <= AUTO_TITLE_MAX_CHARS) {
    return normalizedContent;
  }

  return `${characters.slice(0, AUTO_TITLE_MAX_CHARS).join("")}...`;
}
