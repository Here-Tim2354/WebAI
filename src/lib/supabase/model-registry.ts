import { SupabaseClient } from "@supabase/supabase-js";
import { AIModel } from "@/lib/schemas/model";

type AIModelRow = {
  id: string;
  provider: "openai_compatible" | "gemini";
  api_style: string;
  upstream_model_id: string;
  label: string;
  description: string | null;
  icon: string | null;
  is_enabled: boolean;
  is_default: boolean;
  sort_order: number;
};

type OpenAICompatibleModelRow = {
  ai_model_id: string;
  model_id: string;
  base_url: string | null;
  supports_text: boolean;
  supports_image: boolean;
  supports_audio: boolean;
  supports_video: boolean;
  supports_web_search: boolean;
  supports_function_calling: boolean;
  supports_tools: boolean;
  supports_files: boolean;
  supports_structured_outputs: boolean;
  supports_streaming: boolean;
  supports_reasoning: boolean;
};

type GeminiModelRow = {
  ai_model_id: string;
  name: string;
  supports_text: boolean;
  supports_image: boolean;
  supports_audio: boolean;
  supports_video: boolean;
  supports_google_search: boolean;
  supports_url_context: boolean;
  supports_code_execution: boolean;
  supports_function_calling: boolean;
  supports_tools: boolean;
  supports_files: boolean;
  supports_structured_outputs: boolean;
  supports_streaming: boolean;
  supports_reasoning: boolean;
};

export type RuntimeAIModel = AIModel & {
  baseUrl: string | null;
};

export class ModelRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRegistryError";
  }
}

const aiModelSelectFields = [
  "id",
  "provider",
  "api_style",
  "upstream_model_id",
  "label",
  "description",
  "icon",
  "is_enabled",
  "is_default",
  "sort_order",
].join(", ");

// Supabase select 字段统一抽成常量，避免列表查询和单条查询各写一份时字段漂移。
const openAIModelSelectFields = [
  "ai_model_id",
  "model_id",
  "base_url",
  "supports_text",
  "supports_image",
  "supports_audio",
  "supports_video",
  "supports_web_search",
  "supports_function_calling",
  "supports_tools",
  "supports_files",
  "supports_structured_outputs",
  "supports_streaming",
  "supports_reasoning",
].join(", ");

const geminiModelSelectFields = [
  "ai_model_id",
  "name",
  "supports_text",
  "supports_image",
  "supports_audio",
  "supports_video",
  "supports_google_search",
  "supports_url_context",
  "supports_code_execution",
  "supports_function_calling",
  "supports_tools",
  "supports_files",
  "supports_structured_outputs",
  "supports_streaming",
  "supports_reasoning",
].join(", ");

function mapOpenAICompatibleModel(
  model: AIModelRow,
  row: OpenAICompatibleModelRow,
): RuntimeAIModel {
  return {
    id: model.id,
    label: model.label,
    description: model.description,
    icon: model.icon,
    provider: "openai_compatible",
    apiStyle: model.api_style,
    upstreamModelId: model.upstream_model_id,
    baseUrl: row.base_url,
    isDefault: model.is_default,
    sortOrder: model.sort_order,
    capabilities: {
      text: row.supports_text,
      image: row.supports_image,
      audio: row.supports_audio,
      video: row.supports_video,
      webSearch: row.supports_web_search,
      functionCalling: row.supports_function_calling,
      tools: row.supports_tools,
      streaming: row.supports_streaming,
      reasoning: row.supports_reasoning,
      files: row.supports_files,
      structuredOutputs: row.supports_structured_outputs,
      googleSearch: false,
      urlContext: false,
      codeExecution: false,
    },
  };
}

function mapGeminiModel(model: AIModelRow, row: GeminiModelRow): RuntimeAIModel {
  return {
    id: model.id,
    label: model.label,
    description: model.description,
    icon: model.icon,
    provider: "gemini",
    apiStyle: model.api_style,
    upstreamModelId: model.upstream_model_id,
    baseUrl: null,
    isDefault: model.is_default,
    sortOrder: model.sort_order,
    capabilities: {
      text: row.supports_text,
      image: row.supports_image,
      audio: row.supports_audio,
      video: row.supports_video,
      webSearch: row.supports_google_search,
      functionCalling: row.supports_function_calling,
      tools: row.supports_tools,
      streaming: row.supports_streaming,
      reasoning: row.supports_reasoning,
      files: row.supports_files,
      structuredOutputs: row.supports_structured_outputs,
      googleSearch: row.supports_google_search,
      urlContext: row.supports_url_context,
      codeExecution: row.supports_code_execution,
    },
  };
}

