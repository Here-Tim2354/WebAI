# `src/features/chat/components/code-block.tsx`

## 文件定位

`CodeBlock` 由 [[components/markdown-message|MarkdownMessage]] 在遇到块级代码时创建。它是聊天消息中代码展示和复制的专用组件。

## 核心职责

- 用 `highlight.js` 做语法高亮。
- 显示语言标签。
- 提供复制代码按钮。
- 使用 `ScrollArea axis="horizontal"` 处理长代码横向滚动。

## 关键函数

- `highlightCode(code, language)`：如果指定语言存在，就按指定语言高亮；否则用 `highlightAuto`。
- `fallbackCopyText(text)`：创建隐藏 textarea，通过 `document.execCommand("copy")` 兜底。
- `handleCopy()`：优先 `navigator.clipboard.writeText`，失败后走 fallback。

## 设计缘由

代码块复制不能只依赖现代 Clipboard API，因为浏览器权限、非安全上下文或嵌入环境都可能失败。这里保留降级路径，保证课程演示和普通浏览器都比较稳。

## 返回组件规模

一个完整代码块：头部语言 + 复制按钮，下面是可横向滚动的 `pre code`。视觉样式主要在 `globals.css` 的 `.code-block` 系列中。

## 代码展开

### 高亮策略

`highlightCode` 先看 `language !== "text"` 且 `hljs.getLanguage(language)` 是否存在。存在就按指定语言高亮，不存在就 `highlightAuto`。

这能兼容模型偶尔写错语言名的情况。比如它输出了一个 highlight.js 不认识的语言，也不会直接崩掉，只是回退自动识别。

### 复制策略

`handleCopy` 优先使用：

```ts
navigator.clipboard.writeText(code)
```

如果失败，调用 `fallbackCopyText`。fallback 会创建一个隐藏 textarea，写入代码、focus、select，再执行 `document.execCommand("copy")`，最后无论成功失败都会移除 textarea。

代码块里自己实现复制，而不是复用消息复制按钮，是因为代码块复制的是局部 `code`，消息复制复制的是整条消息正文。两个语义不一样。

### 安全点

高亮后的 HTML 用 `dangerouslySetInnerHTML` 注入。这一层输入来自 highlight.js 对代码文本的转义和高亮输出，而不是直接把模型原始 HTML 塞进去。仍然要记住：如果未来换高亮库，这里要重新确认转义策略。

### UI 规模

外层 `.code-block` 包含头部和滚动内容。头部显示语言和复制按钮；内容区域横向滚动，不让长行撑开消息气泡。
