# `src/features/chat/components/message-attachments.tsx`

## 文件定位

这个文件包含附件展示和附件编辑弹窗。它被 `ChatInput` 和 `MessageBubble` 同时使用。

## 导出组件

- `AttachmentPreviewList`：展示图片缩略图和文件条。
- `AttachmentEditorDialog`：编辑 URL + 文件/图片附加项的弹窗。

## `AttachmentPreviewList`

状态只有一个：`previewAttachment`。当用户点击图片缩略图时，它会打开 `ImagePreviewPortal`。

`ImagePreviewPortal` 使用 `createPortal(document.body)`，这是关键设计：图片预览不能放在消息气泡内部，否则很容易被滚动容器、输入区或弹窗的 `overflow` 裁切。

## `AttachmentEditorDialog`

局部状态：

- `urlValue`：弹窗里的 URL 输入。
- `urlError`：URL 格式、重复或数量上限错误。
- `attachmentError`：文件预校验或上传失败错误。

关键函数：

- `addUrl()`：标准化 URL，校验数量上限，再回调 `onUrlsChange`。
- `uploadFiles()`：调用 `getAttachmentFileValidationError`，通过后交给上层 `onUploadFiles` 真正上传。

## 设计缘由

附件编辑弹窗只管 UI 校验和本地列表合并，不直接碰 Storage。上传动作由 `useChatSession.uploadAttachments` 通过 `/api/attachments/upload` 完成。

## 返回组件规模

`AttachmentPreviewList` 是消息或输入区里的小型预览列表。`AttachmentEditorDialog` 是宽度约 `42rem` 的弹窗，里面分 URL 区和文件图片区。

## 代码展开

### 图片预览为什么用 Portal

`ImagePreviewPortal` 直接挂到 `document.body`。这样放大图不会受消息列表、输入框或弹窗内部的 `overflow: hidden` 影响。它还监听 Escape 关闭，点击暗色背景也会关闭。

这里使用 `useReducedMotion`，如果用户系统设置减少动画，就禁用缩放、模糊、位移这些过渡。

### 附件缩略图和文件条

`AttachmentPreviewList` 根据 `attachment.kind` 分两种展示：

- `image`：固定 `size-18` 缩略图，点击放大。
- 其他文件：`FileTextIcon` + 文件名 + 大小。

如果附件来自 `.xlsx` 转换，会通过 `originalMimeType === XLSX_MIME_TYPE` 显示“XLSX 已自动转为 CSV”。这能解释为什么用户上传 Excel 后，模型侧实际拿到的是 CSV。

### 编辑弹窗的状态边界

`AttachmentEditorDialog` 不是“保存消息”的弹窗。它只修改当前编辑草稿：

- URL 通过 `onUrlsChange([...urls, normalizedUrl])` 回传。
- 附件通过 `onAttachmentsChange((current) => [...current, ...uploaded])` 回传。

真正保存 user 消息是在 `MessageBubble.handleSaveEdit`。所以用户可以在这个弹窗里多次添加/移除，最后回到气泡编辑区统一保存。

### 文件上传校验

上传前调用 `getAttachmentFileValidationError`，输入包括：当前附件数量、当前附件大小、模型是否支持图片/文件。它会挡住不支持类型、超数量、单文件超大小、总大小超限制。

上传动作本身由上层 `onUploadFiles` 完成。这个组件不碰 API route，也不碰 Storage path。

### UI 规模

附件预览是小组件，通常嵌在输入框或 user 气泡下方。编辑弹窗宽度约 `42rem`，内部有 URL 区和文件图片区，文件图片区支持拖拽。
