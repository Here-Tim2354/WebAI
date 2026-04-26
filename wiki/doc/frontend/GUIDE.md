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
- [[use-chat-workspace]]
- [[use-chat-workspace-stateflow]]

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
- 想看“工作区编排层为什么不再堆在 `ChatShell` 里”，优先看 [[use-chat-workspace]]。
- 想看“单条消息、Markdown 和代码块体验到底在哪层实现”，按 [[message-bubble]] -> [[markdown-message]] -> [[code-block]] 的顺序看。
- 想看“外部库是怎么落到当前代码里的”，看 `library` 库里的 `footprint` 系列文档。
- 在 Obsidian 里打开任意一篇后，可以直接结合 `Backlinks` 和 `Outgoing links` 面板继续跳转。
