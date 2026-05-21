import { AIModel } from "@/lib/schemas/model";

export const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
export const GEMINI_MODEL_ICON_URL =
  "https://ekswdwnxsugmtkdxfmnd.supabase.co/storage/v1/object/public/ai_svgs/gemini.svg";

export type GeminiCatalogEntry = {
  modelId: string;
  label: string;
  description: string;
  icon: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  capabilities: AIModel["capabilities"];
  defaultEnabled: boolean;
  isDefault: boolean;
  sortOrder: number;
};

const fullTextModelCapabilities = {
  text: true,
  image: true,
  audio: true,
  video: true,
  webSearch: true,
  functionCalling: true,
  tools: true,
  streaming: true,
  reasoning: true,
  files: true,
  structuredOutputs: true,
  googleSearch: true,
  urlContext: true,
  codeExecution: true,
} satisfies AIModel["capabilities"];

export const GEMINI_MODEL_CATALOG = [
  {
    modelId: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    description:
      "Gemini 3.5 Flash：Gemini 3.5 系列快速多模态模型，适合日常聊天、代码、长上下文和多步 Agent 任务。",
    icon: GEMINI_MODEL_ICON_URL,
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    capabilities: fullTextModelCapabilities,
    defaultEnabled: true,
    isDefault: true,
    sortOrder: 5,
  },
  {
    modelId: "gemini-3-flash-preview",
    label: "Gemini 3 Flash Preview",
    description:
      "Gemini 3 Flash Preview：Gemini 3 系列均衡模型，支持文本、图像、音频、视频与 PDF 输入，适合主聊天链路。",
    icon: GEMINI_MODEL_ICON_URL,
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    capabilities: fullTextModelCapabilities,
    defaultEnabled: true,
    isDefault: false,
    sortOrder: 10,
  },
  {
    modelId: "gemini-3-pro-preview",
    label: "Gemini 3 Pro Preview",
    description:
      "Gemini 3 Pro Preview：Gemini 3 系列高能力多模态思考模型，适合复杂推理、代码和长上下文任务。",
    icon: GEMINI_MODEL_ICON_URL,
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    capabilities: fullTextModelCapabilities,
    defaultEnabled: false,
    isDefault: false,
    sortOrder: 15,
  },
  {
    modelId: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro Preview",
    description:
      "Gemini 3.1 Pro Preview：Gemini 3.1 系列高能力模型，适合复杂推理、代码和多步工具任务。",
    icon: GEMINI_MODEL_ICON_URL,
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    capabilities: fullTextModelCapabilities,
    defaultEnabled: true,
    isDefault: false,
    sortOrder: 20,
  },
  {
    modelId: "gemini-3.1-flash-lite-preview",
    label: "Gemini 3.1 Flash-Lite Preview",
    description:
      "Gemini 3.1 Flash-Lite Preview：Gemini 3.1 系列轻量模型，适合高频、低延迟、低成本任务。",
    icon: GEMINI_MODEL_ICON_URL,
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    capabilities: fullTextModelCapabilities,
    defaultEnabled: true,
    isDefault: false,
    sortOrder: 30,
  },
  {
    modelId: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    description:
      "Gemini 2.5 Pro：稳定版高能力思考模型，适合复杂任务和长上下文。",
    icon: GEMINI_MODEL_ICON_URL,
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    capabilities: fullTextModelCapabilities,
    defaultEnabled: false,
    isDefault: false,
    sortOrder: 40,
  },
  {
    modelId: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    description:
      "Gemini 2.5 Flash：稳定版高性价比模型，适合低延迟和大规模处理。",
    icon: GEMINI_MODEL_ICON_URL,
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    capabilities: fullTextModelCapabilities,
    defaultEnabled: false,
    isDefault: false,
    sortOrder: 50,
  },
  {
    modelId: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    description:
      "Gemini 2.5 Flash-Lite：稳定版轻量多模态模型，适合低成本高吞吐任务。",
    icon: GEMINI_MODEL_ICON_URL,
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    capabilities: fullTextModelCapabilities,
    defaultEnabled: false,
    isDefault: false,
    sortOrder: 60,
  },
] as const satisfies readonly GeminiCatalogEntry[];

export const GEMINI_MODEL_CATALOG_BY_ID = new Map<string, GeminiCatalogEntry>(
  GEMINI_MODEL_CATALOG.map((entry) => [entry.modelId, entry]),
);

export const PROTECTED_GEMINI_MODEL_IDS: ReadonlySet<string> = new Set(
  GEMINI_MODEL_CATALOG
    .filter((entry) => entry.defaultEnabled)
    .map((entry) => entry.modelId),
);

export function getGeminiCatalogEntry(modelId: string) {
  return GEMINI_MODEL_CATALOG_BY_ID.get(modelId) ?? null;
}
