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

// conversations 集合路由里的所有操作都要求当前请求已经带有有效登录态。
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
 * 获取当前用户的会话列表。
 * 排序规则不在这里重复实现，而是交给 Supabase 查询层统一处理。
 */
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

/**
 * 新建会话时允许空请求体。
 * 这样前端既可以“无参数快速创建”，也可以在未来扩展为带标题和 system prompt 的创建入口。
 */
export async function POST(request: Request) {
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    return unauthorizedResponse();
  }

  let payload: unknown = {};

  try {
    payload = await request.json();
  } catch {
    // 空 body 在当前产品里也是合法输入，默认按“新会话”创建。
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
