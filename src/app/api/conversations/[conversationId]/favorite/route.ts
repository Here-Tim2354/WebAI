import { NextResponse } from "next/server";
import { conversationResponseSchema } from "@/lib/schemas/conversation";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  ConversationAccessError,
  favoriteConversation,
  unfavoriteConversation,
} from "@/lib/supabase/conversations";

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

function handleFavoriteError(error: unknown) {
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
          error instanceof Error ? error.message : "收藏操作失败，请稍后再试。",
      },
    },
    { status: 500 },
  );
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    const { conversationId } = await context.params;
    const conversation = await favoriteConversation(
      supabase,
      user.id,
      conversationId,
    );

    return NextResponse.json(conversationResponseSchema.parse({ conversation }));
  } catch (error) {
    return handleFavoriteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    const { conversationId } = await context.params;
    const conversation = await unfavoriteConversation(
      supabase,
      user.id,
      conversationId,
    );

    return NextResponse.json(conversationResponseSchema.parse({ conversation }));
  } catch (error) {
    return handleFavoriteError(error);
  }
}
