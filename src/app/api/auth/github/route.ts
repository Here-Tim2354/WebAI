import { NextResponse } from "next/server";
import { createAppUrl } from "@/lib/env/app-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GitHub 登录由 Supabase OAuth 接管。
 * 本路由只负责生成 provider 授权地址并把用户重定向过去。
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const redirectTo = createAppUrl("/auth/confirm", request.url).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo,
    },
  });

  if (error || !data.url) {
    const redirectUrl = createAppUrl("/", request.url);
    redirectUrl.searchParams.set("auth", "error");
    redirectUrl.searchParams.set(
      "error_description",
      "GitHub 登录初始化失败。",
    );

    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(data.url);
}
