import { NextResponse } from "next/server";
import { createAppUrl } from "@/lib/env/app-origin";
import {
  assertRateLimit,
  getClientIp,
  RateLimitError,
} from "@/lib/rate-limit";
import { sendEmailCodeRequestSchema } from "@/lib/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 发送邮箱验证码。
 * Supabase 的邮箱 OTP 长度由 Auth 配置决定，前端只做 6-10 位兼容输入。
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

  const parsed = sendEmailCodeRequestSchema.safeParse(payload);

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

  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    const clientIp = getClientIp(request);

    assertRateLimit({
      key: `email-code-send:email:${normalizedEmail}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });
    assertRateLimit({
      key: `email-code-send:ip:${clientIp}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
          },
        },
        { status: 429 },
      );
    }

    throw error;
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = createAppUrl("/auth/confirm", request.url);
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: redirectTo.toString(),
    },
  });

  if (error) {
    return NextResponse.json(
      {
        error: {
          message: "验证码暂时无法发送，请稍后再试。",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "验证码已发送，请查看邮箱。",
  });
}
