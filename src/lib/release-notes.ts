export const CURRENT_RELEASE_NOTE = {
  id: "v1.1",
  title: "V1.1 更新日志",
  sourcePath: "wiki/Optimization/version/V1.1.md",
} as const;

export type ReleaseNote = {
  id: string;
  title: string;
  content: string;
  sourcePath: string;
};
