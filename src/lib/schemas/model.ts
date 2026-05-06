import { z } from "zod";

export const aiModelProviderSchema = z.literal("gemini");

export const aiModelCapabilitiesSchema = z.object({
  text: z.boolean(),
  image: z.boolean(),
  audio: z.boolean(),
  video: z.boolean(),
  webSearch: z.boolean(),
  functionCalling: z.boolean(),
  tools: z.boolean(),
  streaming: z.boolean(),
  reasoning: z.boolean(),
  files: z.boolean(),
  structuredOutputs: z.boolean(),
  googleSearch: z.boolean(),
  urlContext: z.boolean(),
  codeExecution: z.boolean(),
});

export const aiModelSchema = z.object({
  id: z.string().min(1),
  modelId: z.string().min(1),
  label: z.string().min(1),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  provider: aiModelProviderSchema,
  apiStyle: z.string().min(1),
  upstreamModelId: z.string().min(1),
  baseUrl: z.string().url(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  capabilities: aiModelCapabilitiesSchema,
});

export const aiModelListResponseSchema = z.object({
  models: z.array(aiModelSchema),
});

export const fetchedModelSchema = aiModelSchema.extend({
  isEnabled: z.boolean(),
  source: z.string(),
  fetchedAt: z.string().nullable(),
  catalogMatched: z.boolean(),
});

export const fetchedModelListResponseSchema = z.object({
  models: z.array(fetchedModelSchema),
});

export const fetchGeminiModelsRequestSchema = z.object({
  apiKey: z.string().trim().min(1, "请先填写 API Key。"),
  baseUrl: z.string().trim().url("Gemini URL 需要是合法的 https 地址。").optional(),
});

export const fetchGeminiModelsResponseSchema = z.object({
  models: z.array(fetchedModelSchema),
  summary: z.object({
    fetched: z.number().int(),
    upserted: z.number().int(),
    skipped: z.number().int(),
  }),
});

export const updateFetchedModelRequestSchema = z.object({
  isEnabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
}).refine(
  (value) => value.isEnabled !== undefined || value.isDefault !== undefined,
  {
    message: "至少需要提供一个可更新字段。",
  },
);

export type AIModel = z.infer<typeof aiModelSchema>;
export type FetchedModel = z.infer<typeof fetchedModelSchema>;
