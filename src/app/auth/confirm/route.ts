import { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAppUrl } from "@/lib/env/app-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * OAuth 或旧无密码回调最终会回到这个路由。
 * 确认路由负责把 Supabase 邮件里的 token_hash 验证成真实登录态，然后再重定向回首页。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const redirectUrl = createAppUrl("/", request.url);
  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      redirectUrl.searchParams.set("auth", "error");
    } else {
      redirectUrl.searchParams.set("auth", "success");
    }

    return NextResponse.redirect(redirectUrl);
  }

  if (!tokenHash || !type) {
    redirectUrl.searchParams.set("auth", "error");
    return NextResponse.redirect(redirectUrl);
  }

  // verifyOtp 会根据邮件中的 hash 完成一次真正的登录确认，
  // 成功后 SSR client 会把新的 session cookie 写回响应。
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    redirectUrl.searchParams.set("auth", "error");
  } else {
    redirectUrl.searchParams.set("auth", "success");
  }

  return NextResponse.redirect(redirectUrl);
}
