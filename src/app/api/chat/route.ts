import { NextResponse } from "next/server";
import { createAssistantStreamResponse } from "@/lib/ai/assistant-stream-response";
import { assertAttachmentInputAllowed } from "@/lib/attachment-capabilities";
import { ServerEnvError } from "@/lib/env/server";
import { getNetworkErrorMessage } from "@/lib/network-errors";
import { sendMessageRequestSchema } from "@/lib/schemas/chat";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  getEnabledModelById,
  ModelRegistryError,
} from "@/lib/supabase/model-registry";
import {
  ConversationAccessError,
  getConversationById,
  touchConversation,
  updateConversation,
} from "@/lib/supabase/conversations";
import {
  createConversationMessage,
  listConversationMessages,
} from "@/lib/supabase/messages";

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
    getNetworkErrorMessage(
      error,
      "云端连接暂时不稳定，请稍后重试。",
    ) ??
    (error instanceof Error
      ? error.message
      : "模型暂时不可用，请稍后重试。");

  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status: 500 },
  );
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

    const { conversationId, content, modelId, thinkingLevel, urls, attachments } =
      parsedRequest.data;

    // 先校验会话归属关系，再允许后续消息写入，避免把消息插进不属于当前用户的会话。
    let conversation = await getConversationById(supabase, user.id, conversationId);

    if (
      (modelId && conversation.modelId !== modelId) ||
      (
        thinkingLevel !== undefined &&
        conversation.thinkingLevel !== thinkingLevel
      )
    ) {
      conversation = await updateConversation(supabase, user.id, conversationId, {
        modelId,
        thinkingLevel,
      });
    }

    const effectiveModelId = modelId ?? conversation.modelId;
    const selectedModel = effectiveModelId
      ? await getEnabledModelById(supabase, effectiveModelId)
      : null;

    // 附件 metadata 由前端传入，但对象本身已经在私有 Storage 中。
    // 这里统一确认路径归属和模型能力，避免用户伪造其它用户的 storagePath。
    assertAttachmentInputAllowed({
      userId: user.id,
      attachments: attachments ?? [],
      model: selectedModel,
    });

    await createConversationMessage(
      supabase,
      conversationId,
      "user",
      content,
      "complete",
      {
        ...(urls && urls.length > 0 ? { urls } : {}),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      },
    );

    conversation = await touchConversation(supabase, user.id, conversationId);
    // messagesForModel 读取的是“用户消息已写入数据库之后”的完整上下文，
    // 这样模型看到的上下文和最终持久化状态保持一致。
    const messagesForModel = await listConversationMessages(supabase, conversationId);
    return createAssistantStreamResponse({
      supabase,
      userId: user.id,
      conversation,
      messagesForModel,
      model: selectedModel,
      thinkingLevel: conversation.thinkingLevel,
      urls,
      attachments,
      requestSignal: request.signal,
    });
  } catch (error) {
    return handleChatError(error);
  }
}
