"use client";

import { useCallback, useEffect, useState } from "react";
import { GeminiRuntimeConfig } from "@/lib/schemas/chat";
import {
  AIModel,
  FetchedModel,
  fetchedModelListResponseSchema,
  fetchGeminiModelsResponseSchema,
} from "@/lib/schemas/model";
import { normalizeGeminiRuntimeConfig } from "../lib/gemini-runtime-config";
import { WorkspaceNoticeState } from "../components/workspace-notice";

type UseFetchedModelsOptions = {
  enabled: boolean;
  onAvailableModelsSynced: (models: AIModel[]) => void;
  onRuntimeConfigSaved: (config: GeminiRuntimeConfig) => void;
  onWorkspaceError: (message: string | null) => void;
  onWorkspaceNotice: (
    notice: NonNullable<WorkspaceNoticeState>,
    duration?: number,
  ) => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "暂时无法完成操作，请稍后再试。";
}

export function useFetchedModels({
  enabled,
  onAvailableModelsSynced,
  onRuntimeConfigSaved,
  onWorkspaceError,
  onWorkspaceNotice,
}: UseFetchedModelsOptions) {
  const [fetchedModels, setFetchedModels] = useState<FetchedModel[]>([]);
  const [isLoadingFetchedModels, setIsLoadingFetchedModels] = useState(false);
  const [isFetchingGeminiModels, setIsFetchingGeminiModels] = useState(false);
  const [updatingFetchedModelId, setUpdatingFetchedModelId] =
    useState<string | null>(null);

  const syncFetchedModelState = useCallback((models: FetchedModel[]) => {
    // Gemini 设置弹窗看到的是完整列表；聊天顶部模型选择只接收已启用模型。
    // 两层状态在同一个入口同步，避免 UI 勾选状态和实际可调用模型产生漂移。
    setFetchedModels(models);
    onAvailableModelsSynced(models.filter((model) => model.isEnabled));
  }, [onAvailableModelsSynced]);

  const loadFetchedModels = useCallback(async () => {
    setIsLoadingFetchedModels(true);
    onWorkspaceError(null);

    try {
      const response = await fetch("/api/models/fetched");
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "模型列表读取失败。");
      }

      const parsed = fetchedModelListResponseSchema.parse(payload);
      syncFetchedModelState(parsed.models);
    } catch (error) {
      const message = getErrorMessage(error);
      onWorkspaceError(message);
      throw new Error(message);
    } finally {
      setIsLoadingFetchedModels(false);
    }
  }, [onWorkspaceError, syncFetchedModelState]);

  const fetchGeminiModels = useCallback(async (config: GeminiRuntimeConfig) => {
    const normalizedConfig = normalizeGeminiRuntimeConfig(config);

    if (!normalizedConfig.apiKey) {
      throw new Error("请先填写 API Key。");
    }

    // 拉取动作同时保存本机配置，后续聊天请求可以继续使用同一组 Key / URL。
    onRuntimeConfigSaved(normalizedConfig);
    setIsFetchingGeminiModels(true);
    onWorkspaceError(null);

    try {
      const response = await fetch("/api/models/gemini/fetch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(normalizedConfig),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "拉取 Gemini 模型失败。");
      }

      const parsed = fetchGeminiModelsResponseSchema.parse(payload);
      syncFetchedModelState(parsed.models);
      onWorkspaceNotice({
        id: Date.now(),
        type: "success",
        title: "模型已更新",
        description: `拉取 ${parsed.summary.fetched} 个，写入 ${parsed.summary.upserted} 个，跳过 ${parsed.summary.skipped} 个。`,
      }, 3600);
    } catch (error) {
      const message = getErrorMessage(error);
      onWorkspaceError(message);
      throw new Error(message);
    } finally {
      setIsFetchingGeminiModels(false);
    }
  }, [
    onRuntimeConfigSaved,
    onWorkspaceError,
    onWorkspaceNotice,
    syncFetchedModelState,
  ]);

  const updateFetchedModel = useCallback(async (
    modelId: string,
    updates: {
      isEnabled?: boolean;
      isDefault?: boolean;
    },
  ) => {
    setUpdatingFetchedModelId(modelId);
    onWorkspaceError(null);

    try {
      // 启用、默认与删除都让服务端返回完整模型列表。
      // 前端不局部猜测结果，避免浏览器重复实现默认项唯一约束和不支持模型规则。
      const response = await fetch(`/api/models/fetched/${modelId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "模型更新失败。");
      }

      const parsed = fetchedModelListResponseSchema.parse(payload);
      syncFetchedModelState(parsed.models);
    } catch (error) {
      const message = getErrorMessage(error);
      onWorkspaceError(message);
      throw new Error(message);
    } finally {
      setUpdatingFetchedModelId(null);
    }
  }, [onWorkspaceError, syncFetchedModelState]);

  const deleteFetchedModel = useCallback(async (modelId: string) => {
    setUpdatingFetchedModelId(modelId);
    onWorkspaceError(null);

    try {
      const response = await fetch(`/api/models/fetched/${modelId}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "模型删除失败。");
      }

      const parsed = fetchedModelListResponseSchema.parse(payload);
      syncFetchedModelState(parsed.models);
    } catch (error) {
      const message = getErrorMessage(error);
      onWorkspaceError(message);
      throw new Error(message);
    } finally {
      setUpdatingFetchedModelId(null);
    }
  }, [onWorkspaceError, syncFetchedModelState]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void loadFetchedModels().catch(() => null);
  }, [enabled, loadFetchedModels]);

  return {
    fetchedModels,
    isLoadingFetchedModels,
    isFetchingGeminiModels,
    updatingFetchedModelId,
    loadFetchedModels,
    fetchGeminiModels,
    updateFetchedModel,
    deleteFetchedModel,
  };
}
