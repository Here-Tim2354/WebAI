export type AssistantStreamDelta = {
  type: "text" | "thought";
  delta: string;
};
