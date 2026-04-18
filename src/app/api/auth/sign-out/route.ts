import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 登出只需要服务端调用 Supabase Auth。
 * 成功后相关 session cookie 会被清理，前端再刷新工作区状态即可。
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
