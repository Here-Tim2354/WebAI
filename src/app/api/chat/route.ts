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

/**
 * 发送消息的主链路：
 * 1. 校验请求和会话归属
 * 2. 先写入用户消息
 * 3. 读取完整上下文并调用模型
 * 4. 再写入 assistant 回复
 * 5. 返回最新会话与消息快照
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

    const { conversationId, content, modelId } = parsedRequest.data;

    // 先校验会话归属关系，再允许后续消息写入，避免把消息插进不属于当前用户的会话。
    await getConversationById(supabase, user.id, conversationId);
    await createConversationMessage(supabase, conversationId, "user", content);

    let conversation = await touchConversation(supabase, user.id, conversationId);
    // messagesForModel 读取的是“用户消息已写入数据库之后”的完整上下文，
    // 这样模型看到的上下文和最终持久化状态保持一致。
    const messagesForModel = await listConversationMessages(supabase, conversationId);
    const selectedModel = modelId
      ? await getEnabledModelById(supabase, modelId)
      : null;

    const reply = await generateAssistantReply(messagesForModel, {
      model: selectedModel,
      conversationSystemPrompt: conversation.systemPrompt,
    });

    await createConversationMessage(supabase, conversationId, "assistant", reply);
    // assistant 回复落库后再次 touch，会让刚发生过对话的会话顶到列表最前面。
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
