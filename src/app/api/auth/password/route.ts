import { NextResponse } from "next/server";
import {
  assertRateLimit,
  getClientIp,
  RateLimitError,
} from "@/lib/rate-limit";
import { signInWithPasswordRequestSchema } from "@/lib/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 邮箱密码登录。
 * 这条链路只负责建立 Supabase session，不承担注册；新用户仍可先用 Magic Link 登录后在个人账户中设置密码。
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

  const parsed = signInWithPasswordRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: parsed.error.issues[0]?.message ?? "邮箱或密码格式不正确。",
        },
      },
      { status: 400 },
    );
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    const clientIp = getClientIp(request);

    // 密码登录失败成本低，按邮箱和来源限流，避免线上被批量试探。
    assertRateLimit({
      key: `password-login:email:${normalizedEmail}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });
    assertRateLimit({
      key: `password-login:ip:${clientIp}`,
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
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: parsed.data.password,
  });

  if (error) {
    return NextResponse.json(
      {
        error: {
          message: "邮箱或密码不正确。",
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
  });
}
