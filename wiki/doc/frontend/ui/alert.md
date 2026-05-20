# `src/components/ui/alert.tsx`

## 文件定位

`Alert` 是工作区顶部错误、API Key 提示、登录反馈等块状提示的基础组件。

## 核心职责

导出：

- `Alert`
- `AlertTitle`
- `AlertDescription`
- `AlertAction`

`alertVariants` 目前只有 `default` 和 `destructive` 两种。

## 设计缘由

错误提示和状态提示需要一致的图标布局、标题、描述和可选操作区。这里用 `data-slot` 做结构标记，方便 Tailwind 选择器控制子元素。

## 返回组件规模

一个全宽提示块，常出现在页面顶部或登录卡片内部。

## 代码展开

### data-slot 的意义

`Alert`、`AlertTitle`、`AlertDescription` 都带 `data-slot`。基础样式里会用 `has-data-[slot=alert-action]`、`group-has-[>svg]/alert` 这类选择器调整布局。

这意味着 Alert 可以有图标、标题、描述、右上角 action，布局仍然能自动适配。

### role

`Alert` 默认 `role="alert"`。不过业务层如果只是普通状态，也可以覆盖成 `role="status"`，例如 API Key 提示。这一点看具体场景：错误用 alert，普通提醒用 status 更温和。
