import { z } from "zod";

const optionalUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().url("GEMINI_BASE_URL 必须是合法 URL。").optional());

const serverEnvSchema = z.object({
  GEMINI_MODEL: z.string().default("gemini-3.5-flash"),
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

// Gemini 运行时配置在首次读取后缓存，避免每次发消息都重复校验和拼装错误信息。
export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = serverEnvSchema.parse({
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

// Gemini API Key 允许由本机运行时设置覆盖；真正发起调用时再要求必须存在。
export function requireServerEnvValue(
  value: string | undefined,
  errorMessage: string,
) {
  if (!value) {
    throw new ServerEnvError(errorMessage);
  }

  return value;
}
