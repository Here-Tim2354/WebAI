"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import type { ComponentPropsWithoutRef, UIEvent } from "react";
import {
  OverlayScrollbarsComponent,
  type OverlayScrollbarsComponentRef,
} from "overlayscrollbars-react";
import { cn } from "@/lib/utils";
import {
  scrollAreaOptionsByAxis,
  type ScrollAreaAxis,
} from "./scroll-options";

type ScrollAreaProps = ComponentPropsWithoutRef<"div"> & {
  axis?: ScrollAreaAxis;
};

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea(
    { axis = "vertical", className, children, onScroll, ...props },
    forwardedRef,
  ) {
    const scrollRef = useRef<OverlayScrollbarsComponentRef<"div"> | null>(
      null,
    );

    useImperativeHandle(
      forwardedRef,
      () =>
        (
          scrollRef.current?.osInstance()?.elements().viewport ??
          scrollRef.current?.getElement()
        ) as HTMLDivElement,
      [],
    );

    const handleScroll = useCallback(
      (_: unknown, event: Event) => {
        onScroll?.(event as unknown as UIEvent<HTMLDivElement>);
      },
      [onScroll],
    );

    return (
      <OverlayScrollbarsComponent
        ref={scrollRef}
        element="div"
        options={scrollAreaOptionsByAxis[axis]}
        events={onScroll ? { scroll: handleScroll } : undefined}
        defer
        data-overlayscrollbars-initialize=""
        className={cn("min-h-0", className)}
        {...props}
      >
        {children}
      </OverlayScrollbarsComponent>
    );
  },
);
