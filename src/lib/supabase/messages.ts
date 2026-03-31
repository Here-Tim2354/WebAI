import { SupabaseClient } from "@supabase/supabase-js";
import { ChatMessage, createChatMessage } from "@/lib/schemas/chat";

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: "user" | "assistant";
  content: string;
  created_at: string;
};

function mapMessageRow(row: MessageRow): ChatMessage {
  return createChatMessage({
    id: row.id,
    role: row.sender_type,
    content: row.content,
    status: "complete",
  });
}

export async function listConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_type, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapMessageRow(row as MessageRow));
}

export async function createConversationMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderType: "user" | "assistant",
  content: string,
) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_type: senderType,
      content,
    })
    .select("id, conversation_id, sender_type, content, created_at")
    .single();

  if (error) {
    throw error;
  }

  return mapMessageRow(data as MessageRow);
}
