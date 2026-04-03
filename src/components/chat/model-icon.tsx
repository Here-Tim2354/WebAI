"use client";

import { BotIcon, SparklesIcon } from "lucide-react";
import { AIModel } from "@/lib/schemas/model";
import { cn } from "@/lib/utils";

type ModelIconProps = {
  model: Pick<AIModel, "provider" | "icon" | "label">;
  className?: string;
};

export function ModelIcon({ model, className }: ModelIconProps) {
  const iconKey = model.icon?.trim().toLowerCase() ?? null;
  const iconSource = model.icon?.trim() ?? null;

  if (
    iconSource &&
    (iconSource.startsWith("http://") ||
      iconSource.startsWith("https://") ||
      iconSource.startsWith("/"))
  ) {
    return (
      <img
        src={iconSource}
        alt={`${model.label} icon`}
        className={cn("size-4 object-contain", className)}
      />
    );
  }

  // Lucide 当前没有 Gemini / OpenAI 官方品牌图标，这里先支持注册表里的通用 key。
  if (iconKey === "sparkles" || iconKey === "gemini") {
    return <SparklesIcon className={cn("size-4", className)} aria-hidden="true" />;
  }

  if (iconKey === "bot" || iconKey === "openai") {
    return <BotIcon className={cn("size-4", className)} aria-hidden="true" />;
  }

  if (model.provider === "gemini") {
    return <SparklesIcon className={cn("size-4", className)} aria-hidden="true" />;
  }

  return <BotIcon className={cn("size-4", className)} aria-hidden="true" />;
}
