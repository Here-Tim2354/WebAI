import { SupabaseClient } from "@supabase/supabase-js";
import { Conversation } from "@/lib/schemas/conversation";
import {
  cleanupUnreferencedAttachments,
  normalizeMessageAttachments,
} from "@/lib/attachments";
import { type MessageAttachment } from "@/lib/schemas/chat";
import {
  DEFAULT_THINKING_LEVEL,
  ThinkingLevel,
  thinkingLevelSchema,
} from "@/lib/schemas/thinking";
import { DEFAULT_CONVERSATION_TITLE } from "@/lib/conversation-title";

type ConversationRow = {
  id: string;
  title: string;
  system_prompt: string | null;
  model_id: string | null;
  web_search_enabled: boolean;
  thinking_level: ThinkingLevel | null;
  status: "active" | "archived";
  archived_at: string | null;
  favorites?: { created_at: string }[] | null;
  is_favorite?: boolean;
  favorited_at?: string | null;
  created_at: string;
  updated_at: string;
};

// 数据库字段采用 snake_case，前端 schema 采用 camelCase，数据访问层统一做映射转换。
function mapConversation(row: ConversationRow): Conversation {
  const favorite = row.favorites?.[0] ?? null;

  return {
    id: row.id,
    title: row.title,
    systemPrompt: row.system_prompt,
    modelId: row.model_id,
    webSearchEnabled: row.web_search_enabled,
    thinkingLevel: thinkingLevelSchema.catch(DEFAULT_THINKING_LEVEL).parse(
      row.thinking_level,
    ),
    status: row.status,
    archivedAt: row.archived_at,
    isFavorite: row.is_favorite ?? favorite !== null,
    favoritedAt: row.favorited_at ?? favorite?.created_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const conversationSelectFields =
  "id, title, system_prompt, model_id, web_search_enabled, thinking_level, status, archived_at, created_at, updated_at, favorites(created_at)";

export class ConversationAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationAccessError";
  }
}

// 产品默认的“空白新会话标题”集中定义，避免前后端到处散落字面量。
export function createDefaultConversationTitle() {
  return DEFAULT_CONVERSATION_TITLE;
}

export function createBranchConversationTitle(title: string) {
  const suffix = " · 分支";
  const maxBaseLength = 100 - suffix.length;
  const baseTitle = title.trim() || createDefaultConversationTitle();

  return `${baseTitle.slice(0, maxBaseLength)}${suffix}`;
}

export async function listConversations(
  supabase: SupabaseClient,
  userId: string,
  status: "active" | "archived" = "active",
) {
  const { data, error } = await supabase
    .from("conversations")
    .select(conversationSelectFields)
    .eq("user_id", userId)
    .eq("status", status)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapConversation(row as ConversationRow));
}

export async function listFavoriteConversations(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, title, system_prompt, model_id, web_search_enabled, thinking_level, status, archived_at, created_at, updated_at, favorites!inner(created_at)",
    )
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapConversation(row as ConversationRow))
    .sort((left, right) =>
      (right.favoritedAt ?? right.updatedAt).localeCompare(
        left.favoritedAt ?? left.updatedAt,
      ),
    );
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
  thinkingLevel: ThinkingLevel = DEFAULT_THINKING_LEVEL,
  conversationId?: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      ...(conversationId ? { id: conversationId } : {}),
      user_id: userId,
      title,
      system_prompt: systemPrompt?.trim() ? systemPrompt.trim() : null,
      model_id: modelId ?? null,
      web_search_enabled: webSearchEnabled,
      thinking_level: thinkingLevel,
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
  thinkingLevel?: ThinkingLevel;
  status?: "active" | "archived";
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
    thinking_level?: ThinkingLevel;
    status?: "active" | "archived";
    archived_at?: string | null;
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

  if (updates.thinkingLevel !== undefined) {
    nextConversationUpdate.thinking_level = updates.thinkingLevel;
  }

  if (updates.status !== undefined) {
    nextConversationUpdate.status = updates.status;
    nextConversationUpdate.archived_at =
      updates.status === "archived" ? new Date().toISOString() : null;
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

export async function favoriteConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
) {
  const conversation = await getConversationById(supabase, userId, conversationId);
  const { error } = await supabase
    .from("favorites")
    .upsert(
      {
        user_id: userId,
        conversation_id: conversationId,
      },
      {
        onConflict: "user_id,conversation_id",
        ignoreDuplicates: true,
      },
    );

  if (error) {
    throw error;
  }

  return {
    ...conversation,
    isFavorite: true,
    favoritedAt: new Date().toISOString(),
  };
}

export async function unfavoriteConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
) {
  const conversation = await getConversationById(supabase, userId, conversationId);
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("conversation_id", conversationId);

  if (error) {
    throw error;
  }

  return {
    ...conversation,
    isFavorite: false,
    favoritedAt: null,
  };
}

export async function deleteConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
) {
  const { data: messageRows, error: messageRowsError } = await supabase
    .from("messages")
    .select("metadata")
    .eq("conversation_id", conversationId);

  if (messageRowsError) {
    throw messageRowsError;
  }

  const previousAttachments = (messageRows ?? []).flatMap((row) => {
    const metadata = row.metadata as { attachments?: MessageAttachment[] } | null;
    return normalizeMessageAttachments(metadata?.attachments);
  });

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

  void cleanupUnreferencedAttachments(supabase, previousAttachments).catch(
    () => null,
  );
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
