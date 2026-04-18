import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env/supabase";

/**
 * Server Component / Route Handler 共用的 Supabase SSR client。
 * 关键点不是“新建一个 client”，而是把当前请求的 cookie 上下文接进去。
 */
export async function createSupabaseServerClient() {
  const env = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            // 在能写 cookie 的服务端上下文里，把 Supabase 刷新的 session 同步回响应。
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components 中不能稳定写出响应 cookie。
            // 这里保留兼容写入；真正的 session 刷新与持久化由 proxy.ts 负责。
          }
        },
      },
    },
  );
}
