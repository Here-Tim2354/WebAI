import { NextResponse } from "next/server";
import { createAssistantStreamResponse } from "@/lib/ai/assistant-stream-response";
import { ServerEnvError } from "@/lib/env/server";
import { editMessageRequestSchema } from "@/lib/schemas/chat";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  ConversationAccessError,
  getConversationById,
  touchConversation,
  updateConversation,
} from "@/lib/supabase/conversations";
import {
  getEnabledModelById,
  ModelRegistryError,
} from "@/lib/supabase/model-registry";
import {
  editUserMessageAndDeleteFollowing,
  getConversationMessage,
  listConversationMessages,
} from "@/lib/supabase/messages";

type RouteContext = {
  params: Promise<{
    messageId: string;
  }>;
};

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

function handleMessageError(error: unknown) {
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
    error instanceof Error ? error.message : "消息操作失败，请稍后再试。";

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
 * 编辑 user 消息采用覆盖式语义：
 * 原子更新目标消息并移除后续上下文，然后立即创建新的 assistant 流式回复。
 */
export async function PATCH(request: Request, context: RouteContext) {
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

    const parsed = editMessageRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: parsed.error.issues[0]?.message ?? "消息编辑参数不正确。",
          },
        },
        { status: 400 },
      );
    }

    const { messageId } = await context.params;
    const { conversationId, content, modelId } = parsed.data;
    let conversation = await getConversationById(
      supabase,
      user.id,
      conversationId,
    );
    const targetMessage = await getConversationMessage(
      supabase,
      conversationId,
      messageId,
    );

    if (targetMessage.sender_type !== "user") {
      return NextResponse.json(
        {
          error: {
            message: "只能编辑你发送的消息。",
          },
        },
        { status: 400 },
      );
    }

    if (modelId && conversation.modelId !== modelId) {
      conversation = await updateConversation(supabase, user.id, conversationId, {
        modelId,
      });
    }

    await editUserMessageAndDeleteFollowing(
      supabase,
      conversationId,
      messageId,
      content,
    );
    conversation = await touchConversation(
      supabase,
      user.id,
      conversationId,
    );
    const messagesForModel = await listConversationMessages(
      supabase,
      conversationId,
    );
    const effectiveModelId = modelId ?? conversation.modelId;
    const selectedModel = effectiveModelId
      ? await getEnabledModelById(supabase, effectiveModelId)
      : null;
    return createAssistantStreamResponse({
      supabase,
      userId: user.id,
      conversation,
      messagesForModel,
      model: selectedModel,
      requestSignal: request.signal,
    });
  } catch (error) {
    return handleMessageError(error);
  }
}
