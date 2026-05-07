"use client";

import { useEffect, useState } from "react";
import { GeminiRuntimeConfig } from "@/lib/schemas/chat";

const LEGACY_GEMINI_RUNTIME_CONFIG_STORAGE_KEY = "webai.gemini.runtimeConfig";

function getGeminiRuntimeConfigStorageKey(userId: string) {
  return `webai.gemini.runtimeConfig.${userId}`;
}

export function normalizeGeminiRuntimeConfig(config: GeminiRuntimeConfig) {
  const apiKey = config.apiKey?.trim();
  const baseUrl = config.baseUrl?.trim();

  return {
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
}

function loadStoredGeminiRuntimeConfig(userId: string): GeminiRuntimeConfig {
  try {
    const rawConfig = window.localStorage.getItem(
      getGeminiRuntimeConfigStorageKey(userId),
    );

    if (!rawConfig) {
      return {};
    }

    const parsedConfig = JSON.parse(rawConfig) as GeminiRuntimeConfig;

    return normalizeGeminiRuntimeConfig({
      apiKey:
        typeof parsedConfig.apiKey === "string"
          ? parsedConfig.apiKey
          : undefined,
      baseUrl:
        typeof parsedConfig.baseUrl === "string"
          ? parsedConfig.baseUrl
          : undefined,
    });
  } catch {
    return {};
  }
}

function removeStoredGeminiRuntimeConfig(userId: string) {
  window.localStorage.removeItem(getGeminiRuntimeConfigStorageKey(userId));
  window.localStorage.removeItem(LEGACY_GEMINI_RUNTIME_CONFIG_STORAGE_KEY);
}

export function useGeminiRuntimeConfig(userId: string | null | undefined) {
  const [geminiRuntimeConfig, setGeminiRuntimeConfig] =
    useState<GeminiRuntimeConfig>({});

  useEffect(() => {
    let cancelled = false;

    window.queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      if (!userId) {
        setGeminiRuntimeConfig({});
        return;
      }

      // Gemini Key / URL 属于用户本机运行时配置，只保存在浏览器 localStorage。
      // storage key 按用户隔离，避免多人共用同一浏览器时沿用上一个账号的端点配置。
      window.localStorage.removeItem(LEGACY_GEMINI_RUNTIME_CONFIG_STORAGE_KEY);
      setGeminiRuntimeConfig(loadStoredGeminiRuntimeConfig(userId));
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  function saveGeminiRuntimeConfig(nextConfig: GeminiRuntimeConfig) {
    const normalizedConfig = normalizeGeminiRuntimeConfig(nextConfig);

    setGeminiRuntimeConfig(normalizedConfig);

    if (!userId) {
      return;
    }

    const storageKey = getGeminiRuntimeConfigStorageKey(userId);

    if (Object.keys(normalizedConfig).length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(normalizedConfig));
  }

  function clearGeminiRuntimeConfig() {
    setGeminiRuntimeConfig({});

    if (userId) {
      removeStoredGeminiRuntimeConfig(userId);
      return;
    }

    window.localStorage.removeItem(LEGACY_GEMINI_RUNTIME_CONFIG_STORAGE_KEY);
  }

  return {
    geminiRuntimeConfig,
    saveGeminiRuntimeConfig,
    clearGeminiRuntimeConfig,
  };
}
