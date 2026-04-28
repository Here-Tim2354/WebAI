import { SupabaseClient } from "@supabase/supabase-js";
import {
  ChatMessage,
  ChatMessageMetadata,
  chatMessageMetadataSchema,
  createChatMessage,
} from "@/lib/schemas/chat";

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: "user" | "assistant";
  content: string;
  status: ChatMessage["status"];
  metadata: unknown;
  created_at: string;
};

const messageSelectFields =
  "id, conversation_id, sender_type, content, status, metadata, created_at";

// messages 表里用 sender_type 表示消息来源，这里映射回前端统一的 role/status 结构。
function mapMessageRow(row: MessageRow): ChatMessage {
  return createChatMessage({
    id: row.id,
    role: row.sender_type,
    content: row.content,
    status: row.status,
    metadata: chatMessageMetadataSchema.parse(row.metadata ?? {}),
  });
}

// 历史消息必须按 created_at 正序取回，否则会破坏模型上下文顺序和前端展示顺序。
export async function listConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("messages")
    .select(messageSelectFields)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapMessageRow(row as MessageRow));
}

export async function listConversationMessagesThrough(
  supabase: SupabaseClient,
  conversationId: string,
  messageId: string,
) {
  const { data, error } = await supabase
    .from("messages")
    .select(messageSelectFields)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  const messages = (data ?? []).map((row) => mapMessageRow(row as MessageRow));
  const targetMessageIndex = messages.findIndex(
    (message) => message.id === messageId,
  );

  if (targetMessageIndex === -1) {
    throw new Error("消息不存在，或你没有访问权限。");
  }

  return {
    targetMessage: messages[targetMessageIndex],
    messages: messages.slice(0, targetMessageIndex + 1),
  };
}

export async function getConversationMessage(
  supabase: SupabaseClient,
  conversationId: string,
  messageId: string,
) {
  const { data, error } = await supabase
    .from("messages")
    .select(messageSelectFields)
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .single();

  if (error) {
    throw error;
  }

  return data as MessageRow;
}

export async function createConversationMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderType: "user" | "assistant",
  content: string,
  status: ChatMessage["status"] = "complete",
  metadata: ChatMessageMetadata = {},
) {
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_type: senderType,
      content,
      status,
      metadata,
    })
    .select(messageSelectFields)
    .single();

  if (error) {
    throw error;
  }

  return mapMessageRow(data as MessageRow);
}

export async function cloneConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  messages: ChatMessage[],
) {
  const cloneableMessages = messages.filter(
    (message) => message.role === "user" || message.role === "assistant",
  );

  if (cloneableMessages.length === 0) {
    return [];
  }

  const firstCreatedAt = Date.now();
  const { data, error } = await supabase
    .from("messages")
    .insert(
      cloneableMessages.map((message, index) => ({
        conversation_id: conversationId,
        sender_type: message.role,
        content: message.content,
        status: message.status,
        metadata: message.metadata,
        created_at: new Date(firstCreatedAt + index).toISOString(),
      })),
    )
    .select(messageSelectFields)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapMessageRow(row as MessageRow));
}

type UpdateConversationMessageInput = {
  content?: string;
  status?: ChatMessage["status"];
  metadata?: ChatMessageMetadata;
};

export async function updateConversationMessage(
  supabase: SupabaseClient,
  conversationId: string,
  messageId: string,
  updates: UpdateConversationMessageInput,
) {
  const nextMessageUpdate: {
    content?: string;
    status?: ChatMessage["status"];
    metadata?: ChatMessageMetadata;
  } = {};

  if (updates.content !== undefined) {
    nextMessageUpdate.content = updates.content;
  }

  if (updates.status !== undefined) {
    nextMessageUpdate.status = updates.status;
  }

  if (updates.metadata !== undefined) {
    nextMessageUpdate.metadata = updates.metadata;
  }

  const { data, error } = await supabase
    .from("messages")
    .update(nextMessageUpdate)
    .eq("id", messageId)
    .eq("conversation_id", conversationId)
    .select(messageSelectFields)
    .single();

  if (error) {
    throw error;
  }

  return mapMessageRow(data as MessageRow);
}

export async function deleteConversationMessagesById(
  supabase: SupabaseClient,
  conversationId: string,
  messageIds: string[],
) {
  if (messageIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("conversation_id", conversationId)
    .in("id", messageIds);

  if (error) {
    throw new Error(error.message);
  }
}

export async function editUserMessageAndDeleteFollowing(
  supabase: SupabaseClient,
  conversationId: string,
  messageId: string,
  content: string,
  metadata: ChatMessageMetadata,
) {
  const { error } = await supabase.rpc(
    "edit_user_message_metadata_and_delete_following",
    {
      p_conversation_id: conversationId,
      p_message_id: messageId,
      p_content: content,
      p_metadata: metadata,
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}
