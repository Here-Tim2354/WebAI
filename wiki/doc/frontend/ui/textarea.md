# `src/components/ui/textarea.tsx`

## 文件定位

`Textarea` 是多行输入 primitive。聊天输入框、提示词编辑、消息编辑都会使用它。

## 核心职责

它提供默认边框、focus ring、disabled、invalid 和 `field-sizing-content` 行为。

## 设计缘由

多行输入既出现在底部聊天框，也出现在弹窗和气泡编辑态。统一 primitive 后，业务层可以只关心高度、resize 和具体排版。

## 返回组件规模

默认最小高度 `min-h-16`，但 `ChatInput` 会用 Motion 和 `field-sizing: fixed` 接管高度动画。

## 代码展开

### field-sizing-content

默认 class 带 `field-sizing-content`，让 textarea 能随内容调整高度。但 `ChatInput` 会覆盖为 `[field-sizing:fixed]`，因为它自己用 `useLayoutEffect + Motion` 控制高度动画。

所以这个 primitive 是宽松默认，具体业务可以接管。

### ref 和原生滚动

`Textarea` 保留原生 textarea，不接 OverlayScrollbars。输入法、选区、滚动、粘贴、拖拽都属于高敏感行为，保持原生控件更稳。
