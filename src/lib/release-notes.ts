export const CURRENT_RELEASE_NOTE = {
  id: "v1.2",
  title: "V1.2 更新日志",
  sourcePath: "wiki/Optimization/version/V1.2.md",
} as const;

export type ReleaseNote = {
  id: string;
  title: string;
  content: string;
  sourcePath: string;
};
