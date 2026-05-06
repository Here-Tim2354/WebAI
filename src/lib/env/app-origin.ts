function normalizeOrigin(candidate: string) {
  const url = new URL(candidate);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("APP_ORIGIN 必须是 http 或 https 地址。");
  }

  return url.origin;
}

export function getAppOrigin(requestUrl?: string) {
  // 登录回跳地址不能信任请求头里的 Host。
  // 生产环境优先使用显式配置的应用来源，避免 OAuth / magic link 被代理头污染。
  const configuredOrigin =
    process.env.APP_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.trim()}`
      : "");

  if (configuredOrigin) {
    return normalizeOrigin(configuredOrigin);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须配置 APP_ORIGIN。");
  }

  // 开发环境保留 requestUrl 推断能力，方便 localhost 与临时端口调试。
  if (!requestUrl) {
    throw new Error("缺少请求地址，无法推断应用来源。");
  }

  return new URL(requestUrl).origin;
}

export function createAppUrl(pathname: string, requestUrl?: string) {
  return new URL(pathname, getAppOrigin(requestUrl));
}
