import { z } from "zod";

const trimmedEnvStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string(),
);

const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: trimmedEnvStringSchema.refine(
    (value) => value.length > 0 && z.url().safeParse(value).success,
    "缺少或错误的 NEXT_PUBLIC_SUPABASE_URL。",
  ),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: trimmedEnvStringSchema.refine(
    (value) => value.length > 0,
    "缺少 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY。",
  ),
});

export class SupabaseEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseEnvError";
  }
}

let cachedEnv: z.infer<typeof supabaseEnvSchema> | null = null;

function formatEnvErrorMessage(error: z.ZodError) {
  return error.issues
    .map((issue) => issue.message)
    .filter((message, index, messages) => messages.indexOf(message) === index)
    .join(" ");
}

export function getSupabaseEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  try {
    cachedEnv = supabaseEnvSchema.parse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new SupabaseEnvError(formatEnvErrorMessage(error));
    }

    throw error;
  }

  return cachedEnv;
}
