# `src/components/ui/tooltip.tsx`

## 文件定位

`Tooltip` 是项目内轻量提示组件。大量图标按钮都用它说明含义。

## 核心职责

它接收：

- `content`
- `children`
- `side`
- `align`
- `disabled`
- `delay`
- `closeDelay`

通过 `group-hover` 和 `group-focus-within` 显示提示。

## 设计缘由

这个 Tooltip 没有 Portal，也不做复杂碰撞检测。好处是简单稳定，不会引入额外浮层生命周期问题；代价是如果父容器 overflow 裁切，可能需要换成更强的浮层方案。

## 返回组件规模

包一层 `inline-flex`，提示层最大宽度 `18rem`，适合短说明，不适合长文案。

## 代码展开

### 为什么是 CSS-only

`Tooltip` 没有引入 Portal 或浮层定位库。它只是包一层 `span.group/tooltip`，再用 hover / focus-within 控制内部提示的 opacity 和 scale。

这降低了 DOM 生命周期复杂度，也避免 Portal 关闭时和外部库产生卸载冲突。缺点是它会受父级 overflow 影响。

### side 和 align

`sideClassName` 控制提示出现在上下左右哪边。`verticalAlignClassName` 和 `horizontalAlignClassName` 分别处理上下方向与左右方向的对齐。

比如 `side="bottom" align="center"` 时，会使用 `top-full mt-2` 和 `left-1/2 -translate-x-1/2`。

### delay

默认 `delay=360ms`，避免鼠标扫过一排图标时提示疯狂闪烁。`closeDelay` 只影响 transition duration 的下限，不做复杂计时器。
