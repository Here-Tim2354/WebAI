# `src/features/chat/components/workspace-notice.tsx`

## 文件定位

`WorkspaceNotice` 是工作区顶部的轻提示。`ChatShell` 维护 `workspaceNotice` 状态，并把它传给这个组件。

## 核心职责

它支持四种类型：

- `loading`
- `success`
- `error`
- `info`

每种类型有自己的边框、背景、图标色和图标。

## 关键函数

- `NoticeIcon({ type })`：根据类型选择 `LoaderCircleIcon`、`CheckCircle2Icon` 或 `AlertCircleIcon`。
- `noticeStyles`：集中保存不同类型的 Tailwind class。

## 设计缘由

一些动作不适合用阻塞弹窗，比如创建分支、模型拉取成功、登录成功后的欢迎。这类反馈用顶部轻提示刚好，不会打断聊天。

## 返回组件规模

固定在页面顶部居中，宽度约 `min(100vw - 1.5rem, 28rem)`。内部使用 `AnimatePresence`，切换提示时有轻微入场和离场动画。

## 代码展开

### aria-live

外层设置了：

```tsx
aria-live="polite"
aria-atomic="true"
```

这让辅助技术可以读到提示变化，但不会像 alert 那样强行打断当前操作。顶部轻提示适合用 polite。

### Notice 样式

`noticeStyles` 把 shell 和 icon 分开。这样 loading/success/info/error 都能共享布局，只换颜色。`NoticeIcon` 里 loading 使用旋转图标，success 和 info 都使用 check，error 使用 alert。

### 生命周期

组件本身不控制展示多久。它只根据 `notice` 渲染。展示时长由 `ChatShell.showWorkspaceNotice` 的 timeout 控制。
