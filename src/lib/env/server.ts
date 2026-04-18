import { z } from "zod";

// 可选环境变量在进入业务逻辑前先做一次“去空格 + 空字符串转 undefined”的归一化。
const optionalEnvStringSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().min(1).optional(),
);

const optionalUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().url("GEMINI_BASE_URL 必须是合法 URL。").optional());

const serverEnvSchema = z.object({
  GEMINI_API_KEY: optionalEnvStringSchema,
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  GEMINI_BASE_URL: optionalUrlSchema,
  OPENAI_COMPATIBLE_API_KEY: optionalEnvStringSchema,
  OPENAI_COMPATIBLE_BASE_URL: optionalUrlSchema,
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

/**
 * 运行时环境变量会被多个 provider 复用。
 * 这里做一次 parse + cache，避免每次发消息都重复校验和拼装错误信息。
 */
export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = serverEnvSchema.parse({
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
      GEMINI_BASE_URL: process.env.GEMINI_BASE_URL,
      OPENAI_COMPATIBLE_API_KEY: process.env.OPENAI_COMPATIBLE_API_KEY,
      OPENAI_COMPATIBLE_BASE_URL: process.env.OPENAI_COMPATIBLE_BASE_URL,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ServerEnvError(formatEnvErrorMessage(error));
    }

    throw error;
  }

  return cachedEnv;
}

// 某些变量在 schema 里允许 optional，是为了兼容多 provider 共存；
// 真正进入具体 provider 时，再在使用点精确要求“这个值必须存在”。
export function requireServerEnvValue(
  value: string | undefined,
  errorMessage: string,
) {
  if (!value) {
    throw new ServerEnvError(errorMessage);
  }

  return value;
}
