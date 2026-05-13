import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAppUrl } from "@/lib/env/app-origin";

// dev-login 只在本地调试环境里使用，因此缺失配置时直接抛错更容易尽早发现问题。
function getRequiredEnvValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`缺少 ${name} 环境变量。`);
  }

  return value;
}

/**
 * 开发环境快捷登录：
 * 服务端使用 service role 生成一次性确认参数，再立刻重定向到确认页，避免手动查邮箱。
 */
export async function GET(request: Request) {
  const isDevLoginModeEnabled =
    process.env.NODE_ENV === "development" &&
    (process.env.MODE === "DEV" || process.env.npm_config_mode === "DEV");

  if (!isDevLoginModeEnabled) {
    return NextResponse.json(
      {
        error: {
          message: "仅开发环境且显式启用 DEV 模式时允许使用 dev-login。",
        },
      },
      { status: 404 },
    );
  }

  try {
    const supabaseUrl = getRequiredEnvValue("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey =
      process.env.SUPABASE_SECRET_KEY?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const devAuthEmail = getRequiredEnvValue("DEV_AUTH_EMAIL");

    if (!serviceRoleKey) {
      throw new Error(
        "缺少 SUPABASE_SECRET_KEY 或 SUPABASE_SERVICE_ROLE_KEY 环境变量。",
      );
    }

    const redirectTo = createAppUrl("/auth/confirm", request.url).toString();

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        // Supabase 在开发登录链路中只承担“生成链接的管理端客户端”职责，
        // 不需要 token 自动刷新，也不需要在服务端持久化 session。
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: devAuthEmail,
      options: {
        redirectTo,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    // admin.generateLink 返回的是用于后续确认的原始参数。
    // 开发环境直接拼出确认 URL，让本地调试不依赖真实邮箱收信。
    const tokenHash = data.properties.hashed_token;
    const verificationType = data.properties.verification_type;

    if (!tokenHash || !verificationType) {
      throw new Error("未生成有效的开发登录确认参数。");
    }

    const confirmUrl = createAppUrl("/auth/confirm", request.url);
    confirmUrl.searchParams.set("token_hash", tokenHash);
    confirmUrl.searchParams.set("type", verificationType);

    return NextResponse.redirect(confirmUrl);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "开发登录初始化失败。";

    return NextResponse.json(
      {
        error: {
          message,
        },
      },
      { status: 500 },
    );
  }
}
