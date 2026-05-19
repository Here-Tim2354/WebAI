import { NextResponse } from "next/server";
import {
  conversationStatusSchema,
  conversationListResponseSchema,
  conversationResponseSchema,
  createConversationRequestSchema,
} from "@/lib/schemas/conversation";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  createConversation,
  listFavoriteConversations,
  listConversations,
} from "@/lib/supabase/conversations";
import { getEnabledModelById, ModelRegistryError } from "@/lib/supabase/model-registry";

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
 * 排序规则不在路由层重复实现，而是交给 Supabase 查询层统一处理。
 */
export async function GET(request: Request) {
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const status = conversationStatusSchema
    .catch("active")
    .parse(url.searchParams.get("status") ?? "active");
  const favorite = url.searchParams.get("favorite") === "true";
  const conversations = favorite
    ? await listFavoriteConversations(supabase, user.id)
    : await listConversations(supabase, user.id, status);

  return NextResponse.json(
    conversationListResponseSchema.parse({ conversations }),
  );
}

/**
 * 新建会话时允许空请求体。
 * 这样前端既可以“无参数快速创建”，也可以在未来扩展为带标题和 system prompt 的创建入口。
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    let payload: unknown = {};

    try {
      payload = await request.json();
    } catch {
      // 空 body 对新会话创建是合法输入，默认按“新会话”处理。
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

    if (parsed.data.modelId) {
      await getEnabledModelById(supabase, user.id, parsed.data.modelId);
    }

    const conversation = await createConversation(
      supabase,
      user.id,
      parsed.data.title,
      parsed.data.systemPrompt,
      parsed.data.modelId,
      parsed.data.webSearchEnabled,
      parsed.data.thinkingLevel,
      parsed.data.id,
    );

    return NextResponse.json(conversationResponseSchema.parse({ conversation }));
  } catch (error) {
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

    return NextResponse.json(
      {
        error: {
          message:
            error instanceof Error
              ? error.message
              : "新建会话失败，请稍后再试。",
        },
      },
      { status: 500 },
    );
  }
}
