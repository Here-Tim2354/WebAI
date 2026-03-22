import { z } from "zod";

const requiredEnvStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().min(1, "缺少 GEMINI_API_KEY。"),
);

const optionalUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().url("GEMINI_BASE_URL 必须是合法 URL。").optional());

const serverEnvSchema = z.object({
  GEMINI_API_KEY: requiredEnvStringSchema,
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_BASE_URL: optionalUrlSchema,
});

export class ServerEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServerEnvError";
  }
}

let cachedEnv: z.infer<typeof serverEnvSchema> | null = null;

function formatEnvErrorMessage(error: z.ZodError) {
  return error.issues
    .map((issue) => issue.message)
    .filter((message, index, messages) => messages.indexOf(message) === index)
    .join(" ");
}

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = serverEnvSchema.parse({
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      GEMINI_BASE_URL: process.env.GEMINI_BASE_URL,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ServerEnvError(formatEnvErrorMessage(error));
    }

    throw error;
  }

  return cachedEnv;
}
