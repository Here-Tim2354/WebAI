import { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_GEMINI_BASE_URL,
  GEMINI_MODEL_CATALOG,
  PROTECTED_GEMINI_MODEL_IDS,
} from "@/lib/ai/gemini-model-catalog";
import { NormalizedFetchedGeminiModel } from "@/lib/ai/gemini-model-normalizer";
import { AIModel, FetchedModel } from "@/lib/schemas/model";

type ModelFetchedRow = {
  id: string;
  user_id: string;
  provider: "gemini";
  api_style: string;
  base_url: string;
  model_id: string;
  label: string;
  description: string | null;
  icon: string | null;
  input_token_limit: number | null;
  output_token_limit: number | null;
  capabilities: AIModel["capabilities"];
  raw_metadata: Record<string, unknown>;
  catalog_id: string | null;
  source: string;
  is_enabled: boolean;
  is_default: boolean;
  sort_order: number;
  fetched_at: string | null;
};

export type RuntimeAIModel = AIModel;

export class ModelRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRegistryError";
  }
}

const fetchedModelSelectFields = [
  "id",
  "user_id",
  "provider",
  "api_style",
  "base_url",
  "model_id",
  "label",
  "description",
  "icon",
  "input_token_limit",
  "output_token_limit",
  "capabilities",
  "raw_metadata",
  "catalog_id",
  "source",
  "is_enabled",
  "is_default",
  "sort_order",
  "fetched_at",
].join(", ");

// 数据库使用 snake_case 保存模型字段，前端和聊天运行时使用 camelCase。
// 映射集中在注册表模块，避免 UI、API route 和 AI 调用层各自理解表结构。
function mapFetchedModel(row: ModelFetchedRow): FetchedModel {
  return {
    id: row.id,
    modelId: row.model_id,
    label: row.label,
    description: row.description,
    icon: row.icon,
    provider: "gemini",
    apiStyle: row.api_style,
    upstreamModelId: row.model_id,
    baseUrl: row.base_url,
    isDefault: row.is_default,
    isEnabled: row.is_enabled,
    sortOrder: row.sort_order,
    source: row.source,
    fetchedAt: row.fetched_at,
    catalogMatched: row.catalog_id !== null || row.source === "catalog",
    capabilities: row.capabilities,
  };
}

// 运行时模型只保留调用 Gemini 所需的字段。
// 用户设置列表里的启用状态、来源等管理字段不会继续向 AI 调用层扩散。
function mapFetchedRuntimeModel(row: ModelFetchedRow): RuntimeAIModel {
  const model = mapFetchedModel(row);

  return {
    id: model.id,
    modelId: model.modelId,
    label: model.label,
    description: model.description,
    icon: model.icon,
    provider: model.provider,
    apiStyle: model.apiStyle,
    upstreamModelId: model.upstreamModelId,
    baseUrl: model.baseUrl,
    isDefault: model.isDefault,
    sortOrder: model.sortOrder,
    capabilities: model.capabilities,
  };
}

// 默认模型来自私有 catalog，而不是用户拉取接口。
// 每个用户都会得到一份可管理的 model_fetched 记录，后续启用、停用和默认项都只改自己的列表。
function createDefaultFetchedModelRows(userId: string) {
  return GEMINI_MODEL_CATALOG
    .filter((entry) => entry.defaultEnabled)
    .map((entry) => ({
      user_id: userId,
      provider: "gemini",
      api_style: "gemini_native",
      base_url: DEFAULT_GEMINI_BASE_URL,
      model_id: entry.modelId,
      label: entry.label,
      description: entry.description,
      icon: entry.icon,
      input_token_limit: entry.inputTokenLimit,
      output_token_limit: entry.outputTokenLimit,
      capabilities: entry.capabilities,
      raw_metadata: {
        catalogModelId: entry.modelId,
      },
      source: "catalog",
      is_enabled: true,
      is_default: entry.isDefault,
      sort_order: entry.sortOrder,
      fetched_at: new Date().toISOString(),
    }));
}

export async function ensureDefaultFetchedModels(
  supabase: SupabaseClient,
  userId: string,
) {
  const defaultRows = createDefaultFetchedModelRows(userId);

  if (defaultRows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("model_fetched")
    .upsert(defaultRows, {
      // 用户可能拉取过同 ID 模型；唯一键负责把 catalog 默认项和用户列表合并到同一条记录。
      onConflict: "user_id,model_id",
      ignoreDuplicates: true,
    });

  if (error) {
    throw error;
  }
}

export async function listFetchedModels(
  supabase: SupabaseClient,
  userId: string,
): Promise<FetchedModel[]> {
  await ensureDefaultFetchedModels(supabase, userId);

  const { data, error } = await supabase
    .from("model_fetched")
    .select(fetchedModelSelectFields)
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as ModelFetchedRow[]).map(mapFetchedModel);
}

