import { NextResponse } from "next/server";
import { aiModelListResponseSchema } from "@/lib/schemas/model";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import { listEnabledModels } from "@/lib/supabase/model-registry";

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

  const models = await listEnabledModels(supabase);

  return NextResponse.json(aiModelListResponseSchema.parse({ models }));
}
