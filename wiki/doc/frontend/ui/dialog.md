# `src/components/ui/dialog.tsx`

## 文件定位

`Dialog` 是居中弹窗 primitive，基于 `@base-ui/react/dialog`。提示词、账户、Gemini 设置、删除确认等弹窗都用它。

## 导出内容

- `Dialog`
- `DialogTrigger`
- `DialogPortal`
- `DialogClose`
- `DialogOverlay`
- `DialogContent`
- `DialogHeader`
- `DialogFooter`
- `DialogTitle`
- `DialogDescription`

## 关键设计

`DialogContent` 默认会渲染 overlay 和关闭按钮。业务层可以通过 `showCloseButton={false}` 关闭默认按钮，也可以用 `className` 重写尺寸、圆角、阴影。

## 设计缘由

Base UI 提供可访问性和交互状态，项目自己控制视觉。这样弹窗既有焦点管理，又能保持 WebAI 的浅色、轻边框风格。

## 返回组件规模

默认是居中的小弹窗，业务组件常改成 `40rem`、`42rem`、`52rem` 等较宽面板。

## 代码展开

### Popup 与 Overlay

`DialogContent` 内部固定渲染 `DialogOverlay`，再渲染 `DialogPrimitive.Popup`。业务层只写：

```tsx
<Dialog open={...} onOpenChange={...}>
  <DialogContent>...</DialogContent>
</Dialog>
```

就能得到背景遮罩、居中定位、开合动画和关闭按钮。

### showCloseButton

`showCloseButton` 默认 true。关闭按钮使用项目自己的 `Button variant="ghost" size="icon-sm"`。如果业务弹窗底部已经有明确按钮，也可以关闭这个默认按钮。

### className 覆盖

项目里的弹窗经常完全重写 `DialogContent` 的宽度、圆角、padding 和 shadow。primitive 不阻止覆盖，只提供可访问结构和默认行为。
