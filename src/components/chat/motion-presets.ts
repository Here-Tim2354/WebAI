export const smoothEase = [0.16, 1, 0.3, 1] as [
  number,
  number,
  number,
  number,
];

export const softSpring = {
  type: "spring",
  stiffness: 260,
  damping: 28,
  mass: 0.9,
} as const;

export const panelSpring = {
  type: "spring",
  stiffness: 360,
  damping: 34,
  mass: 0.8,
} as const;

export const microTween = {
  duration: 0.18,
  ease: smoothEase,
} as const;
