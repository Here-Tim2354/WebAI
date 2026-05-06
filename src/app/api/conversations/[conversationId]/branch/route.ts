import { NextResponse } from "next/server";
import { chatSessionResponseSchema } from "@/lib/schemas/chat";
import { branchConversationRequestSchema } from "@/lib/schemas/conversation";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  ConversationAccessError,
  createBranchConversationTitle,
  createConversation,
  getConversationById,
} from "@/lib/supabase/conversations";
import {
  cloneConversationMessages,
  listConversationMessagesThrough,
} from "@/lib/supabase/messages";

type RouteContext = {
  params: Promise<{
    conversationId: string;
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

function handleBranchError(error: unknown) {
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

  const message =
    error instanceof Error ? error.message : "创建分支会话失败，请稍后再试。";

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
 * assistant 消息分支会创建一个新的普通会话。
 * 新会话继承原会话控制项，并复制从开头到目标 assistant 消息为止的上下文。
 */
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

    const parsed = branchConversationRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: parsed.error.issues[0]?.message ?? "分支参数不正确。",
          },
        },
        { status: 400 },
      );
    }

    const { conversationId } = await context.params;
    const sourceConversation = await getConversationById(
      supabase,
      user.id,
      conversationId,
    );
    // 分支按消息列表位置截断上下文，而不是用 created_at <= target.created_at。
    // 这样即使历史数据存在同一时间戳，也不会把目标之后的消息误复制进分支。
    const { targetMessage, messages } = await listConversationMessagesThrough(
      supabase,
      conversationId,
      parsed.data.messageId,
    );

    if (targetMessage.role !== "assistant") {
      return NextResponse.json(
        {
          error: {
            message: "只能从 assistant 消息创建分支。",
          },
        },
        { status: 400 },
      );
    }

    if (targetMessage.status === "pending" || targetMessage.status === "streaming") {
      return NextResponse.json(
        {
          error: {
            message: "消息生成完成后才能创建分支。",
          },
        },
        { status: 400 },
      );
    }

    const nextConversation = await createConversation(
      supabase,
      user.id,
      createBranchConversationTitle(sourceConversation.title),
      sourceConversation.systemPrompt ?? undefined,
      sourceConversation.modelId ?? undefined,
      sourceConversation.webSearchEnabled,
      sourceConversation.thinkingLevel,
    );
    // 分支继承的是消息内容与 metadata 引用；Storage 对象本身仍在原用户目录下，
    // 因为同一用户的新会话读取这些附件是合法的。
    const nextMessages = await cloneConversationMessages(
      supabase,
      nextConversation.id,
      messages,
    );

    return NextResponse.json(
      chatSessionResponseSchema.parse({
        conversation: nextConversation,
        messages: nextMessages,
      }),
    );
  } catch (error) {
    return handleBranchError(error);
  }
}