function indexById<T extends { ai_model_id: string }>(rows: T[] | null) {
  return new Map((rows ?? []).map((row) => [row.ai_model_id, row]));
}

/**
 * 当前模型注册表是“父表驱动、子表补全”：
 * ai_models 负责通用元数据，provider 子表负责各自实现细节。
 */
export async function listEnabledModels(
  supabase: SupabaseClient,
): Promise<RuntimeAIModel[]> {
  const { data: models, error: modelsError } = await supabase
    .from("ai_models")
    .select(aiModelSelectFields)
    .eq("is_enabled", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (modelsError) {
    throw modelsError;
  }

  const normalizedModels = (models ?? []) as unknown as AIModelRow[];
  const openAIIds = normalizedModels
    .filter((model) => model.provider === "openai_compatible")
    .map((model) => model.id);
  const geminiIds = normalizedModels
    .filter((model) => model.provider === "gemini")
    .map((model) => model.id);

  const [{ data: openAIModels, error: openAIError }, { data: geminiModels, error: geminiError }] =
    await Promise.all([
      openAIIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("openai_compatible_models")
            .select(openAIModelSelectFields)
            .in("ai_model_id", openAIIds),
      geminiIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from("gemini_models")
            .select(geminiModelSelectFields)
            .in("ai_model_id", geminiIds),
    ]);

  if (openAIError) {
    throw openAIError;
  }

  if (geminiError) {
    throw geminiError;
  }

  const openAIMap = indexById(
    (openAIModels ?? []) as unknown as OpenAICompatibleModelRow[],
  );
  const geminiMap = indexById(
    (geminiModels ?? []) as unknown as GeminiModelRow[],
  );

  return normalizedModels.map((model) => {
    if (model.provider === "openai_compatible") {
      const child = openAIMap.get(model.id);

      if (!child) {
        throw new ModelRegistryError("OpenAI compatible 模型缺少 provider 子表记录。");
      }

      return mapOpenAICompatibleModel(model, child);
    }

    const child = geminiMap.get(model.id);

    if (!child) {
      throw new ModelRegistryError("Gemini 模型缺少 provider 子表记录。");
    }

    return mapGeminiModel(model, child);
  });
}

/**
 * 模型按注册表 ID 查询时，先读 ai_models，再按 provider 补全子表细节。
 */
export async function getEnabledModelById(
  supabase: SupabaseClient,
  modelId: string,
): Promise<RuntimeAIModel> {
  const { data: model, error: modelError } = await supabase
    .from("ai_models")
    .select(aiModelSelectFields)
    .eq("id", modelId)
    .eq("is_enabled", true)
    .maybeSingle();

  if (modelError) {
    throw modelError;
  }

  if (!model) {
    throw new ModelRegistryError("模型不存在，或当前未启用。");
  }

  const normalizedModel = model as unknown as AIModelRow;

  if (normalizedModel.provider === "openai_compatible") {
    const { data: openAIModel, error: openAIError } = await supabase
      .from("openai_compatible_models")
      .select(openAIModelSelectFields)
      .eq("ai_model_id", normalizedModel.id)
      .maybeSingle();

    if (openAIError) {
      throw openAIError;
    }

    if (!openAIModel) {
      throw new ModelRegistryError("OpenAI compatible 模型缺少 provider 子表记录。");
    }

    return mapOpenAICompatibleModel(
      normalizedModel,
      openAIModel as unknown as OpenAICompatibleModelRow,
    );
  }

  const { data: geminiModel, error: geminiError } = await supabase
    .from("gemini_models")
    .select(geminiModelSelectFields)
    .eq("ai_model_id", normalizedModel.id)
    .maybeSingle();

  if (geminiError) {
    throw geminiError;
  }

  if (geminiModel) {
    return mapGeminiModel(
      normalizedModel,
      geminiModel as unknown as GeminiModelRow,
    );
  }

  throw new ModelRegistryError("Gemini 模型缺少 provider 子表记录。");
}
