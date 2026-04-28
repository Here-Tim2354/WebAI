---
aliases:
  - MarkdownMessage 状态流
---

# MarkdownMessage 状态流说明

本文档用于理解 `MarkdownMessage` 如何把文本内容送进不同的渲染分支。

代码入口：
- `src/components/chat/markdown-message.tsx`

关联笔记：
- [[markdown-message]]
- [[code-block]]

## 1. 输入

当前组件只接收两个输入：

- `content`
- `className`

因此它没有自己的本地 state，也没有 `useEffect`。

它的状态流重点不在内部状态，而在：

- 不同 Markdown 节点被分派到哪里

---

## 2. 渲染分支

当前主要有四类分支。

### 2.1 普通正文节点

普通段落、标题、列表等节点：

- 继续按 ReactMarkdown 默认结构输出
- 再由 `.markdown` 或传入的 className 负责样式

### 2.2 表格节点

表格会被包装成：

- `markdown-table-wrap`

这样样式层才能统一处理滚动和外壳。

### 2.3 代码节点

代码节点会继续分成：

- 没有 language class 的行内代码
- 有 language class 的块级代码

其中：

- 行内代码 -> `markdown-inline-code`
- 块级代码 -> `CodeBlock`

### 2.4 数学公式节点

LaTeX 公式先由 `remark-math` 从 Markdown 文本中识别，再由 `rehype-katex` 输出 KaTeX 结构。

当前支持：

- 行内 `$...$`
- 块级 `$$...$$`

注意：流式输出期间，如果公式还没有闭合，渲染结果可能会临时回退为普通文本或出现短暂重排，后续需要真实对话继续观察。

---

## 3. extractTextContent 的作用

块级代码替换成 `CodeBlock` 之前，当前会先调用：

- `extractTextContent()`

它负责把 ReactNode 里的纯文本代码抽出来。

这样后面才能把真正的源码字符串交给：

- 高亮逻辑
- 复制逻辑

---

## 4. className 注入的语义

当前组件支持外部传入 `className`。

最关键的用法是：

- user 消息注入 `markdown--compact`

这个分支决定了：

- 同样是 MarkdownMessage
- user 和 assistant 可以走不同排版节奏

因此它虽然没有内部 state，但它承担了一个很重要的“样式分发入口”角色。

---

## 5. 一句话总结

`MarkdownMessage` 的状态流本质上是一个分发过程：把 `content` 解析后，根据节点类型把正文、表格、公式、行内代码和块级代码送进不同的渲染通道。
