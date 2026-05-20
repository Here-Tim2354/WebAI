# `src/features/chat/components/chat-header.tsx`

## 文件定位

`ChatHeader` 是工作区右侧顶部栏。它由 `ChatShell` 调用，展示模型选择、收藏按钮和会话级提示词入口。

## 核心职责

这个组件只做可见控制，不保存业务状态。所有动作都通过 props 回传：

- `onSelectModel(model.id)`：切换当前会话或草稿模型。
- `onToggleFavoriteConversation()`：收藏或取消收藏当前会话。
- `onOpenPromptDialog()`：打开 `ChatShell` 里的提示词弹窗。
- `onOpenMobileSidebar()`：移动端打开侧栏。

## 关键渲染

模型下拉菜单来自 `availableModels`。每个模型会展示：

- `ModelIcon`
- `model.label`
- 能力摘要：推理、图像、文件、联网、工具
- 当前选中项的 `CheckIcon`

收藏按钮根据 `activeConversation?.isFavorite` 改变颜色。提示词按钮根据 `currentSystemPrompt?.trim()` 判断是否高亮。

## 设计缘由

顶部栏只放当前会话最常用的控制：模型、收藏、提示词。更重的配置，例如 Gemini Key、模型启停、账户设置，放在侧栏头像菜单里，避免聊天区域过载。

## 返回组件规模

顶部栏宽度跟消息区一致，内部是 `max-w-4xl` 的三列网格：左侧移动端侧栏按钮，中间模型选择，右侧收藏和提示词两个图标按钮。

## 代码展开

### 模型菜单

模型按钮本身宽度是 `min(62vw, 15rem)`，这样移动端不会撑满顶部。菜单内容宽度是 `min(calc(100vw - 2rem), 22rem)`。

每个模型项会从能力字段拼出摘要：

- `reasoning` -> 推理
- `image` -> 图像
- `files` -> 文件
- `webSearch` -> 联网
- `functionCalling` -> 工具

这不是模型能力的最终来源，只是把 schema 里的能力字段转成用户能扫读的中文。

### 交互锁

`isInteractionLocked` 会禁用模型选择、收藏、提示词按钮。这个值来自当前会话是否正在提交。这样流式生成期间不会切模型或改提示词，避免用户以为设置会影响正在生成的回复。

### 按钮高亮

收藏按钮根据 `activeConversation?.isFavorite` 使用 amber 色，并给 `StarIcon` 填充 currentColor。提示词按钮根据 `currentSystemPrompt?.trim()` 使用 sky 色。也就是说按钮颜色表达的是“当前会话是否已经有这个配置”，不是 hover 装饰。
