import { NextResponse } from "next/server";
import { createAppUrl } from "@/lib/env/app-origin";
import {
  assertRateLimit,
  getClientIp,
  RateLimitError,
} from "@/lib/rate-limit";
import { sendMagicLinkRequestSchema } from "@/lib/schemas/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getMagicLinkErrorMessage(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const status =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : null;

  if (status === 429 || code === "over_email_send_rate_limit") {
    return {
      message: "邮箱链接发送过于频繁，请稍后再试。",
      status: 429,
    };
  }

  return {
    message: "登录链接暂时无法发送，请稍后再试。",
    status: 500,
  };
}

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

  try {
    const normalizedEmail = parsed.data.email.toLowerCase();
    const clientIp = getClientIp(request);

    // magic link 会触发外部邮件发送和 Supabase Auth 配额消耗。
    // 同时按邮箱和来源限流，既减少单邮箱轰炸，也限制同一来源批量枚举。
    assertRateLimit({
      key: `magic-link:email:${normalizedEmail}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });
    assertRateLimit({
      key: `magic-link:ip:${clientIp}`,
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
  // 邮件里的回跳地址必须落回本应用的确认路由，
  // 否则 Supabase 无法在本域名下完成 session 建立。
  const redirectTo = createAppUrl("/auth/confirm", request.url);

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email.toLowerCase(),
    options: {
      data: {
        auth_mode: "magic-link",
      },
      emailRedirectTo: redirectTo.toString(),
    },
  });

  if (error) {
    const authError = getMagicLinkErrorMessage(error);

    return NextResponse.json(
      {
        error: {
          message: authError.message,
        },
      },
      { status: authError.status },
    );
  }

  return NextResponse.json({
    ok: true,
    message: "登录链接已发送，请去邮箱确认。",
  });
}
