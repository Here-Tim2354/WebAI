import { SupabaseClient } from "@supabase/supabase-js";
import { Conversation } from "@/lib/schemas/conversation";

type ConversationRow = {
  id: string;
  title: string;
  system_prompt: string | null;
  model_id: string | null;
  web_search_enabled: boolean;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

// 数据库字段采用 snake_case，前端 schema 采用 camelCase，这里统一做一次映射转换。
function mapConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    title: row.title,
    systemPrompt: row.system_prompt,
    modelId: row.model_id,
    webSearchEnabled: row.web_search_enabled,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const conversationSelectFields =
  "id, title, system_prompt, model_id, web_search_enabled, status, created_at, updated_at";

export class ConversationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationAccessError";
  }
}

// 当前产品默认的“空白新会话标题”集中定义，避免前后端到处散落字面量。
export function createDefaultConversationTitle() {
  return "新会话";
}

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select(conversationSelectFields)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapConversation(row as ConversationRow));
}

/**
 * createConversation 只负责数据库落库，不处理任何前端展示逻辑。
 * system prompt 如果是空白字符串，会被归一化成 null，避免把“空值”和“空字符串”混在库里。
 */
export async function createConversation(
  supabase: SupabaseClient,
  userId: string,
  title = createDefaultConversationTitle(),
  systemPrompt?: string,
  modelId?: string,
  webSearchEnabled = true,
) {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: userId,
      title,
      system_prompt: systemPrompt?.trim() ? systemPrompt.trim() : null,
      model_id: modelId ?? null,
      web_search_enabled: webSearchEnabled,
    })
    .select(conversationSelectFields)
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
    .select(conversationSelectFields)
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

type UpdateConversationInput = {
  title?: string;
  systemPrompt?: string;
  modelId?: string;
  webSearchEnabled?: boolean;
};

/**
 * 更新时只写入显式提供的字段。
 * 这样 PATCH 可以同时支持“只改标题”和“只改 system prompt”两种调用方式。
 */
export async function updateConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  updates: UpdateConversationInput,
) {
  const nextConversationUpdate: {
    title?: string;
    system_prompt?: string | null;
    model_id?: string | null;
    web_search_enabled?: boolean;
  } = {};

  if (updates.title !== undefined) {
    nextConversationUpdate.title = updates.title;
  }

  if (updates.systemPrompt !== undefined) {
    nextConversationUpdate.system_prompt = updates.systemPrompt.trim()
      ? updates.systemPrompt.trim()
      : null;
  }

  if (updates.modelId !== undefined) {
    nextConversationUpdate.model_id = updates.modelId;
  }

  if (updates.webSearchEnabled !== undefined) {
    nextConversationUpdate.web_search_enabled = updates.webSearchEnabled;
  }

  const { data, error } = await supabase
    .from("conversations")
    .update(nextConversationUpdate)
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select(conversationSelectFields)
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

// touchConversation 不改业务字段，只更新 updated_at。
// 它服务的是“最近会话排序”和“刚发生交互的会话自动置顶”。
export async function touchConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId)
    .eq("user_id", userId)
    .select(conversationSelectFields)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw new ConversationAccessError("会话不存在，或你没有访问权限。");
    }

    throw error;
  }

  return mapConversation(data as ConversationRow);
}
