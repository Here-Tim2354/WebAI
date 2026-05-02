import { type SupabaseClient } from "@supabase/supabase-js";
import { streamAssistantReply } from "@/lib/ai";
import {
  mergeAbortSignals,
  registerConversationStream,
  unregisterConversationStream,
} from "@/lib/ai/stream-control";
import {
  type ChatMessage,
  type ChatMessageMetadata,
  type MessageAttachment,
  type ChatStreamEvent,
} from "@/lib/schemas/chat";
import { type Conversation } from "@/lib/schemas/conversation";
import { type ThinkingLevel } from "@/lib/schemas/thinking";
import { type RuntimeAIModel } from "@/lib/supabase/model-registry";
import {
  createConversationMessage,
  updateConversationMessage,
} from "@/lib/supabase/messages";
import { touchConversation } from "@/lib/supabase/conversations";
import { getNetworkErrorMessage } from "@/lib/network-errors";

const STREAM_PERSIST_INTERVAL_MS = 120;

type CreateAssistantStreamResponseOptions = {
  supabase: SupabaseClient;
  userId: string;
  conversation: Conversation;
  messagesForModel: ChatMessage[];
  model: RuntimeAIModel | null;
  thinkingLevel?: ThinkingLevel;
  urls?: string[];
  attachments?: MessageAttachment[];
  requestSignal: AbortSignal;
};

function createStreamEventChunk(event: ChatStreamEvent) {
  // 前端按行解析 NDJSON，所以每个事件必须用换行作为边界。
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

function getAssistantFailureContent(error: unknown) {
  return (
    getNetworkErrorMessage(
      error,
      "云端连接暂时不稳定，附件内容或模型响应读取失败。请稍后重试，或重新发送这条消息。",
    ) ??
    (error instanceof Error
      ? error.message
      : "模型暂时不可用，请稍后重试。")
  );
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
  attachments,
  thinkingLevel,
  requestSignal,
}: CreateAssistantStreamResponseOptions) {
  // assistant 占位消息先落库，前端才能立刻拿到稳定 ID 并在后续事件里替换同一条气泡。
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

  // /api/chat/cancel 通过 conversationId 找到这里注册的 AbortController。
  // requestSignal 则覆盖浏览器主动断开连接的场景。
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
        let streamedThinkingContent = "";
        let hasPersistedStreamingState = false;
        let lastPersistedAt = 0;

        enqueueEvent({
          type: "assistant-message-created",
          message: nextAssistantMessage,
        });

        try {
          const messagesWithRequestAttachments =
            attachments && attachments.length > 0
              ? messagesForModel.map((message, index) =>
                  index === messagesForModel.length - 1 &&
                  message.role === "user"
                    ? {
                        ...message,
                        metadata: {
                          ...message.metadata,
                          attachments,
                        },
                      }
                    : message,
                )
              : messagesForModel;

          // 附件在消息 metadata 中持久化，但本次请求可能带来刚编辑过的附件。
          // 发给模型前把请求附件合并到最后一条 user 消息，保证模型看到的是最新上下文。
          for await (const streamDelta of streamAssistantReply(
            messagesWithRequestAttachments,
            {
              model,
              conversationSystemPrompt: nextConversation.systemPrompt,
              webSearchEnabled: nextConversation.webSearchEnabled,
              urls,
              supabase,
              thinkingLevel,
              abortSignal: mergedAbortController.signal,
            },
          )) {
            if (!streamDelta.delta) {
              continue;
            }

            if (streamDelta.type === "thought") {
              streamedThinkingContent += streamDelta.delta;
            } else {
              streamedContent += streamDelta.delta;
            }

            const nextMetadata: ChatMessageMetadata =
              streamedThinkingContent.length > 0
                ? {
                    ...nextAssistantMessage.metadata,
                    thinking: {
                      content: streamedThinkingContent,
                      level: thinkingLevel ?? conversation.thinkingLevel,
                      status: "streaming",
                    },
                  }
                : nextAssistantMessage.metadata;
            nextAssistantMessage = {
              ...nextAssistantMessage,
              content: streamedContent,
              status: "streaming",
              metadata: nextMetadata,
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

            // 不按每个 token 写库，避免流式输出把数据库更新频率打得太高。
            // 前端仍然会收到每个 delta；数据库只做节流后的中间态和最终态。
            nextAssistantMessage = await updateConversationMessage(
              supabase,
              conversation.id,
              nextAssistantMessage.id,
              {
                content: streamedContent,
                status: "streaming",
                metadata: nextMetadata,
              },
            );
            hasPersistedStreamingState = true;
            lastPersistedAt = now;
          }

          if (!streamedContent.trim()) {
            throw new Error("模型返回了空内容，请稍后重试。");
          }

          // 最后一笔写库使用 complete 状态，保证历史恢复不会停在 streaming。
          nextAssistantMessage = await updateConversationMessage(
            supabase,
            conversation.id,
            nextAssistantMessage.id,
            {
              content: streamedContent,
              status: "complete",
              ...(streamedThinkingContent.length > 0
                ? {
                    metadata: {
                      ...nextAssistantMessage.metadata,
                      thinking: {
                        content: streamedThinkingContent,
                        level: thinkingLevel ?? conversation.thinkingLevel,
                        status: "complete",
                      },
                    },
                  }
                : {}),
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
                : getAssistantFailureContent(error);
          const fallbackMetadata: ChatMessageMetadata =
            streamedThinkingContent.length > 0
              ? {
                  ...nextAssistantMessage.metadata,
                  thinking: {
                    content: streamedThinkingContent,
                    level: thinkingLevel ?? conversation.thinkingLevel,
                    status: isCancelled ? "cancelled" : "error",
                  },
                }
              : nextAssistantMessage.metadata;

          // 取消与真实错误都需要写回 assistant 记录；
          // 区别在于取消不再继续向已中断的前端推送 done 事件。
          nextAssistantMessage = await updateConversationMessage(
            supabase,
            conversation.id,
            nextAssistantMessage.id,
            {
              content: fallbackContent,
              status: isCancelled ? "cancelled" : "error",
              metadata: fallbackMetadata,
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
