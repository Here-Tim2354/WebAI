import { z } from "zod";

export const thinkingLevelSchema = z.enum(["minimal", "low", "medium", "high"]);

export const DEFAULT_THINKING_LEVEL = "minimal" satisfies ThinkingLevel;

export const thinkingLevelLabelMap = {
  minimal: "minimal",
  low: "low",
  medium: "medium",
  high: "high",
} as const satisfies Record<ThinkingLevel, string>;

export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>;
