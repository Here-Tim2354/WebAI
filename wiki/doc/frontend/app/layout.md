# `src/app/layout.tsx`

## 文件定位

`layout.tsx` 是 App Router 的根布局。它包住整个前端应用，负责 HTML 语言、metadata、favicon 和字体变量。

## 核心逻辑

导出两块内容：

- `metadata`：页面标题、描述和 favicon。
- `RootLayout`：返回 `<html lang="zh-CN">` 和 `<body>`。

`body` 上挂了 `GeistSans.variable` 和 `GeistMono.variable`，后续 CSS 通过 `var(--font-geist-sans)`、`var(--font-geist-mono)` 复用。

## 设计缘由

字体变量放在根布局比较合适。聊天产品里 Markdown、代码块、按钮和输入框都会用到统一字体，如果分散到组件里会很难保持一致。

## UI 规模

根布局不渲染具体界面，只提供全局壳。所有页面内容来自 `{children}`。

## 代码展开

### metadata 的作用

`metadata` 会被 Next.js 用来生成页面基础 `<head>` 信息。这里设置了：

- `title: "WebAI"`
- `description`
- favicon：`/favicon.svg`

这不是聊天逻辑，但会影响浏览器标签页、收藏、PWA 类展示和基础 SEO 信息。

### 字体变量

`GeistSans.variable` 和 `GeistMono.variable` 只是把字体变量挂到 body。真正字体栈在 `globals.css` 的 `--font-sans`、`--font-mono` 中继续拼接中文字体 fallback。

也就是说，英文/数字优先 Geist，中文部分仍然靠系统中文字体或自定义字体栈补齐。

### HTML 语言

`<html lang="zh-CN">` 对浏览器、屏幕阅读器和字体排版都有意义。项目主要中文界面，所以这里不应该留默认英文。
