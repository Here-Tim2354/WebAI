import { NextResponse } from "next/server";
import { generateAssistantReply } from "@/lib/ai";
import { ServerEnvError } from "@/lib/env/server";
import {
  chatSessionResponseSchema,
  sendMessageRequestSchema,
} from "@/lib/schemas/chat";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import { getEnabledModelById, ModelRegistryError } from "@/lib/supabase/model-registry";
import {
  ConversationAccessError,
  getConversationById,
  touchConversation,
} from "@/lib/supabase/conversations";
import {
  createConversationMessage,
  listConversationMessages,
} from "@/lib/supabase/messages";

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

    const { conversationId, content, modelId } = parsedRequest.data;

    await getConversationById(supabase, user.id, conversationId);
    await createConversationMessage(supabase, conversationId, "user", content);

    let conversation = await touchConversation(supabase, user.id, conversationId);
    const messagesForModel = await listConversationMessages(supabase, conversationId);
    const selectedModel = modelId
      ? await getEnabledModelById(supabase, modelId)
      : null;

    const reply = await generateAssistantReply(messagesForModel, {
      model: selectedModel,
      conversationSystemPrompt: conversation.systemPrompt,
    });

    await createConversationMessage(supabase, conversationId, "assistant", reply);
    conversation = await touchConversation(supabase, user.id, conversationId);

    const messages = await listConversationMessages(supabase, conversationId);

    return NextResponse.json(
      chatSessionResponseSchema.parse({
        conversation,
        messages,
      }),
    );
  } catch (error) {
    return handleChatError(error);
  }
}
