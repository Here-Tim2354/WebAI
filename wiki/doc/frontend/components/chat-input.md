# `src/features/chat/components/chat-input.tsx`

## 文件定位

`ChatInput` 是底部输入区。它由 `ChatShell` 渲染，状态来源主要来自 [[hooks/use-chat-session]] 和 [[hooks/use-chat-workspace]]。

它本身只保留输入框局部体验状态，例如文本草稿、高度、错误提示和菜单开关。真正的消息缓存、附件草稿、URL 列表由上层 Hook 管。

## 核心职责

- 输入文本并提交。
- 展示和切换联网、URL Context、thinking 档位。
- 上传、粘贴、拖拽文件和图片。
- 展示待发送附件预览。
- 发送中时把主按钮切换为停止生成。

## 状态与函数

局部 `useState`：

- `draftValue`：输入框文本。它没有上提到 `ChatShell`，避免长文本输入导致整个工作区重渲染。
- `isThinkingMenuOpen`：thinking 下拉菜单。
- `optimisticThinkingLevel`：用户点击后立即更新按钮显示，接口回写前也有响应。
- `attachmentError`：客户端预校验或上传失败提示。
- `textareaHeight`：输入框自适应高度目标值。
- `isUrlLimitWarningVisible`：URL 超限时的短暂警告。

关键函数：

- `handleSubmitDraft()`：提交文本、URL 和附件。它会把输入框文本先清空，失败时再还原文本。
- `handleInlineUploadFiles()`：粘贴 / 拖拽 / 文件选择共用同一套预校验。
- `handleAddUrlContext()`：调用上层 `onAddUrlContextUrl`，如果达到上限就展示警告。
- `showUrlLimitWarning()`：控制 1.5 秒 URL 上限提示。

## `useLayoutEffect` 和 `useEffect`

- `useLayoutEffect`：在文本变化后测量 `scrollHeight`，把输入框高度限制在 `224px` 内，再交给 Motion 过渡。
- `useEffect([isSubmitting])`：发送结束后重新聚焦输入框。
- `useEffect([thinkingLevel])`：上层 thinking 档位变化时同步乐观显示值。
- 卸载 effect：清掉 URL 上限提示的 timeout。

## 设计缘由

输入区的文本草稿留在组件内部，这是一个很实用的性能边界。聊天工作区已经有大量状态，如果每敲一个字都上提到 `ChatShell`，消息列表、侧栏相关计算都可能被牵连。

附件校验放在前端只是为了快速反馈，真正可信的校验还在上传接口。这里不承担安全边界。

## 返回组件规模

返回的是底部 `max-w-4xl` 输入框，大致分三层：可展开 URL Context 面板、可自适应高度的 textarea、底部工具栏。整体是一个宽输入容器，不是整屏组件。

## 代码展开

### 输入区有哪些状态来自上层

`ChatInput` 接收的状态可以分成四类：

1. 会话控制项：`webSearchEnabled`、`thinkingLevel`。
2. URL 草稿：`urlContextInputValue`、`urlContextUrls`、`isUrlContextPanelOpen`。
3. 附件草稿：`attachments`、`isUploadingAttachments`。
4. 模型能力：`supportsWebSearch`、`supportsUrlContext`、`supportsImages`、`supportsFiles`、`supportsReasoning`。

也就是说，输入框不自己判断“当前模型能不能传图片”，只根据上层传来的能力决定按钮是否可用。

### canSend 的判断

`canSend` 不只看文本：

```txt
正文非空
或已有附件
或已有 URL
或当前输入框里有一个合法待提交 URL
```

所以用户可以只发附件，也可以只发 URL Context。这里和后端 `sendMessageRequestSchema` 的语义保持一致。

### URL Context 的待提交逻辑

`pendingUrlContextUrl` 来自当前输入框值的标准化结果。如果用户在 URL 输入框里打了一个合法 URL，但还没点添加，按发送时也会把它一起提交。这样用户不必先点“添加 URL”再点发送。

但如果这个待提交 URL 会让总数超过 4 个，就只展示上限警告，不发送。

### 附件上传入口

附件可以从三个入口进入：

- 点击隐藏的 file input。
- 粘贴文件。
- 拖拽文件到 textarea。

三条路径最终都走 `handleInlineUploadFiles(files)`，先调用 `getAttachmentFileValidationError`，再调用上层 `onUploadAttachments`。上传成功后用 `onAttachmentsChange((current) => [...current, ...uploaded])` 合并草稿。

### 文本草稿为什么不上提

`draftValue` 留在 `ChatInput` 内部。发送时才通过 `onSubmit(submittedValue, attachments, submittedUrls)` 上交。

这是为了减少全局重渲染。聊天输入框每次敲字都变化，如果把它放到 `ChatShell` 或 `useChatSession`，侧栏、消息区、顶部栏都有机会被牵连刷新。

### 高度动画

`useLayoutEffect` 会把 textarea 临时设为 `auto`，读取 `scrollHeight`，再恢复之前高度，并把目标高度写到 `textareaHeight`。真正视觉变化由 `MotionTextarea` 的 `animate={{ height }}` 完成。

最大高度是 `224px`。超过后 textarea 自己滚动，而不是继续撑大底部输入区。

### 停止生成按钮

底部主按钮根据 `isSubmitting` 在“发送”和“停止”之间切换。点击时：

- 如果正在提交，调用 `onStop()`。
- 否则调用 `handleSubmitDraft()`。

这让停止生成成为输入区的主操作，而不是额外塞一个按钮。
