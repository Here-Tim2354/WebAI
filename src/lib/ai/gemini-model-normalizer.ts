import { type Model } from "@google/genai";
import {
  DEFAULT_GEMINI_BASE_URL,
  GEMINI_MODEL_ICON_URL,
  getGeminiCatalogEntry,
} from "@/lib/ai/gemini-model-catalog";
import { AIModel } from "@/lib/schemas/model";

export type NormalizedFetchedGeminiModel = {
  provider: "gemini";
  apiStyle: "gemini_native";
  baseUrl: string;
  modelId: string;
  label: string;
  description: string | null;
  icon: string | null;
  inputTokenLimit: number | null;
  outputTokenLimit: number | null;
  capabilities: AIModel["capabilities"];
  rawMetadata: Record<string, unknown>;
  source: "catalog" | "api";
  catalogMatched: boolean;
  defaultEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

const conservativeCapabilities = {
  text: true,
  image: false,
  audio: false,
  video: false,
  webSearch: false,
  functionCalling: false,
  tools: false,
  streaming: true,
  reasoning: false,
  files: false,
  structuredOutputs: false,
  googleSearch: false,
  urlContext: false,
  codeExecution: false,
} satisfies AIModel["capabilities"];

// models.list 会返回生成、嵌入、图片、视频、Live 等多种资源。
// 聊天产品只接收 generateContent 文本主链路，其他模型先排除在可用列表之外。
const excludedModelIdPatterns = [
  /image/i,
  /imagen/i,
  /veo/i,
  /live/i,
  /tts/i,
  /audio-preview/i,
  /embedding/i,
  /robotics/i,
  /lyria/i,
  /deep-research/i,
  /computer-use/i,
  /banana/i,
];

function normalizeModelId(name: string | undefined) {
  if (!name) {
    return null;
  }

  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  return trimmedName
    .replace(/^models\//, "")
    .replace(/^publishers\/google\/models\//, "");
}

function getModelActions(model: Model) {
  // Google SDK 与不同端点返回的字段名可能不完全一致。
  // 同时读取两个常见动作字段，可以兼容官方 Gemini 与部分 Gemini 原生代理。
  const record = model as unknown as {
    supportedActions?: string[];
    supportedGenerationMethods?: string[];
  };

  return [
    ...(record.supportedActions ?? []),
    ...(record.supportedGenerationMethods ?? []),
  ];
}

function supportsGenerateContent(model: Model) {
  const actions = getModelActions(model);

  if (actions.length === 0) {
    return true;
  }

  return actions.some((action) => action === "generateContent");
}

export function shouldIncludeFetchedGeminiModel(model: Model) {
  const modelId = normalizeModelId(model.name);

  if (!modelId) {
    return false;
  }

  if (excludedModelIdPatterns.some((pattern) => pattern.test(modelId))) {
    return false;
  }

  return supportsGenerateContent(model);
}

export function normalizeFetchedGeminiModel(
  model: Model,
  baseUrl = DEFAULT_GEMINI_BASE_URL,
): NormalizedFetchedGeminiModel | null {
  const modelId = normalizeModelId(model.name);

  if (!modelId || !shouldIncludeFetchedGeminiModel(model)) {
    return null;
  }

  const catalogEntry = getGeminiCatalogEntry(modelId);
  const capabilities = catalogEntry
    ? catalogEntry.capabilities
    : {
        ...conservativeCapabilities,
        // 端点返回的 thinking 只说明可能存在思考能力；未知模型仍不自动放开文件、联网等高影响能力。
        reasoning: model.thinking === true,
      };

  return {
    provider: "gemini",
    apiStyle: "gemini_native",
    baseUrl,
    modelId,
    label: catalogEntry?.label ?? model.displayName ?? modelId,
    description: catalogEntry?.description ?? model.description ?? null,
    icon: catalogEntry?.icon ?? GEMINI_MODEL_ICON_URL,
    inputTokenLimit: catalogEntry?.inputTokenLimit ?? model.inputTokenLimit ?? null,
    outputTokenLimit:
      catalogEntry?.outputTokenLimit ?? model.outputTokenLimit ?? null,
    capabilities,
    rawMetadata: model as unknown as Record<string, unknown>,
    // source 决定 UI 是否允许启用。catalog 匹配代表系统有可靠能力补全，api 仅用于展示端点返回内容。
    source: catalogEntry ? "catalog" : "api",
    catalogMatched: catalogEntry !== null,
    defaultEnabled: catalogEntry?.defaultEnabled ?? false,
    isDefault: catalogEntry?.isDefault ?? false,
    sortOrder: catalogEntry?.sortOrder ?? 1000,
  };
}
