import { redirect } from "next/navigation";
import { ChatShell } from "@/components/chat/chat-shell";
import { mapAuthUser } from "@/lib/supabase/auth";
import { listConversations } from "@/lib/supabase/conversations";
import { listEnabledModels } from "@/lib/supabase/model-registry";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type HomePageProps = {
  searchParams: Promise<{
    auth?: string;
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isDevLoginModeEnabled =
    process.env.NODE_ENV === "development" &&
    (process.env.MODE === "DEV" || process.env.npm_config_mode === "DEV");

  if (
    !user &&
    isDevLoginModeEnabled &&
    resolvedSearchParams.auth !== "error" &&
    resolvedSearchParams.auth !== "success"
  ) {
    redirect("/api/auth/dev-login");
  }

  const conversations = user
    ? await listConversations(supabase, user.id)
    : [];
  const models = user ? await listEnabledModels(supabase) : [];
  const initialAuthMessage =
    resolvedSearchParams.auth === "error"
      ? "登录确认失败，请检查邮件链接或重新发送。"
      : resolvedSearchParams.auth === "success"
        ? "登录成功，正在进入你的会话工作区。"
        : null;
  const initialAuthMessageType =
    resolvedSearchParams.auth === "error" ? "error" : "info";

  return (
    <ChatShell
      initialUser={user ? mapAuthUser(user) : null}
      initialConversations={conversations}
      initialModels={models}
      initialAuthMessage={initialAuthMessage}
      initialAuthMessageType={initialAuthMessageType}
    />
  );
}
