import { NextResponse } from "next/server";
import { createAssistantStreamResponse } from "@/lib/ai/assistant-stream-response";
import { ServerEnvError } from "@/lib/env/server";
import { regenerateAssistantMessageRequestSchema } from "@/lib/schemas/chat";
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
  deleteConversationMessagesById,
  listConversationMessages,
  updateConversationMessage,
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
      : "重新生成失败，请稍后再试。";

  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
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

    const parsed = regenerateAssistantMessageRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message:
              parsed.error.issues[0]?.message ?? "重新生成参数不正确。",
          },
        },
        { status: 400 },
      );
    }

    const { messageId } = await context.params;
    const { conversationId, modelId, webSearchEnabled, urls } = parsed.data;
    let conversation = await getConversationById(
      supabase,
      user.id,
      conversationId,
    );
    const messages = await listConversationMessages(supabase, conversationId);
    const targetMessageIndex = messages.findIndex(
      (message) => message.id === messageId,
    );

    if (targetMessageIndex === -1) {
      return NextResponse.json(
        {
          error: {
            message: "消息不存在，或你没有访问权限。",
          },
        },
        { status: 404 },
      );
    }

    const targetMessage = messages[targetMessageIndex];

    if (targetMessage.role !== "assistant") {
      return NextResponse.json(
        {
          error: {
            message: "只能重新生成 assistant 消息。",
          },
        },
        { status: 400 },
      );
    }

    if (targetMessageIndex !== messages.length - 1) {
      return NextResponse.json(
        {
          error: {
            message: "仅最新对话可重新生成。",
          },
        },
        { status: 400 },
      );
    }

    if (
      targetMessage.status === "pending" ||
      targetMessage.status === "streaming"
    ) {
      return NextResponse.json(
        {
          error: {
            message: "消息生成完成后才能重新生成。",
          },
        },
        { status: 400 },
      );
    }

    const messagesForModel = messages.slice(0, targetMessageIndex);

    if (messagesForModel.length === 0) {
      return NextResponse.json(
        {
          error: {
            message: "没有可用于重新生成的上下文。",
          },
        },
        { status: 400 },
      );
    }

    const previousUserMessage = [...messagesForModel]
      .reverse()
      .find((message) => message.role === "user");

    if (!previousUserMessage) {
      return NextResponse.json(
        {
          error: {
            message: "没有可用于重新生成的用户消息。",
          },
        },
        { status: 400 },
      );
    }

    const effectiveUrls = urls ?? previousUserMessage.metadata.urls;

    if (urls !== undefined) {
      await updateConversationMessage(
        supabase,
        conversationId,
        previousUserMessage.id,
        {
          metadata: {
            ...previousUserMessage.metadata,
            urls,
          },
        },
      );
      previousUserMessage.metadata = {
        ...previousUserMessage.metadata,
        urls,
      };
    }

    if (
      (modelId && conversation.modelId !== modelId) ||
      (
        webSearchEnabled !== undefined &&
        conversation.webSearchEnabled !== webSearchEnabled
      )
    ) {
      conversation = await updateConversation(
        supabase,
        user.id,
        conversationId,
        {
          modelId: modelId ?? undefined,
          webSearchEnabled,
        },
      );
    }

    await deleteConversationMessagesById(supabase, conversationId, [messageId]);
    conversation = await touchConversation(supabase, user.id, conversationId);
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
      urls: effectiveUrls,
      requestSignal: request.signal,
    });
  } catch (error) {
    return handleRegenerateError(error);
  }
}
