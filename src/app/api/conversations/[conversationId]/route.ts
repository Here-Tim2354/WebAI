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
  updateConversation,
} from "@/lib/supabase/conversations";
import { listConversationMessages } from "@/lib/supabase/messages";
import { getEnabledModelById, ModelRegistryError } from "@/lib/supabase/model-registry";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

// 单会话路由与集合路由一样，都依赖服务端从 cookie 里恢复当前用户。
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
 * 统一把会话访问类错误收口成 404，避免把“会话不存在”和“无权限访问”
 * 暴露成不同响应，从而泄漏更多资源状态信息。
 */
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

/**
 * 读取某个会话的完整工作区状态。
 * 除了会话本体，还会把消息列表一起返回，方便前端一次请求完成会话恢复。
 */
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

/**
 * 当前 PATCH 同时承担两类会话级更新：
 * 1. 标题重命名
 * 2. 会话级 system prompt 更新
 * 3. 模型、联网和思考档位等会话控制项更新
 */
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
            message: parsed.error.issues[0]?.message ?? "会话更新参数不正确。",
          },
        },
        { status: 400 },
      );
    }

    const { conversationId } = await context.params;

    if (parsed.data.modelId) {
      await getEnabledModelById(supabase, parsed.data.modelId);
    }

    const conversation = await updateConversation(
      supabase,
      user.id,
      conversationId,
      {
        title: parsed.data.title,
        systemPrompt: parsed.data.systemPrompt,
        modelId: parsed.data.modelId,
        webSearchEnabled: parsed.data.webSearchEnabled,
        thinkingLevel: parsed.data.thinkingLevel,
        status: parsed.data.status,
      },
    );

    return NextResponse.json(conversationResponseSchema.parse({ conversation }));
  } catch (error) {
    return handleConversationError(error);
  }
}

/**
 * 删除成功后返回 204，无响应体。
 * 前端应以状态码为准更新本地列表，而不是依赖额外 payload。
 */
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
