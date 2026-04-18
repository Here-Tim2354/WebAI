import { NextResponse } from "next/server";
import { aiModelListResponseSchema } from "@/lib/schemas/model";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import { listEnabledModels } from "@/lib/supabase/model-registry";

// 模型列表属于用户工作区的一部分，未登录时不暴露可用模型信息。
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
 * 返回当前已启用的模型注册表数据。
 * 前端模型选择器只依赖这份经过后端过滤后的结果，不直接读环境变量。
 */
export async function GET() {
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    return unauthorizedResponse();
  }

  const models = await listEnabledModels(supabase);

  return NextResponse.json(aiModelListResponseSchema.parse({ models }));
}
