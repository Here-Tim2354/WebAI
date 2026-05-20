# `src/components/ui/sheet.tsx`

## 文件定位

`Sheet` 是侧滑抽屉 primitive，也基于 `@base-ui/react/dialog`。当前主要用于移动端侧栏。

## 导出内容

- `Sheet`
- `SheetTrigger`
- `SheetClose`
- `SheetContent`
- `SheetHeader`
- `SheetFooter`
- `SheetTitle`
- `SheetDescription`

## 关键设计

`SheetContent` 支持 `side: top | right | bottom | left`。不同方向使用不同 inset、边框和进入/退出位移。

## 设计缘由

移动端不能直接保留桌面侧栏宽度，所以用 Sheet 承载同一份 `sidebarContent`。这样侧栏内容只维护一套，桌面和移动端只是容器不同。

## 返回组件规模

默认右侧或左侧 3/4 屏宽，`sm` 后有最大宽度限制。WebAI 当前使用左侧移动端侧栏。

## 代码展开

### Sheet 复用 Dialog

`Sheet` 本质上还是 Base UI Dialog，只是 popup 的位置和动画不同。这样移动端侧栏也能获得 dialog 的焦点管理和关闭行为。

### side 控制布局

`SheetContent` 根据 `data-side` 应用不同 class：left/right 是竖向全高，top/bottom 是横向全宽。关闭时也按方向做位移动画。

### 当前使用场景

当前主要用在 `ConversationSidebar` 的移动端。桌面端不用 Sheet，而是固定 aside；移动端把同一份 `sidebarContent` 放进 Sheet。
