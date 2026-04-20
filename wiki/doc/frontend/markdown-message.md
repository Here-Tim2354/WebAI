---
aliases:
  - MarkdownMessage
  - 消息 Markdown 渲染
---

# MarkdownMessage 说明

本文档用于理解 `MarkdownMessage` 如何把消息正文渲染成富文本，以及它如何把代码块继续下沉到 `CodeBlock`。

代码入口：
- `src/components/chat/markdown-message.tsx`

关联笔记：
- [[message-bubble]]
- [[code-block]]

## 1. 组件职责

`MarkdownMessage` 是消息正文的统一渲染入口。

它主要负责：

- Markdown 渲染
- GFM 支持
- 中文 Markdown 兼容
- 表格包装
- 行内代码渲染
- 把块级代码替换成 `CodeBlock`

---

## 2. 当前启用的 remark 插件

当前已启用：

- `remark-gfm`
- `remark-cjk-friendly`
- `remark-cjk-friendly-gfm-strikethrough`

这意味着它除了常规 Markdown，还兼顾：

- 表格、任务列表、删除线等 GFM 能力
- 中文段落里更自然的 Markdown 行为

---

## 3. 表格与代码块的处理

### 表格

表格不会直接裸渲染，而是被包进：

- `markdown-table-wrap`

这样当前样式层可以统一处理：

- 横向滚动
- 外层边框和圆角

### 块级代码

默认的 `<pre><code>` 结构会被识别并替换成：

- `CodeBlock`

这样代码块体验就可以独立管理：

- 高亮
- 头部语言标签
- 复制按钮

---

## 4. 行内代码与紧凑样式

没有语言 class 的 `code` 会被视为行内代码，继续走：

- `markdown-inline-code`

另外，当前组件已经支持外部传入可选 `className`。

现在最重要的用法是：

- user 消息注入 `markdown--compact`

作用：

- 把 user 单行消息的字号、行高、段落 margin 收紧
- 不影响 assistant 长文正文的阅读节奏

---

## 5. 一句话理解

`MarkdownMessage` 是消息正文的富文本分发器：它负责把普通正文、表格、行内代码和块级代码分别送进正确的展示通道。
