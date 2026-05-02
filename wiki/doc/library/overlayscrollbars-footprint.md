---
aliases:
  - OverlayScrollbars footprint
  - OverlayScrollbars 库痕迹
---

# OverlayScrollbars 库痕迹

这篇笔记整理 `OverlayScrollbars` 在当前项目中的实际落点和边界。

相关依赖：
- `overlayscrollbars`
- `overlayscrollbars-react`

关联笔记：
- [[library/library-footprints]]
- [[frontend/ui-primitives]]
- [[message-list]]
- [[conversation-sidebar]]
- [[chat-input]]

## 1. 当前落点

代码入口：
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/scroll-options.ts`
- `src/app/globals.css`

当前主要使用 `ScrollArea` 包装普通 div 滚动区域：
- 消息列表
- 侧栏会话列表
- Markdown 表格横向滚动
- 代码块横向滚动

其中消息列表依赖 `ScrollArea` 暴露的实际 viewport 计算滚动位置。这个 ref 不能停留在 wrapper root，否则 `useMessageScroll` 会误判用户是否仍在底部，流式输出时可能把正在上滑阅读的用户强行拉回最新消息。

`globals.css` 中负责：
- 引入 `overlayscrollbars/overlayscrollbars.css`
- 定义项目级原生滚动条默认样式，作为不接滚动库区域的视觉 fallback
- 定义 `os-theme-webai`
- 让 `os-theme-webai` 复用同一组滚动条颜色变量，保持原生 fallback 与增强层视觉接近

## 2. 当前明确不覆盖的区域

### Textarea

textarea 不直接接 OverlayScrollbars。

原因：
- 直接接管 textarea 后，原生滚动条和鼠标滚轮曾失效
- textarea 的输入法、选区、滚动行为属于浏览器原生高敏感区域
- 当前更稳的做法是保留原生滚动，并沿用全局原生滚动条默认样式

### Dropdown Portal

Dropdown Popup 不接 OverlayScrollbars。

原因：
- Dropdown 使用 Base UI Portal 和 Positioner
- Popup 关闭时会被组件库快速卸载
- OverlayScrollbars 会改写目标节点内部结构
- 两者叠加容易触发 React 卸载阶段的 `removeChild` 异常

## 3. 运行方式约束

`ScrollArea` 必须使用官方 React wrapper：

```tsx
<OverlayScrollbarsComponent defer />
```

不要再把 `useOverlayScrollbars` 手动初始化到包含 React children 的节点上。

同时，`ScrollArea` 对外发布 ref 时，应优先返回：

```tsx
scrollRef.current?.osInstance()?.elements().viewport
```

如果实例还未 ready，再 fallback 到 wrapper element。

原因是手动初始化会让外部库改写 React 已经接管的 DOM 子树，后续 React 删除子节点时可能找不到原父节点。

还有一个容易踩的点：`OverlayScrollbarsComponent` 开启 `defer` 后，首次 React ref 赋值可能早于 OverlayScrollbars 初始化完成。

因此当前 `ScrollArea` 会监听 `initialized` 事件，并在事件触发时重新把 forwarded ref 指到真实 viewport。消息列表的滚动 hook 也会通过 `data-overlayscrollbars-viewport` 做兜底查找，避免流式输出时因为读到 wrapper root 而误判滚动位置。

## 4. 后续维护建议

- 普通 div 滚动容器：优先使用 `ScrollArea`
- textarea：继续保留原生滚动
- Portal 弹层：默认不要接 OverlayScrollbars，除非专门验证卸载顺序
- 如果要新增滚动选项，先放到 `scroll-options.ts`，不要在调用点散写配置

## 5. 一句话理解

`OverlayScrollbars` 当前用于普通内容滚动区的视觉统一，不用于接管输入元素或 Portal 弹层；这是为了在视觉一致和 React DOM 生命周期稳定之间取一个更稳的边界。
