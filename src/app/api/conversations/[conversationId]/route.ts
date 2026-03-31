import { NextResponse } from "next/server";
import {
  conversationResponseSchema,
  updateConversationRequestSchema,
} from "@/lib/schemas/conversation";
import { chatSessionResponseSchema } from "@/lib/schemas/chat";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  ConversationAccessError,
  deleteConversation,
  getConversationById,
  updateConversationTitle,
} from "@/lib/supabase/conversations";
import { listConversationMessages } from "@/lib/supabase/messages";

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

function handleConversationError(error: unknown) {
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
    error instanceof Error ? error.message : "会话操作失败，请稍后再试。";

  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status: 500 },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    const { conversationId } = await context.params;
    const conversation = await getConversationById(
      supabase,
      user.id,
      conversationId,
    );
    const messages = await listConversationMessages(supabase, conversationId);

    return NextResponse.json(
      chatSessionResponseSchema.parse({ conversation, messages }),
    );
  } catch (error) {
    return handleConversationError(error);
  }
}

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

    const parsed = updateConversationRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: parsed.error.issues[0]?.message ?? "标题格式不正确。",
          },
        },
        { status: 400 },
      );
    }

    const { conversationId } = await context.params;
    const conversation = await updateConversationTitle(
      supabase,
      user.id,
      conversationId,
      parsed.data.title,
    );

    return NextResponse.json(conversationResponseSchema.parse({ conversation }));
  } catch (error) {
    return handleConversationError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    const { conversationId } = await context.params;
    await deleteConversation(supabase, user.id, conversationId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleConversationError(error);
  }
}
