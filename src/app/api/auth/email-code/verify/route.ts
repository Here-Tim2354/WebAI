import { NextResponse } from "next/server";
import {
  assertRateLimit,
  getClientIp,
  RateLimitError,
} from "@/lib/rate-limit";
import { verifyEmailCodeRequestSchema } from "@/lib/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 校验邮箱验证码并建立 Supabase session。
 * 成功后 SSR client 会把 session cookie 写回当前响应。
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

  const parsed = verifyEmailCodeRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: parsed.error.issues[0]?.message ?? "验证码格式不正确。",
        },
      },
      { status: 400 },
    );
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    const clientIp = getClientIp(request);

    assertRateLimit({
      key: `email-code-verify:email:${normalizedEmail}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    assertRateLimit({
      key: `email-code-verify:ip:${clientIp}`,
      limit: 20,
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
  const { error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: parsed.data.token,
    type: "email",
  });

  if (error) {
    return NextResponse.json(
      {
        error: {
          message: "验证码不正确或已过期，请重新检查邮件。",
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
