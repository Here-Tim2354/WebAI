---
aliases:
  - CodeBlock
  - 代码块组件
---

# CodeBlock 说明

这篇笔记帮助我们理解 `CodeBlock` 如何渲染高亮代码块，以及它当前的复制按钮实现。

代码入口：
- `src/features/chat/components/code-block.tsx`

关联笔记：
- [[markdown-message]]

## 1. 组件职责

`CodeBlock` 负责块级代码的最终展示。

它主要负责：

- 根据语言做高亮
- 显示代码块头部
- 显示语言标签
- 提供复制按钮

---

## 2. 高亮策略

这里使用：

- `highlight.js`

策略是：

- 如果传入的语言存在，就按该语言高亮
- 否则走 `highlightAuto`

因此它既支持显式语言代码块，也能在无语言时提供基础自动高亮。

---

## 3. 复制按钮运行方式

复制按钮当前已经改成图标按钮：

- 默认显示 `CopyIcon`
- 复制成功后短暂切到 `CheckIcon`

为了避免某些浏览器或 IAB 环境里 `navigator.clipboard.writeText()` 不可用，当前复制链路用了双通道策略：

1. 优先走 `Clipboard API`
2. 失败后退回到隐藏 `textarea + document.execCommand("copy")`

因此它当前不是单纯的视觉按钮，而是已经具备真实复制能力。

---

## 4. 一句话理解

`CodeBlock` 是消息正文里块级代码的最终落点：高亮、语言标签和复制体验都在这里完成。
