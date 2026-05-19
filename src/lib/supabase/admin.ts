import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env/supabase";

function getSupabaseServiceRoleKey() {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

export function createSupabaseAdminClient() {
  const env = getSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error("缺少 SUPABASE_SECRET_KEY 或 SUPABASE_SERVICE_ROLE_KEY 环境变量。");
  }

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