export async function listEnabledModels(
  supabase: SupabaseClient,
  userId: string,
): Promise<RuntimeAIModel[]> {
  await ensureDefaultFetchedModels(supabase, userId);

  const { data, error } = await supabase
    .from("model_fetched")
    .select(fetchedModelSelectFields)
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as ModelFetchedRow[]).map(
    mapFetchedRuntimeModel,
  );
}

export async function getEnabledModelById(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
): Promise<RuntimeAIModel> {
  const { data, error } = await supabase
    .from("model_fetched")
    .select(fetchedModelSelectFields)
    .eq("id", modelId)
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ModelRegistryError("模型不存在，或当前未启用。");
  }

  return mapFetchedRuntimeModel(data as unknown as ModelFetchedRow);
}

export async function upsertFetchedGeminiModels(
  supabase: SupabaseClient,
  userId: string,
  models: NormalizedFetchedGeminiModel[],
) {
  if (models.length === 0) {
    return;
  }

  const now = new Date().toISOString();
  const modelIds = Array.from(new Set(models.map((model) => model.modelId)));
  const { data: existingRowsForModelIds, error: existingError } = await supabase
    .from("model_fetched")
    .select("id, model_id")
    .eq("user_id", userId)
    .in("model_id", modelIds);

  if (existingError) {
    throw existingError;
  }

  const { data: currentDefaultRows, error: currentDefaultError } =
    await supabase
      .from("model_fetched")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .eq("is_enabled", true)
      .limit(1);

  if (currentDefaultError) {
    throw currentDefaultError;
  }

  const existingByModelId = new Map(
    ((existingRowsForModelIds ?? []) as Array<{
      id: string;
      model_id: string;
    }>).map((row) => [row.model_id, row.id]),
  );
  const insertRows: Array<Record<string, unknown>> = [];
  let hasEnabledDefault = (currentDefaultRows?.length ?? 0) > 0;

  for (const model of models) {
    const existingId = existingByModelId.get(model.modelId);
    const sharedUpdate = {
      base_url: model.baseUrl,
      label: model.label,
      description: model.description,
      icon: model.icon,
      input_token_limit: model.inputTokenLimit,
      output_token_limit: model.outputTokenLimit,
      capabilities: model.capabilities,
      raw_metadata: model.rawMetadata,
      source: model.source,
      sort_order: model.sortOrder,
      fetched_at: now,
    };

    if (existingId) {
      // 同 ID 模型只刷新能力、标签和来源信息，不擅自改变用户手动设置过的启用状态。
      const { error: updateError } = await supabase
        .from("model_fetched")
        .update(sharedUpdate)
        .eq("id", existingId)
        .eq("user_id", userId);

      if (updateError) {
        throw updateError;
      }

      continue;
    }

    const shouldBecomeDefault = !hasEnabledDefault && model.isDefault;

    if (shouldBecomeDefault) {
      hasEnabledDefault = true;
    }

    insertRows.push({
      user_id: userId,
      provider: model.provider,
      api_style: model.apiStyle,
      model_id: model.modelId,
      ...sharedUpdate,
      is_enabled: model.defaultEnabled || shouldBecomeDefault,
      is_default: shouldBecomeDefault,
    });
  }

  if (insertRows.length > 0) {
    const { error: insertError } = await supabase
      .from("model_fetched")
      .insert(insertRows);

    if (insertError) {
      throw insertError;
    }
  }
}

export async function replaceFetchedGeminiModels(
  supabase: SupabaseClient,
  userId: string,
  models: NormalizedFetchedGeminiModel[],
) {
  const now = new Date().toISOString();
  // Gemini models.list 可能返回别名或重复 ID；用户列表以 modelId 为唯一语义。
  // 先去重再覆盖，可以避免重复拉取时触发默认模型唯一约束。
  const uniqueModels = Array.from(
    new Map(models.map((model) => [model.modelId, model])).values(),
  );
  const nextModelIds = uniqueModels.map((model) => model.modelId);

  const { error: resetDefaultError } = await supabase
    .from("model_fetched")
    .update({ is_default: false })
    .eq("user_id", userId);

  if (resetDefaultError) {
    throw resetDefaultError;
  }

  const { data: currentRows, error: currentRowsError } = await supabase
    .from("model_fetched")
    .select("id, model_id")
    .eq("user_id", userId);

  if (currentRowsError) {
    throw currentRowsError;
  }

  const staleIds = ((currentRows ?? []) as Array<{
    id: string;
    model_id: string;
  }>)
    .filter(
      (row) =>
        !nextModelIds.includes(row.model_id) &&
        !PROTECTED_GEMINI_MODEL_IDS.has(row.model_id),
    )
    .map((row) => row.id);

  if (staleIds.length > 0) {
    // 重新拉取模型是“用端点最新列表覆盖用户列表”的语义。
    // 三个默认模型承担兜底入口，即使端点暂时不返回也不能被清掉。
    const { error: deleteStaleError } = await supabase
      .from("model_fetched")
      .delete()
      .eq("user_id", userId)
      .in("id", staleIds);

    if (deleteStaleError) {
      throw deleteStaleError;
    }
  }

  if (uniqueModels.length === 0) {
    return;
  }

  const defaultModelId =
    uniqueModels.find((model) => model.catalogMatched && model.isDefault)
      ?.modelId ??
    uniqueModels.find((model) => model.catalogMatched && model.defaultEnabled)
      ?.modelId ??
    null;

  const rows = uniqueModels.map((model) => {
    const isSupported = model.catalogMatched;
    const isDefault = model.modelId === defaultModelId;

    return {
      user_id: userId,
      provider: model.provider,
      api_style: model.apiStyle,
      base_url: model.baseUrl,
      model_id: model.modelId,
      label: model.label,
      description: model.description,
      icon: model.icon,
      input_token_limit: model.inputTokenLimit,
      output_token_limit: model.outputTokenLimit,
      capabilities: model.capabilities,
      raw_metadata: model.rawMetadata,
      source: model.source,
      // catalog 代表系统已知能力边界。无法匹配 catalog 的模型可以展示，但不能启用到聊天链路。
      is_enabled: isSupported && (model.defaultEnabled || isDefault),
      is_default: isDefault,
      sort_order: model.sortOrder,
      fetched_at: now,
    };
  });

  const { error: upsertError } = await supabase
    .from("model_fetched")
    .upsert(rows, {
      onConflict: "user_id,model_id",
    });

  if (upsertError) {
    throw upsertError;
  }
}

