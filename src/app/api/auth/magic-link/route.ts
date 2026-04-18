import { NextResponse } from "next/server";
import { sendMagicLinkRequestSchema } from "@/lib/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 发送邮箱魔法链接。
 * Route Handler 放在服务端执行，可以安全地调用 Supabase Auth，而不把登录细节暴露给客户端。
 */
export async function POST(request: Request) {
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

  const parsed = sendMagicLinkRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: parsed.error.issues[0]?.message ?? "邮箱格式不正确。",
        },
      },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  // 邮件里的回跳地址必须落回本应用的确认路由，
  // 否则 Supabase 无法在本域名下完成 session 建立。
  const redirectTo = new URL("/auth/confirm", request.url);

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: redirectTo.toString(),
    },
  });

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

  return NextResponse.json({
    ok: true,
    message: "登录链接已发送，请去邮箱确认。",
  });
}
