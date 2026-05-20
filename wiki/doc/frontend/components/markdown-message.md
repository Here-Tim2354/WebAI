# `src/features/chat/components/markdown-message.tsx`

## 文件定位

`MarkdownMessage` 是消息正文的统一 Markdown 渲染入口。`MessageBubble`、更新日志弹窗都会使用它。

## 核心职责

它负责把普通字符串渲染成带这些能力的内容：

- GFM：表格、列表、删除线等。
- 数学公式：`remark-math` + `rehype-katex`。
- 化学式：`katex/contrib/mhchem`。
- 中文友好的 GFM 解析。
- 自定义代码块：把 `<pre><code>` 替换成 [[components/code-block|CodeBlock]]。
- 表格横向滚动。

## 关键函数

- `escapeCjkContaminatedSingleDollarMath(content)`：如果 `$...$` 中包含中文或中文标点，就转义美元符号，避免“价格 $xxx$”一类自然语言被 KaTeX 当公式。
- `normalizeSingleLineDisplayMath(content)`：把单行 `$$...$$` 拆成独立块级公式。
- `extractTextContent(node)`：从 ReactMarkdown 给出的 ReactNode 中递归提取纯文本，交给 `CodeBlock`。

## 设计缘由

模型输出很容易混合中文、公式、代码和表格。这里把 Markdown 兼容性集中处理，`MessageBubble` 就只关心消息状态，不需要理解 Markdown 细节。

## 返回组件规模

返回一个 `.markdown` 容器。实际大小取决于内容；代码块和表格内部会用 `ScrollArea` 控制横向滚动，避免撑破消息列。

## 代码展开

### 公式预处理

`escapeCjkContaminatedSingleDollarMath` 只处理单美元 `$...$`。它会寻找成对的单美元分隔符，如果中间包含中文或中文标点，就把两边美元转义。

这不是为了限制公式，而是为了保护中文自然语言。模型有时会输出类似“价格是 $100$ 左右”或中文夹美元的文本，如果直接交给 KaTeX，可能被错误渲染或报错。

`normalizeSingleLineDisplayMath` 则处理另一类模型输出：单行 `$$...$$`。它会改成：

```md
$$
...
$$
```

这样 KaTeX 会按 display math 渲染，公式不会挤在段落里。

### ReactMarkdown 组件替换

`table` 被包在 `ScrollArea axis="horizontal"` 里。原因是模型可能输出很宽的表格，直接渲染会撑破消息列。

`pre` 会拿到 `<pre><code>` 结构。代码先通过 `extractTextContent` 从 ReactNode 抽成纯文本，再传给 `CodeBlock`。这一步不能简单 `String(children)`，因为 ReactMarkdown 的 children 可能是嵌套 React 元素。

`code` 没有 language class 时，视为行内代码，添加 `markdown-inline-code`。有 class 时保留给 `pre` 层处理。

### 插件顺序

`remarkMath`、`remarkGfm`、中文友好插件和 `rehypeKatex` 一起工作。这里的目标不是完整支持所有 Markdown 方言，而是覆盖聊天里最常见的：列表、表格、代码块、公式、化学式。

### UI 规模

`MarkdownMessage` 自己只返回一个 `.markdown` 容器。段落、标题、表格、公式、代码块的视觉大小都由 `globals.css` 控制。
