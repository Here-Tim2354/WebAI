import { NextResponse } from "next/server";
import { cancelChatRequestSchema } from "@/lib/schemas/chat";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import { cancelConversationStream } from "@/lib/ai/stream-control";
import {
  ConversationAccessError,
  getConversationById,
} from "@/lib/supabase/conversations";
import { cancelAssistantMessage } from "@/lib/supabase/messages";

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

    const parsed = cancelChatRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message:
              parsed.error.issues[0]?.message ?? "取消生成参数不正确。",
          },
        },
        { status: 400 },
      );
    }

    await getConversationById(supabase, user.id, parsed.data.conversationId);
    // 线上环境可能由不同运行实例分别处理生成流和取消请求。
    // 因此取消必须先写数据库状态，再尝试中断当前进程内的模型流。
    await cancelAssistantMessage(
      supabase,
      parsed.data.conversationId,
      parsed.data.assistantMessageId,
    );
    cancelConversationStream(parsed.data.conversationId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
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

    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "取消生成失败，请稍后再试。",
        },
      },
      { status: 500 },
    );
  }
}
