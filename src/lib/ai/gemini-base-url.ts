import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { DEFAULT_GEMINI_BASE_URL } from "@/lib/ai/gemini-model-catalog";

function normalizeIpLiteral(hostname: string) {
  return hostname.replace(/^\[/, "").replace(/\]$/, "");
}

// Node 的 URL 解析会把 IPv6 保留在 hostname 中，IPv4 仍需要手动拆段判断私网范围。
// 自定义 Gemini URL 会由服务端发起请求，因此需要先守住 SSRF 的基础边界。
function parseIpv4Parts(address: string) {
  const parts = address.split(".").map((part) => Number(part));

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }

  return parts;
}

function isBlockedIpAddress(address: string) {
  const normalizedAddress = normalizeIpLiteral(address).toLowerCase();
  const ipVersion = isIP(normalizedAddress);

  if (ipVersion === 4) {
    const parts = parseIpv4Parts(normalizedAddress);

    if (!parts) {
      return true;
    }

    const [first, second] = parts;

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168)
    );
  }

  if (ipVersion === 6) {
    if (normalizedAddress.startsWith("::ffff:")) {
      const mappedIpv4 = normalizedAddress.slice("::ffff:".length);
      return isBlockedIpAddress(mappedIpv4);
    }

    return (
      normalizedAddress === "::" ||
      normalizedAddress === "::1" ||
      normalizedAddress.startsWith("fc") ||
      normalizedAddress.startsWith("fd") ||
      normalizedAddress.startsWith("fe80:")
    );
  }

  return false;
}

async function assertGeminiBaseUrlResolvesPublicly(hostname: string) {
  const normalizedHostname = normalizeIpLiteral(hostname);

  if (isIP(normalizedHostname)) {
    if (isBlockedIpAddress(normalizedHostname)) {
      throw new Error("Gemini URL 不能指向本机或内网地址。");
    }

    return;
  }

  const addresses = await lookup(normalizedHostname, {
    all: true,
    verbatim: true,
  });

  if (addresses.length === 0) {
    throw new Error("Gemini URL 无法解析。");
  }

  if (addresses.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new Error("Gemini URL 不能解析到本机或内网地址。");
  }
}

export async function normalizeGeminiBaseUrl(baseUrl: string | undefined) {
  const trimmedBaseUrl = baseUrl?.trim() || DEFAULT_GEMINI_BASE_URL;
  const parsedUrl = new URL(trimmedBaseUrl);

  // 只接受纯 origin / path 形式的 https Gemini 端点。
  // 账号密码、查询参数和 hash 都不属于模型端点配置，保留它们会增加凭据泄露和缓存歧义。
  if (parsedUrl.protocol !== "https:") {
    throw new Error("Gemini URL 需要是合法的 https 地址。");
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error("Gemini URL 不能包含账号密码、查询参数或哈希片段。");
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const blockedHostPatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^\[?::1\]?$/,
    /^\[?fc/i,
    /^\[?fd/i,
  ];

  if (blockedHostPatterns.some((pattern) => pattern.test(hostname))) {
    throw new Error("Gemini URL 不能指向本机或内网地址。");
  }

  // 域名不能只按字符串判断；很多风险地址会通过 DNS 解析到内网段。
  // 发起 Gemini SDK 请求前先解析一次，阻止最常见的内网跳转配置。
  await assertGeminiBaseUrlResolvesPublicly(hostname);

  return parsedUrl.toString().replace(/\/$/, "") || parsedUrl.origin;
}
