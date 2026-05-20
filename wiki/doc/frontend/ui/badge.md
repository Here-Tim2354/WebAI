# `src/components/ui/badge.tsx`

## 文件定位

`Badge` 是小状态标签。消息状态、模型支持状态等地方会用到类似视觉。

## 核心职责

基于 `cva` 定义 `default`、`secondary`、`destructive`、`outline`、`ghost`、`link` 六种 variant。

## 设计缘由

Badge 很容易在不同组件里被做成不同圆角和字号。这里统一成小尺寸、可聚焦、可作为 `span` 或自定义 render 的标签。

## 返回组件规模

高度约 `1.25rem` 的小标签，用于短状态，不适合承载长句子。

## 代码展开

### useRender

`Badge` 没有直接返回 `<span>`，而是使用 Base UI 的 `useRender`。这让调用方可以通过 `render` 换底层元素，同时保留 class 和状态。

### 样式边界

Badge 默认高度很小，`h-5`。它适合“生成中”“失败”“支持”这类短标签。如果要展示长状态说明，应该用 `Alert` 或普通文本，不要塞进 Badge。
