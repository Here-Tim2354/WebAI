---
aliases:
  - Frontend Docs
  - 前端文档索引
---

# Frontend 文档索引

这份索引用于把当前前端文档组织成一张可在 Obsidian 中双向导航的笔记网络。

## 页面骨架

- [[chatshell]]
- [[chatshell-stateflow]]
- `src/features/chat/components/chat-header.tsx`
- [[use-chat-workspace]]
- [[use-chat-workspace-stateflow]]
- `src/features/chat/hooks/use-chat-session.ts`
- `src/features/chat/hooks/use-fetched-models.ts`

## 侧栏

- [[conversation-sidebar]]
- [[conversation-sidebar-stateflow]]

## 消息区

- [[message-list]]
- [[message-list-stateflow]]
- [[message-bubble]]
- [[message-bubble-stateflow]]
- [[markdown-message]]
- [[markdown-message-stateflow]]
- [[code-block]]
- [[code-block-stateflow]]

## 输入区

- [[chat-input]]
- [[chat-input-stateflow]]

## 通用 UI Primitive

- [[ui-primitives]]

## 登录页

- [[auth-panel]]
- [[auth-panel-stateflow]]

## 库文档

- [[library/GUIDE|Library 文档索引]]

## 使用建议

- 想看“页面长什么样”，优先看不带 `-stateflow` 的结构文档。
- 想看“状态怎么流动、请求怎么触发、effect 在做什么”，看对应的 `-stateflow` 文档。
- 想看“工作区编排层为什么不再堆在 `ChatShell` 里”，优先看 [[use-chat-workspace]]，代码路径在 `src/features/chat/hooks/use-chat-workspace.ts`。
- 想看“消息流 NDJSON、URL Context、草稿附件和停止生成怎样进入前端消息缓存”，看 `src/features/chat/lib/chat-stream.ts` 与 `src/features/chat/hooks/use-chat-session.ts`。
- 想看“Gemini Key、Base URL、用户私有模型列表、启停和默认项怎么进入侧栏设置”，看 `src/features/chat/hooks/use-gemini-runtime-config.ts`、`src/features/chat/hooks/use-fetched-models.ts` 和 [[conversation-sidebar]]。
- 想看“单条消息、Markdown 和代码块体验到底在哪层实现”，按 [[message-bubble]] -> [[markdown-message]] -> [[code-block]] 的顺序看。
- 想看“外部库是怎么落到代码路径里的”，看 `library` 库里的 `footprint` 系列文档。
- 在 Obsidian 里打开任意一篇后，可以直接结合 `Backlinks` 和 `Outgoing links` 面板继续跳转。
