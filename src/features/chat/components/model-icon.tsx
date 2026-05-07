"use client";

import { BotIcon, SparklesIcon } from "lucide-react";
import { AIModel } from "@/lib/schemas/model";
import { cn } from "@/lib/utils";

type ModelIconProps = {
  model: Pick<AIModel, "icon" | "label">;
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

  // Lucide 不提供 Gemini 官方品牌图标，注册表图标 key 先映射到通用模型图标。
  if (iconKey === "sparkles" || iconKey === "gemini") {
    return <SparklesIcon className={cn("size-4", className)} aria-hidden="true" />;
  }

  if (iconKey === "bot") {
    return <BotIcon className={cn("size-4", className)} aria-hidden="true" />;
  }

  return <SparklesIcon className={cn("size-4", className)} aria-hidden="true" />;
}
