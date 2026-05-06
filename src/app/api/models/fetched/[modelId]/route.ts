import { NextResponse } from "next/server";
import {
  fetchedModelListResponseSchema,
  updateFetchedModelRequestSchema,
} from "@/lib/schemas/model";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  deleteFetchedModel,
  listFetchedModels,
  updateFetchedModel,
} from "@/lib/supabase/model-registry";

type RouteContext = {
  params: Promise<{
    modelId: string;
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

export async function PATCH(request: Request, context: RouteContext) {
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    return unauthorizedResponse();
  }

  const { modelId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = updateFetchedModelRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message:
            parsed.error.issues[0]?.message ?? "模型更新参数不正确。",
        },
      },
      { status: 400 },
    );
  }

  // 模型启用和默认项都属于用户私有模型列表。
  // 业务规则放在注册表模块里执行，路由只负责鉴权、校验请求和返回最新列表。
  await updateFetchedModel(supabase, user.id, modelId, parsed.data);
  const models = await listFetchedModels(supabase, user.id);

  return NextResponse.json(fetchedModelListResponseSchema.parse({ models }));
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    return unauthorizedResponse();
  }

  const { modelId } = await context.params;

  // 删除后同样返回完整列表，让前端直接采用服务端确认过的默认项和启用状态。
  await deleteFetchedModel(supabase, user.id, modelId);
  const models = await listFetchedModels(supabase, user.id);

  return NextResponse.json(fetchedModelListResponseSchema.parse({ models }));
}
