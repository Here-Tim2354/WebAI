# `src/features/chat/lib/attachment-client.ts`

## 文件定位

`attachment-client.ts` 是附件选择阶段的客户端预校验工具。它被 `ChatInput` 和 `AttachmentEditorDialog` 使用。

## 核心函数

- `getAttachmentAcceptMimeTypes({ supportsFiles, supportsImages })`：根据当前模型能力生成 `<input type="file" accept>`。
- `getAttachmentFileValidationError(files, options)`：检查类型、数量、单文件大小和总大小。
- `isSupportedByCurrentModel(file, options)`：内部函数，同时按 MIME 和扩展名判断。
- `getFileSizeLimit(file)`：图片和普通文件使用不同大小限制。

## 设计缘由

Windows / Office 场景经常给空 MIME 或泛 MIME，所以这里不能只看 `file.type`。代码同时按文件扩展名兜底，这一点很实际。

这只是前端预校验，不是安全边界。真正可信的校验仍在上传接口和共享配置里。

## 返回规模

没有 UI。返回的错误文本直接给输入区或弹窗展示。

## 代码展开

### accept 和校验不是一回事

`getAttachmentAcceptMimeTypes` 生成的是浏览器文件选择器提示。它能减少用户选错文件，但不能当安全边界，因为用户仍然可以拖拽、粘贴，甚至伪造请求。

所以 `getAttachmentFileValidationError` 会在前端再做一次真实检查，服务端上传接口也会再校验一次。

### MIME 和扩展名双判断

`isSupportedByCurrentModel` 先看 MIME，再看扩展名。原因是 Windows 上 `.md`、`.csv`、Office 文件经常给空 MIME 或通用 MIME。如果只看 `file.type`，用户会遇到明明支持的文件无法上传。

### 大小限制

图片用 `MAX_IMAGE_ATTACHMENT_SIZE`，普通文件用 `MAX_FILE_ATTACHMENT_SIZE`。总大小还要受 `MAX_MESSAGE_ATTACHMENTS_SIZE` 限制。

所以一次上传可能因为三种原因失败：类型不支持、单文件过大、总大小过大。错误文案会直接返回给输入区或弹窗。
