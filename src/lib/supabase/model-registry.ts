import { SupabaseClient } from "@supabase/supabase-js";
import { AIModel } from "@/lib/schemas/model";

type OpenAICompatibleModelRow = {
  model_id: string;
  label: string;
  description: string | null;
  icon: string | null;
  api_style: string;
  base_url: string | null;
  is_default: boolean;
  sort_order: number;
  supports_text: boolean;
  supports_image: boolean;
  supports_audio: boolean;
  supports_video: boolean;
  supports_web_search: boolean;
  supports_function_calling: boolean;
  supports_tools: boolean;
  supports_file_search: boolean;
  supports_structured_outputs: boolean;
  supports_streaming: boolean;
  supports_reasoning: boolean;
};

type GeminiModelRow = {
  name: string;
  display_name: string;
  description: string | null;
  icon: string | null;
  api_style: string;
  is_default: boolean;
  sort_order: number;
  supports_text: boolean;
  supports_image: boolean;
  supports_audio: boolean;
  supports_video: boolean;
  supports_google_search: boolean;
  supports_url_context: boolean;
  supports_code_execution: boolean;
  supports_function_calling: boolean;
  supports_tools: boolean;
  supports_file_search: boolean;
  supports_structured_outputs: boolean;
  supports_streaming: boolean;
  supports_reasoning: boolean;
};

export type ResolvedAIModel = AIModel & {
  baseUrl: string | null;
};

export class ModelRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelRegistryError";
  }
}

const openAIModelSelectFields = [
  "model_id",
  "label",
  "description",
  "icon",
  "api_style",
  "base_url",
  "is_default",
  "sort_order",
  "supports_text",
  "supports_image",
  "supports_audio",
  "supports_video",
  "supports_web_search",
  "supports_function_calling",
  "supports_tools",
  "supports_file_search",
  "supports_structured_outputs",
  "supports_streaming",
  "supports_reasoning",
].join(", ");

const geminiModelSelectFields = [
  "name",
  "display_name",
  "description",
  "icon",
  "api_style",
  "is_default",
  "sort_order",
  "supports_text",
  "supports_image",
  "supports_audio",
  "supports_video",
  "supports_google_search",
  "supports_url_context",
  "supports_code_execution",
  "supports_function_calling",
  "supports_tools",
  "supports_file_search",
  "supports_structured_outputs",
  "supports_streaming",
  "supports_reasoning",
].join(", ");

function mapOpenAICompatibleModel(
  row: OpenAICompatibleModelRow,
): ResolvedAIModel {
  return {
    id: row.model_id,
    label: row.label,
    description: row.description,
    icon: row.icon,
    provider: "openai_compatible",
    apiStyle: row.api_style,
    upstreamModelId: row.model_id,
    baseUrl: row.base_url,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
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
      fileSearch: row.supports_file_search,
      structuredOutputs: row.supports_structured_outputs,
      googleSearch: false,
      urlContext: false,
      codeExecution: false,
    },
  };
}

function mapGeminiModel(row: GeminiModelRow): ResolvedAIModel {
  return {
    id: row.name,
    label: row.display_name,
    description: row.description,
    icon: row.icon,
    provider: "gemini",
    apiStyle: row.api_style,
    upstreamModelId: row.name,
    baseUrl: null,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
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
      fileSearch: row.supports_file_search,
      structuredOutputs: row.supports_structured_outputs,
      googleSearch: row.supports_google_search,
      urlContext: row.supports_url_context,
      codeExecution: row.supports_code_execution,
    },
  };
}

export async function listEnabledModels(
  supabase: SupabaseClient,
): Promise<ResolvedAIModel[]> {
  const [{ data: openAIModels, error: openAIError }, { data: geminiModels, error: geminiError }] =
    await Promise.all([
      supabase
        .from("openai_compatible_models")
        .select(openAIModelSelectFields)
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true })
        .order("label", { ascending: true }),
      supabase
        .from("gemini_models")
        .select(geminiModelSelectFields)
        .eq("is_enabled", true)
        .order("sort_order", { ascending: true })
        .order("display_name", { ascending: true }),
    ]);

  if (openAIError) {
    throw openAIError;
  }

  if (geminiError) {
    throw geminiError;
  }

  return [
    ...(openAIModels ?? []).map((row) =>
      mapOpenAICompatibleModel(row as unknown as OpenAICompatibleModelRow),
    ),
    ...(geminiModels ?? []).map((row) =>
      mapGeminiModel(row as unknown as GeminiModelRow),
    ),
  ].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }

    return left.label.localeCompare(right.label, "zh-CN");
  });
}

export async function getEnabledModelById(
  supabase: SupabaseClient,
  modelId: string,
): Promise<ResolvedAIModel> {
  const { data: openAIModel, error: openAIError } = await supabase
    .from("openai_compatible_models")
    .select(openAIModelSelectFields)
    .eq("model_id", modelId)
    .eq("is_enabled", true)
    .maybeSingle();

  if (openAIError) {
    throw openAIError;
  }

  if (openAIModel) {
    return mapOpenAICompatibleModel(
      openAIModel as unknown as OpenAICompatibleModelRow,
    );
  }

  const { data: geminiModel, error: geminiError } = await supabase
    .from("gemini_models")
    .select(geminiModelSelectFields)
    .eq("name", modelId)
    .eq("is_enabled", true)
    .maybeSingle();

  if (geminiError) {
    throw geminiError;
  }

  if (geminiModel) {
    return mapGeminiModel(geminiModel as unknown as GeminiModelRow);
  }

  throw new ModelRegistryError("模型不存在，或当前未启用。");
}