export async function updateFetchedModel(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
  updates: {
    isEnabled?: boolean;
    isDefault?: boolean;
  },
) {
  const { data: targetRow, error: targetError } = await supabase
    .from("model_fetched")
    .select("id, model_id, catalog_id, source")
    .eq("id", modelId)
    .eq("user_id", userId)
    .maybeSingle();

  if (targetError) {
    throw targetError;
  }

  if (!targetRow) {
    return;
  }

  const target = targetRow as {
    id: string;
    model_id: string;
    catalog_id: string | null;
    source: string;
  };
  const isSupported = target.catalog_id !== null || target.source === "catalog";

  if (!isSupported && (updates.isEnabled === true || updates.isDefault === true)) {
    // 不支持模型缺少可靠的多模态、联网、thinking 等能力信息，不能进入可调用集合。
    throw new ModelRegistryError("不支持的模型不可启用。");
  }

  if (updates.isDefault === true) {
    // 默认模型按用户维度保持单选；先清空再设置，和数据库唯一约束保持一致。
    const { error: resetError } = await supabase
      .from("model_fetched")
      .update({ is_default: false })
      .eq("user_id", userId);

    if (resetError) {
      throw resetError;
    }
  }

  const nextUpdate: {
    is_enabled?: boolean;
    is_default?: boolean;
  } = {};

  if (updates.isEnabled !== undefined) {
    nextUpdate.is_enabled = updates.isEnabled;

    if (!updates.isEnabled) {
      nextUpdate.is_default = false;
    }
  }

  if (updates.isDefault !== undefined) {
    nextUpdate.is_default = updates.isDefault;

    if (updates.isDefault) {
      nextUpdate.is_enabled = true;
    }
  }

  const { error } = await supabase
    .from("model_fetched")
    .update(nextUpdate)
    .eq("id", modelId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function deleteFetchedModel(
  supabase: SupabaseClient,
  userId: string,
  modelId: string,
) {
  const { data: targetRow, error: targetError } = await supabase
    .from("model_fetched")
    .select("id, model_id, is_default")
    .eq("id", modelId)
    .eq("user_id", userId)
    .maybeSingle();

  if (targetError) {
    throw targetError;
  }

  if (!targetRow) {
    return;
  }

  const target = targetRow as {
    id: string;
    model_id: string;
    is_default: boolean;
  };

  if (PROTECTED_GEMINI_MODEL_IDS.has(target.model_id)) {
    // 默认模型是系统兜底能力，不允许通过用户菜单删除。
    throw new ModelRegistryError("默认模型不可删除。");
  }

  const wasDefault = target.is_default;
  const { error: deleteError } = await supabase
    .from("model_fetched")
    .delete()
    .eq("id", modelId)
    .eq("user_id", userId);

  if (deleteError) {
    throw deleteError;
  }

  if (!wasDefault) {
    return;
  }

  // 被删除项如果正好是默认项，需要在剩余启用的 catalog 模型里补一个默认入口。
  const { data: nextDefaultRows, error: nextDefaultError } = await supabase
    .from("model_fetched")
    .select("id")
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .eq("source", "catalog")
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })
    .limit(1);

  if (nextDefaultError) {
    throw nextDefaultError;
  }

  const nextDefaultId = (nextDefaultRows as Array<{ id: string }> | null)?.[0]
    ?.id;

  if (!nextDefaultId) {
    return;
  }

  const { error: setDefaultError } = await supabase
    .from("model_fetched")
    .update({ is_default: true })
    .eq("id", nextDefaultId)
    .eq("user_id", userId);

  if (setDefaultError) {
    throw setDefaultError;
  }
}
