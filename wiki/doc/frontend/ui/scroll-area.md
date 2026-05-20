# `src/components/ui/scroll-area.tsx`

## 文件定位

`ScrollArea` 是 OverlayScrollbars 的 React 封装。消息列表、Markdown 表格、代码块都用它处理滚动。

## 核心职责

- 接收 `axis: vertical | horizontal | both`。
- 根据 [[ui/scroll-options|scroll-options]] 注入 OverlayScrollbars 配置。
- 把 forwarded ref 指向真实 viewport，而不是外层 wrapper。
- 把 OverlayScrollbars 的 scroll event 转成 React 风格回调。

## 关键函数

- `assignForwardedRef(ref, value)`：兼容 callback ref 和 object ref。
- `resolveScrollElement()`：找到真实滚动元素。
- `publishScrollElement()`：把真实 viewport 发布给父组件。
- `handleInitialized(instance)`：OverlayScrollbars 初始化后重新发布 viewport。
- `handleScroll()`：把库事件转给 `onScroll`。

## 设计缘由

React 组件通常希望 ref 指向真实滚动容器。OverlayScrollbars 会包一层结构，如果不转发 viewport，`useMessageScroll` 读到的 scrollTop 就不对。

## 返回组件规模

外观看起来只是一个滚动容器，真实 DOM 由 OverlayScrollbars 接管。

## 代码展开

### forwarded ref 的关键

普通 React ref 会指向 `OverlayScrollbarsComponent` 外层元素，但消息滚动需要真实 viewport。因此 `ScrollArea` 在初始化后调用：

```ts
instance.elements().viewport
```

再把这个元素发布给父组件。`useMessageScroll` 依赖这个 ref 判断 scrollTop 和是否接近底部。

### initialized 事件

`OverlayScrollbarsComponent` 使用 `defer`，初始化可能晚于 React ref。`handleInitialized` 会在库初始化完成时重新 publish viewport，避免父组件一直拿到 wrapper。

### onScroll 事件转换

OverlayScrollbars 的 scroll 事件不是 React SyntheticEvent。`handleScroll` 把它转换成 `UIEvent<HTMLDivElement>` 形状再交给业务层。这里是类型适配，不是重新实现滚动。
