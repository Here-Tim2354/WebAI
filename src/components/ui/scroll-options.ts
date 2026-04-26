import type { PartialOptions } from "overlayscrollbars";

export type ScrollAreaAxis = "vertical" | "horizontal" | "both";

const sharedScrollOptions = {
  scrollbars: {
    theme: "os-theme-webai",
    autoHide: "move",
    autoHideDelay: 480,
    clickScroll: true,
  },
  update: {
    debounce: {
      mutation: 40,
      resize: 40,
      event: 80,
      env: 120,
    },
  },
} satisfies PartialOptions;

export const scrollAreaOptionsByAxis = {
  vertical: {
    ...sharedScrollOptions,
    overflow: { x: "hidden", y: "scroll" },
  },
  horizontal: {
    ...sharedScrollOptions,
    overflow: { x: "scroll", y: "hidden" },
  },
  both: {
    ...sharedScrollOptions,
    overflow: { x: "scroll", y: "scroll" },
  },
} satisfies Record<ScrollAreaAxis, PartialOptions>;

export const dropdownScrollOptions = {
  ...sharedScrollOptions,
  overflow: { x: "hidden", y: "scroll" },
  scrollbars: {
    ...sharedScrollOptions.scrollbars,
    autoHideDelay: 360,
  },
} satisfies PartialOptions;
