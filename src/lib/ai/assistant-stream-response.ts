import { type SupabaseClient } from "@supabase/supabase-js";
import { streamAssistantReply } from "@/lib/ai";
import {
  mergeAbortSignals,
  registerConversationStream,
  unregisterConversationStream,
} from "@/lib/ai/stream-control";
import {
  type ChatMessage,
  type ChatStreamEvent,
} from "@/lib/schemas/chat";
import { type Conversation } from "@/lib/schemas/conversation";
import { type RuntimeAIModel } from "@/lib/supabase/model-registry";
import {
  createConversationMessage,
  updateConversationMessage,
} from "@/lib/supabase/messages";
import { touchConversation } from "@/lib/supabase/conversations";

const STREAM_PERSIST_INTERVAL_MS = 120;

type CreateAssistantStreamResponseOptions = {
  supabase: SupabaseClient;
  userId: string;
  conversation: Conversation;
  messagesForModel: ChatMessage[];
  model: RuntimeAIModel | null;
  urls?: string[];
  requestSignal: AbortSignal;
};

function createStreamEventChunk(event: ChatStreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function createStreamResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * 统一生成 assistant 流式响应，并把每个阶段同步到 messages 表。
 * 路由层只负责准备上下文，这里负责“生成 + 落库 + NDJSON 事件”。
 */
export async function createAssistantStreamResponse({
  supabase,
  userId,
  conversation,
  messagesForModel,
  model,
  urls,
  requestSignal,
}: CreateAssistantStreamResponseOptions) {
  const assistantMessage = await createConversationMessage(
    supabase,
    conversation.id,
    "assistant",
    "",
    "pending",
  );
  const encoder = new TextEncoder();
  const serverAbortController = new AbortController();
  const mergedAbortController = mergeAbortSignals([
    requestSignal,
    serverAbortController.signal,
  ]);

  registerConversationStream(conversation.id, serverAbortController);

  const responseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueueEvent = (event: ChatStreamEvent) => {
        controller.enqueue(encoder.encode(createStreamEventChunk(event)));
      };

      const closeStream = () => {
        try {
          controller.close();
        } catch {
          // 流已关闭时不需要重复处理。
        }
      };

      void (async () => {
        let nextConversation = conversation;
        let nextAssistantMessage = assistantMessage;
        let streamedContent = "";
        let hasPersistedStreamingState = false;
        let lastPersistedAt = 0;

        enqueueEvent({
          type: "assistant-message-created",
          message: nextAssistantMessage,
        });

        try {
          for await (const delta of streamAssistantReply(messagesForModel, {
            model,
            conversationSystemPrompt: nextConversation.systemPrompt,
            webSearchEnabled: nextConversation.webSearchEnabled,
            urls,
            supabase,
            abortSignal: mergedAbortController.signal,
          })) {
            if (!delta) {
              continue;
            }

            streamedContent += delta;
            nextAssistantMessage = {
              ...nextAssistantMessage,
              content: streamedContent,
              status: "streaming",
            };

            enqueueEvent({
              type: "assistant-message-updated",
              message: nextAssistantMessage,
            });

            const now = Date.now();
            const shouldPersistStreamingState =
              !hasPersistedStreamingState ||
              now - lastPersistedAt >= STREAM_PERSIST_INTERVAL_MS;

            if (!shouldPersistStreamingState) {
              continue;
            }

            nextAssistantMessage = await updateConversationMessage(
              supabase,
              conversation.id,
              nextAssistantMessage.id,
              {
                content: streamedContent,
                status: "streaming",
              },
            );
            hasPersistedStreamingState = true;
            lastPersistedAt = now;
          }

          if (!streamedContent.trim()) {
            throw new Error("模型返回了空内容，请稍后重试。");
          }

          nextAssistantMessage = await updateConversationMessage(
            supabase,
            conversation.id,
            nextAssistantMessage.id,
            {
              content: streamedContent,
              status: "complete",
            },
          );
          nextConversation = await touchConversation(
            supabase,
            userId,
            conversation.id,
          );

          enqueueEvent({
            type: "assistant-message-updated",
            message: nextAssistantMessage,
          });
          enqueueEvent({
            type: "conversation-updated",
            conversation: nextConversation,
          });
          enqueueEvent({
            type: "done",
            conversation: nextConversation,
            message: nextAssistantMessage,
          });
          closeStream();
        } catch (error) {
          const isCancelled =
            mergedAbortController.signal.aborted || isAbortError(error);
          const fallbackContent =
            streamedContent.trim().length > 0
              ? streamedContent
              : isCancelled
                ? ""
                : error instanceof Error
                  ? error.message
                  : "模型暂时不可用，请稍后重试。";

          nextAssistantMessage = await updateConversationMessage(
            supabase,
            conversation.id,
            nextAssistantMessage.id,
            {
              content: fallbackContent,
              status: isCancelled ? "cancelled" : "error",
            },
          );
          nextConversation = await touchConversation(
            supabase,
            userId,
            conversation.id,
          );

          if (!mergedAbortController.signal.aborted) {
            enqueueEvent({
              type: "assistant-message-updated",
              message: nextAssistantMessage,
            });
            enqueueEvent({
              type: "conversation-updated",
              conversation: nextConversation,
            });
            enqueueEvent({
              type: "done",
              conversation: nextConversation,
              message: nextAssistantMessage,
            });
          }

          closeStream();
        } finally {
          unregisterConversationStream(
            conversation.id,
            serverAbortController,
          );
        }
      })();
    },
  });

  return createStreamResponse(responseStream);
}
