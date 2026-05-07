import {
  ChatMessage,
  chatStreamEventSchema,
  createChatMessage,
} from "@/lib/schemas/chat";
import { Conversation } from "@/lib/schemas/conversation";

type ConsumeAssistantStreamOptions = {
  response: Response;
  conversationId: string;
  assistantPlaceholder: ChatMessage;
  replaceMessage: (
    conversationId: string,
    previousMessageId: string,
    nextMessage: ChatMessage,
  ) => void;
  onConversationSynced: (conversation: Conversation) => void;
};

export function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function mergeAssistantMessageParts(
  previousMessage: ChatMessage | null,
  nextMessage: ChatMessage,
) {
  if (nextMessage.role !== "assistant") {
    return nextMessage;
  }

  if (!previousMessage || previousMessage.role !== "assistant") {
    return {
      ...nextMessage,
      parts: nextMessage.content
        ? [
            {
              type: "text" as const,
              text: nextMessage.content,
            },
          ]
        : [],
    };
  }

  if (!nextMessage.content) {
    return {
      ...nextMessage,
      parts: [],
    };
  }

  if (!previousMessage.content) {
    return {
      ...nextMessage,
      parts: [
        {
          type: "text" as const,
          text: nextMessage.content,
        },
      ],
    };
  }

  if (nextMessage.content === previousMessage.content) {
    return {
      ...nextMessage,
      parts: previousMessage.parts,
    };
  }

  if (nextMessage.content.startsWith(previousMessage.content)) {
    const appendedText = nextMessage.content.slice(previousMessage.content.length);

    if (!appendedText) {
      return {
        ...nextMessage,
        parts: previousMessage.parts,
      };
    }

    return {
      ...nextMessage,
      // parts 保留“每次服务端新增的片段”，MessageBubble 可以据此做更自然的局部 reveal。
      // 如果直接覆盖为完整 content，前端会失去本次新增内容的边界。
      parts: [
        ...previousMessage.parts,
        {
          type: "text" as const,
          text: appendedText,
        },
      ],
    };
  }

  return {
    ...nextMessage,
    // 如果服务端返回的内容不是旧内容的前缀，说明发生了重算或回退。
    // 此时放弃增量拼接，直接用完整文本重建 parts，避免展示错位。
    parts: [
      {
        type: "text" as const,
        text: nextMessage.content,
      },
    ],
  };
}

export function createCancelledAssistantMessage(message: ChatMessage) {
  return createChatMessage({
    id: message.id,
    role: "assistant",
    content: message.content,
    status: "cancelled",
    metadata: {
      ...message.metadata,
      ...(message.metadata.thinking
        ? {
            thinking: {
              ...message.metadata.thinking,
              status: "cancelled" as const,
            },
          }
        : {}),
    },
  });
}

export async function consumeAssistantStream({
  response,
  conversationId,
  assistantPlaceholder,
  replaceMessage,
  onConversationSynced,
}: ConsumeAssistantStreamOptions) {
  if (!response.body) {
    throw new Error("聊天接口未返回流式响应。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  // 流可能把一条 JSON 事件切成多个 Uint8Array，这个 buffer 专门保存未读完的半行。
  let buffer = "";
  let currentAssistantMessageId = assistantPlaceholder.id;
  let latestAssistantMessage = assistantPlaceholder;

  function applyAssistantMessageSnapshot(
    nextSnapshot: ChatMessage,
    previousMessageId = currentAssistantMessageId,
  ) {
    const nextAssistantMessage = mergeAssistantMessageParts(
      latestAssistantMessage,
      nextSnapshot,
    );

    currentAssistantMessageId = nextAssistantMessage.id;
    latestAssistantMessage = nextAssistantMessage;
    replaceMessage(conversationId, previousMessageId, nextAssistantMessage);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmedLine = line.trim();

        if (!trimmedLine) {
          continue;
        }

        const parsedEvent = chatStreamEventSchema.parse(
          JSON.parse(trimmedLine),
        );

        // 服务端事件只表达“消息/会话的新快照”，本地通过 replaceMessage 合并到当前缓存。
        // 这样发送、编辑、重新生成三条链路可以共用同一个流消费器。
        switch (parsedEvent.type) {
          case "assistant-message-created": {
            applyAssistantMessageSnapshot(
              parsedEvent.message,
              assistantPlaceholder.id,
            );
            break;
          }
          case "assistant-message-updated": {
            applyAssistantMessageSnapshot(parsedEvent.message);
            break;
          }
          case "conversation-updated": {
            onConversationSynced(parsedEvent.conversation);
            break;
          }
          case "done": {
            applyAssistantMessageSnapshot(parsedEvent.message);
            onConversationSynced(parsedEvent.conversation);
            break;
          }
        }
      }
    }

    const trailingLine = buffer.trim();

    if (trailingLine) {
      // 正常情况下事件都以换行结束；最后一行没带换行时仍需要兜底处理。
      const parsedEvent = chatStreamEventSchema.parse(JSON.parse(trailingLine));

      if (parsedEvent.type === "done") {
        applyAssistantMessageSnapshot(parsedEvent.message);
        onConversationSynced(parsedEvent.conversation);
      }
    }

    return {
      currentAssistantMessageId,
      latestAssistantMessage,
    };
  } finally {
    reader.releaseLock();
  }
}
