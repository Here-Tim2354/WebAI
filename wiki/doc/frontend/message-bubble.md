---
aliases:
  - MessageBubble
  - 单条消息气泡
---

# MessageBubble 说明

本文档用于理解 `MessageBubble` 如何决定单条消息的视觉语义，以及它和 `MarkdownMessage` 的关系。

代码入口：
- `src/components/chat/message-bubble.tsx`

关联笔记：
- [[message-list]]
- [[markdown-message]]
- [[code-block]]

## 1. 组件职责

`MessageBubble` 只处理单条消息。

它主要负责：

- 识别消息角色
- 识别消息状态
- 选择对应的标签、图标和气泡样式
- 把正文继续交给 `MarkdownMessage`

---

## 2. 当前角色语义

当前支持的角色包括：

- `assistant`
- `user`
- `system`
- `error`

其中：

- `assistant` / `system` 走 assistant-like 视觉
- `user` 走右侧蓝色气泡
- `error` 走红色错误气泡

---

## 3. 当前状态语义

当前会识别这些消息状态：

- `pending`
- `streaming`
- `complete`
- `cancelled`
- `error`

它们会影响：

- 顶部状态标签
- assistant 占位态文案
- 是否进入流式 reveal 渲染

---

## 4. 流式 reveal 在哪里发生

assistant 流式回复时，并不是 `MessageList` 在逐字渲染。

当前实现里，`MessageBubble` 内部通过 `StreamingMarkdownMessage` 负责：

- 把增量文本拆成 reveal 单元
- 根据 backlog 控制节奏
- 在 `reduced motion` 场景下直接降级
- 展示闪烁光标

所以“assistant 正在一点点出现”这件事，是单条消息级能力，不是列表级能力。

---

## 5. 与 MarkdownMessage 的关系

`MessageBubble` 本身不直接解析 Markdown。

正文渲染流程是：

- 普通消息 -> `MarkdownMessage`
- assistant 流式消息 -> `StreamingMarkdownMessage -> MarkdownMessage`

当前 user 消息还会额外传入：

- `markdown--compact`

用于把 user 单行消息的正文约束和 assistant 长文排版分开。

---

## 6. 一句话理解

`MessageBubble` 是消息区里真正负责“单条消息长什么样”的组件：角色、状态、流式 reveal、正文入口都在这里决定。
