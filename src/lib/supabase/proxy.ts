import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env/supabase";

/**
 * updateSession 运行在 proxy 层，用来做 Supabase SSR 登录态续期。
 * 这也是为什么很多 Route Handler 里只需要调用 auth.getUser() 就能拿到当前用户。
 */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Supabase 可能在一次 getUser/refresh 流程里返回新的 session cookie。
          // 这里既更新 request 副本，也把它们写回真正的响应。
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // 这一句看似“没用返回值”，实际上是在触发 Supabase 检查/刷新当前 session。
  await supabase.auth.getUser();

  return supabaseResponse;
}
