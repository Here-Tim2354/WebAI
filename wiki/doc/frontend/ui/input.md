# `src/components/ui/input.tsx`

## 文件定位

`Input` 是单行输入框 primitive，基于 `@base-ui/react/input`。

## 核心职责

它封装了统一的边框、focus ring、disabled、文件输入和 invalid 状态样式。

## 设计缘由

登录、URL 输入、Gemini 设置、账户资料都使用单行输入。统一 primitive 能保证这些表单看起来像同一个产品，而不是每个弹窗一套样式。

## 返回组件规模

默认高度 `h-8`，业务组件经常通过 `className` 改到 `h-11` 或其他尺寸。

## 代码展开

### forwardRef

`Input` 用 `React.forwardRef` 把 ref 传给真实 input。登录页需要拿 ref 自动 focus/select，普通表单也可能需要直接操作输入框。

### file 样式

基础 class 包含 `file:*` 样式。虽然大多数文件上传入口用 label + hidden input，但这个 primitive 仍保留文件 input 的基础显示能力。

### 业务覆盖

组件默认高度是 `h-8`，但登录页、账户弹窗、Gemini 设置都会通过 `className` 改成 `h-11`。这说明 primitive 提供默认手感，业务组件决定具体密度。
