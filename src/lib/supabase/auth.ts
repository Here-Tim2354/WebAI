import { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * 后端路由常见需求是“既要 supabase client，又要当前 user”，
 * 这里把两步合成一个公共入口，避免每个 route 都重复样板代码。
 */
export async function getSupabaseAuthContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user,
  };
}

// 前端工作区只需要 id 和 email，没必要把整个 Supabase User 对象都暴露出去。
export function mapAuthUser(user: User) {
  return {
    id: user.id,
    email: user.email ?? null,
  };
}
