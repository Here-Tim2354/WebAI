import { NextResponse } from "next/server";
import { streamAssistantReply } from "@/lib/ai";
import {
  mergeAbortSignals,
  registerConversationStream,
  unregisterConversationStream,
} from "@/lib/ai/stream-control";
import { ServerEnvError } from "@/lib/env/server";
import {
  ChatStreamEvent,
  sendMessageRequestSchema,
} from "@/lib/schemas/chat";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import { getEnabledModelById, ModelRegistryError } from "@/lib/supabase/model-registry";
import {
  ConversationAccessError,
  getConversationById,
  touchConversation,
  updateConversation,
} from "@/lib/supabase/conversations";
import {
  createConversationMessage,
  listConversationMessages,
  updateConversationMessage,
} from "@/lib/supabase/messages";

const STREAM_PERSIST_INTERVAL_MS = 120;

// 聊天接口一定绑定真实登录用户，避免匿名请求直接驱动数据库写入与模型调用。
function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: {
        message: "请先登录后再继续。",
      },
    },
    { status: 401 },
  );
}

/**
 * 聊天链路同时依赖数据库、模型注册表和环境变量。
 * 这里把不同来源的错误分开翻译，避免前端只能收到模糊的 500。
 */
function handleChatError(error: unknown) {
  if (error instanceof ConversationAccessError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
        },
      },
      { status: 404 },
    );
  }

  if (error instanceof ServerEnvError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
        },
      },
      { status: 500 },
    );
  }

  if (error instanceof ModelRegistryError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
        },
      },
      { status: 400 },
    );
  }

  const message =
    error instanceof Error
      ? error.message
      : "模型暂时不可用，请稍后重试。";

  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status: 500 },
  );
}

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
 * 发送消息的主链路已经切换成纯流式：
 * 1. 校验请求和会话归属
 * 2. 写入用户消息
 * 3. 创建 assistant 占位记录
 * 4. 边生成边更新同一条 assistant 消息
 * 5. 通过 NDJSON 事件把增量内容推给前端
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            message: "请求体必须是合法 JSON。",
          },
        },
        { status: 400 },
      );
    }

    const parsedRequest = sendMessageRequestSchema.safeParse(payload);

    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          error: {
            message:
              parsedRequest.error.issues[0]?.message ?? "请求数据格式不正确。",
          },
        },
        { status: 400 },
      );
    }

    const { conversationId, content, modelId, urls } = parsedRequest.data;

    // 先校验会话归属关系，再允许后续消息写入，避免把消息插进不属于当前用户的会话。
    let conversation = await getConversationById(supabase, user.id, conversationId);

    if (modelId && conversation.modelId !== modelId) {
      conversation = await updateConversation(supabase, user.id, conversationId, {
        modelId,
      });
    }

    await createConversationMessage(supabase, conversationId, "user", content);

    conversation = await touchConversation(supabase, user.id, conversationId);
    // messagesForModel 读取的是“用户消息已写入数据库之后”的完整上下文，
    // 这样模型看到的上下文和最终持久化状态保持一致。
    const messagesForModel = await listConversationMessages(supabase, conversationId);
    const effectiveModelId = modelId ?? conversation.modelId;
    const selectedModel = effectiveModelId
      ? await getEnabledModelById(supabase, effectiveModelId)
      : null;
    const assistantMessage = await createConversationMessage(
      supabase,
      conversationId,
      "assistant",
      "",
      "pending",
    );
    const encoder = new TextEncoder();
    const serverAbortController = new AbortController();
    const mergedAbortController = mergeAbortSignals([
      request.signal,
      serverAbortController.signal,
    ]);

    registerConversationStream(conversationId, serverAbortController);
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
              model: selectedModel,
              conversationSystemPrompt: nextConversation.systemPrompt,
              webSearchEnabled: nextConversation.webSearchEnabled,
              urls,
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
                conversationId,
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
              conversationId,
              nextAssistantMessage.id,
              {
                content: streamedContent,
                status: "complete",
              },
            );
            nextConversation = await touchConversation(
              supabase,
              user.id,
              conversationId,
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
              conversationId,
              nextAssistantMessage.id,
              {
                content: fallbackContent,
                status: isCancelled ? "cancelled" : "error",
              },
            );
            nextConversation = await touchConversation(
              supabase,
              user.id,
              conversationId,
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
              conversationId,
              serverAbortController,
            );
          }
        })();
      },
    });

    return createStreamResponse(responseStream);
  } catch (error) {
    return handleChatError(error);
  }
}
