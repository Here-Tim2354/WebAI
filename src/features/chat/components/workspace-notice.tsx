"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  LoaderCircleIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { softSpring } from "../lib/motion-presets";

export type WorkspaceNoticeState = {
  id: number;
  type: "loading" | "success" | "error" | "info";
  title: string;
  description?: string;
} | null;

type WorkspaceNoticeProps = {
  notice: WorkspaceNoticeState;
};

const noticeStyles = {
  loading: {
    shell: "border-sky-200/80 bg-white/92 text-slate-700 shadow-[0_18px_50px_rgba(47,95,148,0.14)]",
    icon: "bg-sky-50 text-sky-600",
  },
  success: {
    shell: "border-emerald-200/85 bg-white/94 text-slate-700 shadow-[0_18px_50px_rgba(48,124,91,0.13)]",
    icon: "bg-emerald-50 text-emerald-600",
  },
  info: {
    shell: "border-sky-200/85 bg-white/94 text-slate-700 shadow-[0_18px_50px_rgba(47,95,148,0.13)]",
    icon: "bg-sky-50 text-sky-600",
  },
  error: {
    shell: "border-red-200/85 bg-white/94 text-slate-700 shadow-[0_18px_50px_rgba(160,55,65,0.14)]",
    icon: "bg-red-50 text-red-600",
  },
} as const;

function NoticeIcon({ type }: { type: NonNullable<WorkspaceNoticeState>["type"] }) {
  if (type === "loading") {
    return <LoaderCircleIcon className="size-4 animate-spin" />;
  }

  if (type === "success" || type === "info") {
    return <CheckCircle2Icon className="size-4" />;
  }

  return <AlertCircleIcon className="size-4" />;
}

export function WorkspaceNotice({ notice }: WorkspaceNoticeProps) {
  return (
    <div
      className="pointer-events-none fixed top-4 left-1/2 z-50 flex w-[min(calc(100vw_-_1.5rem),28rem)] -translate-x-1/2 justify-center"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        {notice ? (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.985 }}
            transition={softSpring}
            className={cn(
              "pointer-events-auto flex min-h-12 w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 backdrop-blur-xl",
              noticeStyles[notice.type].shell,
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-[10px]",
                noticeStyles[notice.type].icon,
              )}
            >
              <NoticeIcon type={notice.type} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {notice.title}
              </span>
              {notice.description ? (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {notice.description}
                </span>
              ) : null}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
