---
aliases:
  - MessageBubble 状态流
---

# MessageBubble 状态流说明

本文档用于理解 `MessageBubble` 如何根据消息角色、消息状态和流式内容变化决定单条消息的展示。

代码入口：
- `src/components/chat/message-bubble.tsx`

关联笔记：
- [[message-bubble]]
- [[markdown-message]]

## 1. 输入来源

`MessageBubble` 本身不持有消息源，它只接收：

- `message`

因此它是单条消息对象的消费方，而不是消息的创建方。

---

## 2. 角色与状态派生

组件拿到 `message` 后，当前会先派生这些布尔值：

- `isAssistantLike`
- `isUser`
- `isError`
- `isStreaming`

还会派生：

- `statusLabel`

这个派生过程决定了：

- 顶部标签文字是什么
- 当前该用哪组图标
- 当前该走哪套气泡样式

---

## 3. 流式 reveal 的局部状态

真正带本地局部 state 的部分是内部的 `StreamingMarkdownMessage`。

它当前维护：

- `displayContent`
- `isFreshReveal`
- `queuedUnitsRef`
- `timerRef`
- `revealGlowTimerRef`
- `displayContentRef`

这些状态和 ref 的职责分别是：

- `displayContent`
  - 当前已经显示到页面上的文本
- `queuedUnitsRef`
  - 还没刷出来的待 reveal 单元
- `timerRef`
  - 当前 reveal 节奏定时器
- `displayContentRef`
  - 避免异步 reveal 时读到过期内容

---

## 4. reveal 链路

当 assistant 流式文本不断增长时：

1. 先比较新内容和当前已显示内容
2. 只把新增部分切成 reveal 单元
3. 根据 backlog 决定批量大小与 delay
4. 用 `startTransition` 把下一批内容刷进 `displayContent`
5. 在每次刷新后短暂触发 `isFreshReveal`

如果检测到：

- `prefers-reduced-motion`

则直接跳过 reveal 队列，整段内容一次到位。

---

## 5. 非流式分支

如果当前消息不是 assistant 流式状态，`MessageBubble` 不会进入 reveal 链路，而是直接：

- 渲染占位态
- 渲染取消态
- 或直接交给 `MarkdownMessage`

所以 reveal 是一个严格受限的局部分支，不会污染其它消息状态。

---

## 6. 一句话总结

`MessageBubble` 的状态流重点不在“列表级消息管理”，而在“如何把一条消息的角色、状态和流式增量内容转换成最终可见的单条消息体验”。
