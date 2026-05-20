# `src/components/ui/button.tsx`

## 文件定位

`Button` 是项目通用按钮 primitive，基于 `@base-ui/react/button` 和 `class-variance-authority`。

## 核心职责

通过 `buttonVariants` 统一按钮外观：

- `variant`：`default`、`outline`、`secondary`、`ghost`、`destructive`、`link`。
- `size`：普通尺寸、`xs/sm/lg`、以及 `icon` 系列。

## 设计缘由

聊天界面有大量图标按钮和小尺寸操作按钮。集中用 `cva` 管 variant 和 size，可以避免每个组件手写一套 focus、disabled、svg 尺寸和 active 状态。

## 返回组件规模

一个 inline-flex 按钮。具体尺寸由 `size` 控制，例如 `icon-sm` 常用于消息操作和顶部栏。

## 代码展开

### cva 的作用

`buttonVariants` 把基础 class、variant class 和 size class 组合起来。业务组件传 `variant="outline" size="icon-sm"`，最终会合成一串 Tailwind class。

基础 class 里已经包含：focus ring、active 下压、disabled、invalid、svg 默认尺寸等。所以业务层不需要每次都重写这些交互状态。

### Base UI render

`ButtonPrimitive` 来自 Base UI，它提供更可靠的按钮行为。项目自己的 `Button` 只是给它套上视觉系统。

### 图标按钮

`icon-sm` 在这个项目里很常用，尤其是消息操作、顶部栏、输入区工具按钮。它默认是 `size-7`，业务层经常再通过 `className` 改成 `h-9 w-10` 或 `h-7 w-9`。
