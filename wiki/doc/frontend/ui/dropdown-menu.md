# `src/components/ui/dropdown-menu.tsx`

## 文件定位

`dropdown-menu.tsx` 是下拉菜单 primitive，基于 `@base-ui/react/menu`。顶部模型选择、thinking 档位、头像菜单都依赖它。

## 导出内容

包含 root、trigger、content、group、label、item、checkbox、radio、separator、shortcut、submenu 等一整套菜单组件。

## 关键设计

`DropdownMenuContent` 使用 `Portal + Positioner + Popup`，支持 `align`、`side`、`sideOffset`。菜单内容有统一最大高度、滚动、阴影和开合动画。

Radio 和 checkbox item 右侧用 `CheckIcon` 作为状态标记。

## 设计缘由

菜单在这个项目里不只是简单下拉，还承担模型选择、用户菜单、thinking 档位等交互。用 Base UI 处理键盘导航和定位，比手写浮层稳。

## 返回组件规模

默认菜单宽度跟 anchor 或业务指定宽度走。顶部模型菜单会扩展到 `22rem` 左右。

## 代码展开

### Positioner

`DropdownMenuContent` 不是简单 absolute div。它通过 `MenuPrimitive.Positioner` 计算锚点位置，并把 `side`、`align`、`sideOffset` 传进去。

这让顶部模型菜单、thinking 菜单、头像菜单都能按触发按钮定位，而不是手写 left/top。

### data 状态

菜单项使用 `data-slot`、`data-inset`、`data-variant`。全局 CSS 和 Tailwind variant 可以通过这些属性控制 focus、disabled、destructive 等状态。

### RadioItem

thinking 档位使用 `DropdownMenuRadioGroup` 和 `DropdownMenuRadioItem`。右侧的 `CheckIcon` 由 `MenuPrimitive.RadioItemIndicator` 控制，选中状态不需要业务组件自己判断再插图标。
