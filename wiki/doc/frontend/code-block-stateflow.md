---
aliases:
  - CodeBlock 状态流
---

# CodeBlock 状态流说明

本文档用于理解 `CodeBlock` 当前唯一真正的交互状态：复制按钮状态。

代码入口：
- `src/components/chat/code-block.tsx`

关联笔记：
- [[code-block]]

## 1. 输入

`CodeBlock` 接收：

- `className`
- `code`
- `language`

它会基于这些输入先派生出：

- `highlightedCode`

这个值来自 `highlightCode()`，决定最终 `<code>` 要展示的高亮 HTML。

---

## 2. 本地状态

当前组件只有一个本地状态：

- `copied`

作用：

- 控制复制按钮当前显示 `CopyIcon` 还是 `CheckIcon`
- 控制当前的 `aria-label` / `title`

---

## 3. 复制链路

点击复制按钮后，当前会执行：

- `handleCopy()`

逻辑分成两层：

### 3.1 首选通道

优先尝试：

- `navigator.clipboard.writeText(code)`

### 3.2 fallback 通道

如果首选失败，则退回到：

- `fallbackCopyText(code)`

它内部通过隐藏 `textarea` + `document.execCommand("copy")` 来完成复制。

---

## 4. copied 状态何时切换

当前规则是：

1. 复制成功
2. `setCopied(true)`
3. 启动一个 1400ms 定时器
4. 定时器结束后 `setCopied(false)`

如果复制失败：

- 保持或回退到 `false`

所以当前这个组件的主要状态流，其实就是一个短时反馈状态机。

---

## 5. 一句话总结

`CodeBlock` 的状态流很小，但很明确：围绕“复制是否成功”这一个交互状态，在复制图标、成功图标和复制 fallback 链路之间切换。
