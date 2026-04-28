---
aliases:
  - UI Primitives
  - 前端通用 UI Primitive
---

# UI Primitives 说明

本文档记录当前项目内几个跨聊天组件复用的轻量 UI primitive。

代码入口：
- `src/components/ui/tooltip.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/scroll-options.ts`
- `src/components/ui/textarea.tsx`

关联笔记：
- [[chat-input]]
- [[message-bubble]]
- [[message-list]]
- [[library/overlayscrollbars-footprint]]

## 1. Tooltip

`Tooltip` 是项目内轻量悬停提示。

当前选择：
- 不使用浏览器原生 `title`
- 不使用 Base UI Portal
- 使用 CSS hover / focus-within 展示

这样做的原因是稳定性优先：避免 Portal 或外部库在 React 卸载阶段移动 DOM 节点，触发 `removeChild` 类运行时异常。

当前代价：
- 因为不走 Portal，Tooltip 可能被上层 `overflow-hidden` 容器裁切
- 如果后续实际页面出现裁切，再单独设计安全浮层方案

## 2. ScrollArea

`ScrollArea` 是普通 div 滚动区域的统一包装。

它当前使用 `OverlayScrollbarsComponent`，而不是手动 `initialize(ref.current)`。

这个约束很重要：
- 由官方 React wrapper 管理 OverlayScrollbars 内部 DOM
- 不直接改写 React 正在管理的 children
- 避免 React 卸载时找不到原父节点

当前使用位置包括：
- 消息列表
- 侧栏会话列表
- Markdown 表格横向滚动
- 代码块横向滚动

`ScrollArea` 对外暴露的 ref 应指向 OverlayScrollbars 的实际 viewport，而不是 wrapper root。

原因是消息区滚动策略会通过这个 ref 判断：

- 当前是否接近底部
- 是否应该继续跟随流式输出
- 是否应该显示“最新”按钮

如果 ref 指到 root，流式回答期间就可能误判滚动位置，导致用户上滑阅读时仍被自动拉回底部。

项目同时在 `globals.css` 中定义了原生滚动条默认样式：
- `scrollbar-width: thin`
- `scrollbar-color: var(--scrollbar-thumb) transparent`
- `::-webkit-scrollbar` 兼容层

这层样式用于普通原生滚动区域的视觉 fallback。`ScrollArea` 仍是当前普通内容滚动区的增强层，二者共用相近的颜色变量，避免 fallback 和增强层看起来割裂。

## 3. Textarea

`Textarea` 保留原生 textarea 行为。

当前不把 OverlayScrollbars 直接套到 textarea 上，原因是 textarea 的滚动、选区、输入法和鼠标滚轮都依赖浏览器原生行为。

项目只让 textarea 沿用 `globals.css` 中的原生滚动条默认样式，保持视觉统一但不接管滚动逻辑。

## 4. DropdownMenu

Dropdown 仍由 Base UI Menu 提供 Portal / Positioner / Popup。

当前不在 Dropdown Popup 上接 OverlayScrollbars，因为 Dropdown 本身就是 Portal 弹层，关闭时会快速卸载；再让滚动库改写 Popup DOM，容易和 React / Base UI 的卸载顺序冲突。

## 5. 一句话理解

当前 UI primitive 的默认原则是：普通稳定容器可以用 OverlayScrollbars；输入元素和 Portal 弹层优先保留原生/组件库行为，避免为了视觉统一破坏 DOM 生命周期稳定性。
