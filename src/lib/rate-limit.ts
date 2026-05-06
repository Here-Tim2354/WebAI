type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

// 轻量限流只保护本进程里的匿名入口，适合 magic link 这类低频请求。
// 分布式部署仍应在 Cloudflare / Supabase Auth 层继续配置全局限流。
const buckets = new Map<string, RateLimitBucket>();

export class RateLimitError extends Error {
  constructor(message = "请求过于频繁，请稍后再试。") {
    super(message);
    this.name = "RateLimitError";
  }
}

export function getClientIp(request: Request) {
  // 生产环境通常由代理层写入 x-forwarded-for；只取第一段作为客户端来源。
  // IP 不作为身份凭证，只用于粗粒度滥用控制。
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function assertRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return;
  }

  if (current.count >= limit) {
    throw new RateLimitError();
  }

  current.count += 1;
}
