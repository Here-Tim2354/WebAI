import { GoogleGenAI, type Model } from "@google/genai";
import { NextResponse } from "next/server";
import {
  fetchGeminiModelsRequestSchema,
  fetchGeminiModelsResponseSchema,
} from "@/lib/schemas/model";
import { DEFAULT_GEMINI_BASE_URL } from "@/lib/ai/gemini-model-catalog";
import {
  normalizeFetchedGeminiModel,
  shouldIncludeFetchedGeminiModel,
} from "@/lib/ai/gemini-model-normalizer";
import { normalizeGeminiBaseUrl } from "@/lib/ai/gemini-base-url";
import { getSupabaseAuthContext } from "@/lib/supabase/auth";
import {
  listFetchedModels,
  replaceFetchedGeminiModels,
} from "@/lib/supabase/model-registry";

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: {
        message: "请先登录后再继续。",
      },
    },
    { status: 401 },
  );
}

function readUnknownErrorField(error: unknown, field: string) {
  if (!error || typeof error !== "object" || !(field in error)) {
    return null;
  }

  const value = (error as Record<string, unknown>)[field];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatGeminiFetchError(error: unknown) {
  // Gemini SDK、代理端点和数据库唯一约束会返回不同形态的错误。
  // API 只向前端暴露可操作的排查方向，不把原始 provider 文本直接作为产品文案。
  const message =
    error instanceof Error
      ? error.message
      : readUnknownErrorField(error, "message");
  const details = readUnknownErrorField(error, "details");
  const code = readUnknownErrorField(error, "code");
  const joined = [message, details, code].filter(Boolean).join("\n");

  if (/fetch failed|ECONNRESET|TLS|socket disconnected/i.test(joined)) {
    return "无法连接 Gemini URL，TLS 连接被中断。请检查 URL 是否支持 Gemini 原生 /v1beta 接口、证书是否可用，以及本机代理是否允许服务端 Node 进程访问该地址。";
  }

  if (/401|403|API key|api key|permission|unauthorized/i.test(joined)) {
    return "Gemini API Key 无效或没有模型列表权限。";
  }

  if (/404|not found/i.test(joined)) {
    return "Gemini URL 没有暴露 models.list 接口，请确认它兼容 /v1beta/models。";
  }

  if (/model_fetched_single_default_per_user_idx|duplicate key/i.test(joined)) {
    return "当前账号已经有默认模型，新拉取的模型不能再次自动设为默认。请重试拉取，或手动切换默认模型。";
  }

  return message || "拉取 Gemini 模型失败，请稍后再试。";
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getSupabaseAuthContext();

    if (!user) {
      return unauthorizedResponse();
    }

    const payload = await request.json().catch(() => null);
    const parsed = fetchGeminiModelsRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message:
              parsed.error.issues[0]?.message ?? "拉取模型参数不正确。",
          },
        },
        { status: 400 },
      );
    }

    // Base URL 来自用户本机设置，但真正请求由服务端发出。
    // 进入 SDK 前必须完成格式和内网地址校验，避免把模型拉取接口变成任意 URL 探测器。
    const baseUrl = await normalizeGeminiBaseUrl(parsed.data.baseUrl);
    const client = new GoogleGenAI({
      apiKey: parsed.data.apiKey,
      httpOptions:
        baseUrl === DEFAULT_GEMINI_BASE_URL
          ? undefined
          : {
              baseUrl,
            },
    });
    const pager = await client.models.list();
    const normalizedModels = [];
    let fetched = 0;
    let skipped = 0;

    for await (const model of pager) {
      fetched += 1;

      if (!shouldIncludeFetchedGeminiModel(model as Model)) {
        skipped += 1;
        continue;
      }

      const normalized = normalizeFetchedGeminiModel(model as Model, baseUrl);

      if (!normalized) {
        skipped += 1;
        continue;
      }

      normalizedModels.push(normalized);
    }

    // 拉取模型的语义是用该 Gemini 端点的最新列表刷新用户模型集合。
    // 注册表会负责同 ID 去重、catalog 能力补全、默认模型保护和不可支持模型禁用。
    await replaceFetchedGeminiModels(supabase, user.id, normalizedModels);

    const models = await listFetchedModels(supabase, user.id);

    return NextResponse.json(
      fetchGeminiModelsResponseSchema.parse({
        models,
        summary: {
          fetched,
          upserted: normalizedModels.length,
          skipped,
        },
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          message: formatGeminiFetchError(error),
        },
      },
      { status: 400 },
    );
  }
}
