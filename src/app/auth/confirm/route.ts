import { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 邮箱魔法链接最终会回到这个路由。
 * 这里负责把 Supabase 邮件里的 token_hash 验证成真实登录态，然后再重定向回首页。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const redirectUrl = new URL("/", url.origin);

  if (!tokenHash || !type) {
    redirectUrl.searchParams.set("auth", "error");
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createSupabaseServerClient();
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
