# `src/app/globals.css`

## 文件定位

`globals.css` 是全局样式入口。它连接 Tailwind、OverlayScrollbars、highlight.js、KaTeX 和动画库，也定义 WebAI 的浅色蓝白主题。

## 主要内容

文件大致分五块：

1. `@import`：引入 Tailwind、滚动条、代码高亮、KaTeX 和 `tw-animate-css`。
2. `@custom-variant`：给 Radix / Base UI 风格的 data 状态提供 Tailwind variant。
3. `@theme inline`：把 CSS 变量映射成 Tailwind token。
4. `:root` / `.dark`：定义主题色、圆角、阴影和滚动条变量。
5. `.markdown` / `.code-block`：聊天消息里的 Markdown 和代码块样式。

## 设计缘由

Markdown 和代码块样式放在全局文件里，而不是塞进 `MarkdownMessage`，是因为这些样式依赖第三方渲染出来的真实 DOM：`p`、`table`、`.katex-display`、`pre code`。用全局 class 控制更稳。

## 关键样式

- `body { overflow: hidden; }`：页面整体不滚动，滚动交给消息区和弹窗内部。
- `.os-theme-webai`：统一 OverlayScrollbars 的细滚动条。
- `.markdown--compact`：用户气泡里的紧凑 Markdown。
- `.markdown--chat`：assistant 长回复的阅读型 Markdown。
- `.code-block`：`CodeBlock` 的外壳、头部和横向滚动区。

## UI 规模

这是全局视觉基底。它不创建组件，但决定了整个应用的现代浅色、低饱和蓝、细边框和轻阴影方向。

## 代码展开

### Tailwind token 和 CSS 变量

`@theme inline` 把 `--background`、`--foreground`、`--primary` 等 CSS 变量暴露给 Tailwind。组件里写 `bg-background`、`text-foreground`，最终都落到这些变量。

这让主题调整集中在 `:root` 和 `.dark`，而不是去每个组件里改颜色。

### 为什么 body 不滚动

`body` 设置了：

```css
height: 100%;
overflow: hidden;
```

聊天产品通常希望侧栏和消息区自己滚动，而不是整个页面滚动。否则输入框固定、消息吸底、移动端高度都会更难处理。

### Markdown 样式分层

`.markdown` 是基础阅读样式。`.markdown--compact` 用于 user 气泡，减少段落 margin 和行高。`.markdown--chat` 用于 assistant 长回复，并处理首尾 margin。

这个分层让同一个 `MarkdownMessage` 可以在不同消息角色中复用，而不是组件内部判断角色。

### 代码块样式

`.code-block`、`.code-block__header`、`.code-block__scroll` 是 `CodeBlock` 的视觉来源。组件只负责结构和复制，高亮区域的圆角、边框、背景、阴影都在这里定义。

### reduced motion

`@media (prefers-reduced-motion: reduce)` 会把动画和 transition 时间压到极低。组件里也有 `useReducedMotion`，两者一起兜底，保证系统减少动画设置生效。
