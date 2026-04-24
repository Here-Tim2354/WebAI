import { NextResponse } from "next/server";
import { createAssistantStreamResponse } from "@/lib/ai/assistant-stream-response";
import { ServerEnvError } from "@/lib/env/server";
import { regenerateMessageRequestSchema } from "@/lib/schemas/chat";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  ConversationAccessError,
  getConversationById,
  touchConversation,
  updateConversation,
} from "@/lib/supabase/conversations";
import { listConversationMessages } from "@/lib/supabase/messages";
import {
  getEnabledModelById,
  ModelRegistryError,
} from "@/lib/supabase/model-registry";

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

function handleRegenerateError(error: unknown) {
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

/**
 * 重新生成不会再插入 user 消息。
 * 它基于当前数据库里已经截断好的上下文，创建新的 assistant 消息并流式更新。
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

    const parsedRequest = regenerateMessageRequestSchema.safeParse(payload);

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

    const { conversationId, modelId } = parsedRequest.data;
    let conversation = await getConversationById(
      supabase,
      user.id,
      conversationId,
    );

    if (modelId && conversation.modelId !== modelId) {
      conversation = await updateConversation(supabase, user.id, conversationId, {
        modelId,
      });
    }

    conversation = await touchConversation(supabase, user.id, conversationId);
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
    return handleRegenerateError(error);
  }
}
