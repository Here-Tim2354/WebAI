"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TooltipSide = "top" | "right" | "bottom" | "left";
type TooltipAlign = "start" | "center" | "end";

type TooltipProps = {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: TooltipSide;
  align?: TooltipAlign;
  disabled?: boolean;
  delay?: number;
  closeDelay?: number;
  className?: string;
};

const sideClassName: Record<TooltipSide, string> = {
  top: "bottom-full mb-2",
  right: "left-full ml-2",
  bottom: "top-full mt-2",
  left: "right-full mr-2",
};

const verticalAlignClassName: Record<TooltipAlign, string> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

const horizontalAlignClassName: Record<TooltipAlign, string> = {
  start: "top-0",
  center: "top-1/2 -translate-y-1/2",
  end: "bottom-0",
};

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  disabled = false,
  delay = 360,
  closeDelay = 80,
  className,
}: TooltipProps) {
  if (!content || disabled) {
    return children;
  }

  const alignClassName =
    side === "top" || side === "bottom"
      ? verticalAlignClassName[align]
      : horizontalAlignClassName[align];

  return (
    <span className="group/tooltip relative inline-flex">
      {children}
      <span
        role="tooltip"
        style={{
          transitionDelay: `${delay}ms`,
          transitionDuration: `${Math.max(closeDelay, 140)}ms`,
        }}
        className={cn(
          "pointer-events-none absolute z-50 block w-max max-w-[18rem] rounded-[9px] border border-slate-200/80 bg-white/92 px-2.5 py-1.5 text-[0.72rem] leading-5 text-slate-600 opacity-0 shadow-[0_16px_34px_rgba(44,74,122,0.14)] backdrop-blur-xl",
          "scale-95 blur-[1px] transition-[opacity,transform,filter] ease-[cubic-bezier(0.16,1,0.3,1)]",
          "group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 group-hover/tooltip:blur-0 group-focus-within/tooltip:scale-100 group-focus-within/tooltip:opacity-100 group-focus-within/tooltip:blur-0",
          sideClassName[side],
          alignClassName,
          className,
        )}
      >
        {content}
      </span>
    </span>
  );
}
