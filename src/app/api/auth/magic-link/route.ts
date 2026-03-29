import { NextResponse } from "next/server";
import { sendMagicLinkRequestSchema } from "@/lib/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
