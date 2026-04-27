# 消息附件扩展

## 当前状态

`Phase 4.4` 已把文件与图片输入接入消息级 metadata。

当前状态应理解为“首轮数据库与 Storage 契约已落地”，不是最终稳定完成。附件上传、编辑、重新生成、分支、历史恢复和未引用对象清理仍需要继续用真实数据回归。

当前采用的结构是：

- `messages.metadata.urls`：继续保存 URL Context
- `messages.metadata.attachments`：保存图片和文件的 Storage 引用
- `storage.buckets.message_attachments`：私有附件 bucket

## Storage 设计

当前 bucket：

- `message_attachments`
- `public = false`
- 单对象上限：`20MB`
- 允许保存：
  - `image/png`
  - `image/jpeg`
  - `image/webp`
  - `application/pdf`
  - `text/plain`
  - `text/markdown`
  - `text/csv`

Office 三件套不直接保存原文件。服务端会先通过 `libreoffice-convert` 封装的 LibreOffice 转换链路临时转成 PDF，再把 PDF 存入 bucket。

如果当前运行环境缺少 LibreOffice，服务端会尝试使用 `pandoc` 作为兜底转换器；如果转换工具不可用，则上传接口返回明确错误，不会保存原始 Office 文件。

部署到真实环境前，需要单独确认运行时是否存在 `soffice` / LibreOffice 可执行能力；仅依赖本地构建通过不能证明 Office 转 PDF 链路可用。

## metadata 语义

每个附件 metadata 至少包含：

- `id`
- `kind`
- `fileName`
- `mimeType`
- `size`
- `storagePath`

如果来自 Office 原文件，还会保留：

- `originalFileName`
- `originalMimeType`

## 清理策略

用户在“修改附加项”窗口移除文件后，服务端会在保存 metadata 后检查该 Storage 对象是否仍被任何消息引用。

如果没有任何消息继续引用该对象，就尝试删除 Storage 对象。

当前清理失败不会阻断消息保存；后续如果真实使用中出现残留，可再补后台清理任务。

## 模型能力

模型注册表中，文件输入能力使用 `supports_files` 表达。

该字段替代旧的 `supports_file_search`，避免把“普通文件输入”误解为 provider 的 File Search / RAG 能力。
