import { SupabaseClient } from "@supabase/supabase-js";
import { Conversation } from "@/lib/schemas/conversation";

type ConversationRow = {
  id: string;
  title: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ConversationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationAccessError";
  }
}

export function createDefaultConversationTitle() {
  return "新会话";
}

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, status, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapConversation(row as ConversationRow));
}

export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  title = createDefaultConversationTitle(),
) {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
    })
    .select("id, title, status, created_at, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return mapConversation(data as ConversationRow);
}

export async function getConversationById(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, status, created_at, updated_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ConversationAccessError("会话不存在，或你没有访问权限。");
    }

    throw error;
  }

  return mapConversation(data as ConversationRow);
}

export async function updateConversationTitle(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  title: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .update({ title })
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select("id, title, status, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ConversationAccessError("会话不存在，或你没有访问权限。");
    }

    throw error;
  }

  return mapConversation(data as ConversationRow);
}

export async function deleteConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ConversationAccessError("会话不存在，或你没有访问权限。");
  }
}
