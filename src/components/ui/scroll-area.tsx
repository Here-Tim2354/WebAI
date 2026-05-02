"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { ComponentPropsWithoutRef, Ref, UIEvent } from "react";
import type { EventListeners, OverlayScrollbars } from "overlayscrollbars";
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

function assignForwardedRef<T>(ref: Ref<T>, value: T | null) {
  if (typeof ref === "function") {
    ref(value);
    return;
  }

  if (ref) {
    (ref as { current: T | null }).current = value;
  }
}

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
  function ScrollArea(
    { axis = "vertical", className, children, onScroll, ...props },
    forwardedRef,
  ) {
    const scrollRef = useRef<OverlayScrollbarsComponentRef<"div"> | null>(
      null,
    );

    const resolveScrollElement = useCallback(() => {
      return (
        scrollRef.current?.osInstance()?.elements().viewport ??
        scrollRef.current?.getElement() ??
        null
      ) as HTMLDivElement | null;
    }, []);

    const publishScrollElement = useCallback(
      (element?: HTMLDivElement | null) => {
        assignForwardedRef(forwardedRef, element ?? resolveScrollElement());
      },
      [forwardedRef, resolveScrollElement],
    );

    useEffect(() => {
      publishScrollElement();

      return () => {
        assignForwardedRef(forwardedRef, null);
      };
    }, [forwardedRef, publishScrollElement]);

    const handleInitialized = useCallback(
      (instance: OverlayScrollbars) => {
        publishScrollElement(instance.elements().viewport as HTMLDivElement);
      },
      [publishScrollElement],
    );

    const handleScroll = useCallback(
      (_: unknown, event: Event) => {
        onScroll?.(event as unknown as UIEvent<HTMLDivElement>);
      },
      [onScroll],
    );

    const events = useMemo<EventListeners>(
      () => ({
        initialized: handleInitialized,
        ...(onScroll ? { scroll: handleScroll } : {}),
      }),
      [handleInitialized, handleScroll, onScroll],
    );

    return (
      <OverlayScrollbarsComponent
        ref={scrollRef}
        element="div"
        options={scrollAreaOptionsByAxis[axis]}
        events={events}
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
