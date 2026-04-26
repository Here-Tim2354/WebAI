"use client";

import { useEffect, useRef } from "react";
import { useOverlayScrollbars } from "overlayscrollbars-react";
import type { EventListeners, PartialOptions } from "overlayscrollbars";

type UseOverlayScrollbarOptions = {
  options: PartialOptions;
  events?: EventListeners;
};

export function useOverlayScrollbar<TElement extends HTMLElement>({
  options,
  events,
}: UseOverlayScrollbarOptions) {
  const targetRef = useRef<TElement | null>(null);
  const [initialize] = useOverlayScrollbars({
    options,
    events,
    defer: true,
  });

  useEffect(() => {
    if (!targetRef.current) {
      return;
    }

    initialize(targetRef.current);
  }, [initialize]);

  return targetRef;
}
