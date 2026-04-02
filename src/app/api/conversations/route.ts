import { NextResponse } from "next/server";
import {
  conversationListResponseSchema,
  conversationResponseSchema,
  createConversationRequestSchema,
} from "@/lib/schemas/conversation";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  createConversation,
  listConversations,
} from "@/lib/supabase/conversations";

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

export async function GET() {
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    return unauthorizedResponse();
  }

  const conversations = await listConversations(supabase, user.id);
  return NextResponse.json(
    conversationListResponseSchema.parse({ conversations }),
  );
}

export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    return unauthorizedResponse();
  }

  let payload: unknown = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const parsed = createConversationRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: "新建会话参数不正确。",
        },
      },
      { status: 400 },
    );
  }

  const conversation = await createConversation(
    supabase,
    user.id,
    parsed.data.title,
    parsed.data.systemPrompt,
  );

  return NextResponse.json(conversationResponseSchema.parse({ conversation }));
}
