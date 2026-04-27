import { z } from "zod";

export const aiModelProviderSchema = z.enum([
  "openai_compatible",
  "gemini",
]);

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
  label: z.string().min(1),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  provider: aiModelProviderSchema,
  apiStyle: z.string().min(1),
  upstreamModelId: z.string().min(1),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
  capabilities: aiModelCapabilitiesSchema,
});

export const aiModelListResponseSchema = z.object({
  models: z.array(aiModelSchema),
});

export type AIModel = z.infer<typeof aiModelSchema>;
