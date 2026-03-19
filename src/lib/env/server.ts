import { z } from "zod";

const optionalUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().url().optional());

const serverEnvSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "缺少 GEMINI_API_KEY。"),
  GEMINI_MODEL: z.string().default("gemini-3-flash-preview"),
  GEMINI_BASE_URL: optionalUrlSchema,
});

let cachedEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = serverEnvSchema.parse({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    GEMINI_BASE_URL: process.env.GEMINI_BASE_URL,
  });

  return cachedEnv;
}
