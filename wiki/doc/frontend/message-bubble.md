---
aliases:
  - MessageBubble
  - 单条消息气泡
---

# MessageBubble 说明

这篇笔记帮助我们理解 `MessageBubble` 如何决定单条消息的视觉语义，以及它和 `MarkdownMessage` 的关系。

代码入口：
- `src/features/chat/components/message-bubble.tsx`

关联笔记：
- [[message-list]]
- [[markdown-message]]
- [[code-block]]
- [[ui-primitives]]

## 1. 组件职责

`MessageBubble` 只处理单条消息。

它主要负责：

- 识别消息角色
- 识别消息状态
- 选择对应的标签、图标和气泡样式
- 把正文继续交给 `MarkdownMessage`
- 管理消息复制、编辑、分支、重新生成等消息侧操作入口
- 展示和编辑 user 消息附带的 URL Context metadata
- 展示和编辑 user 消息附带的图片、文件 metadata
- 展示 assistant 消息附带的思考摘要 metadata

---

## 2. 当前角色语义

当前支持的角色包括：

- `assistant`
- `user`
- `system`
- `error`

其中：

- `assistant` / `system` 走 assistant-like 视觉
- `user` 走右侧蓝色气泡
- `error` 走红色错误气泡

---

## 3. 状态语义

当前会识别这些消息状态：

- `pending`
- `streaming`
- `complete`
- `cancelled`
- `error`

它们会影响：

- 顶部状态标签
- assistant 占位态文案
- 是否进入流式 reveal 渲染
- 是否存在可折叠的思考摘要

---

## 4. 流式 reveal 在哪里发生

assistant 流式回复时，并不是 `MessageList` 在逐字渲染。

这里，`MessageBubble` 内部通过 `StreamingMarkdownMessage` 负责：

- 把增量文本拆成 reveal 单元
- 根据 backlog 控制节奏
- 在 `reduced motion` 场景下直接降级
- 展示闪烁光标

所以“assistant 正在一点点出现”这件事，是单条消息级能力，不是列表级能力。

---

## 5. 与 MarkdownMessage 的关系

`MessageBubble` 本身不直接解析 Markdown。

正文渲染流程是：

- 普通消息 -> `MarkdownMessage`
- assistant 流式消息 -> `StreamingMarkdownMessage -> MarkdownMessage`

当前 user 消息还会额外传入：

- `markdown--compact`

用于把 user 单行消息的正文约束和 assistant 长文排版分开。

---

## 6. 消息侧操作

当前消息气泡支持这些操作：

- 复制：assistant 和 user 都可复制，失败时走隐藏 textarea 的降级复制通道
- 编辑：仅 user 消息可编辑，保存后会触发后续 assistant 重新生成
- 分支：assistant 消息可创建新会话分支
- 重新生成：仅最新 assistant 消息可重新生成，非最新 assistant 只展示禁用提示

这些操作都通过轻量图标按钮呈现，并使用项目内 `Tooltip` 代替浏览器原生 `title`。

---

## 7. 消息 metadata

user 消息如果带有 `metadata.urls`，会在正文下方展示一行轻量 URL Context 摘要。

user 消息如果带有 `metadata.attachments`，会在正文下方展示附件摘要：

- 图片显示小缩略图
- 点击图片后通过页面级遮罩进入放大预览
- 文件显示文件名与大小

进入编辑态后，用户可以打开“修改附加项”窗口，在同一个窗口里管理 URL、图片和文件，并与正文共用保存按钮。

保存时的语义是：

- 正文变化：更新正文并重新生成后续 assistant
- URL 变化：更新 `metadata.urls` 并重新生成后续 assistant
- 附件变化：更新 `metadata.attachments` 并重新生成后续 assistant
- 正文、URL 和附件都未变化：仍然提交编辑并重新生成后续 assistant

继续观察：附件编辑仍属于 `Phase 4.4` 首轮接入能力，需要继续用真实图片、PDF、文本文件验证保存、重新生成、分支和历史恢复。这里尤其要关注带附件 user 消息编辑失败时的错误提示，以及前端本地状态是否和数据库最终 metadata 保持一致。

assistant 消息如果带有 `metadata.thinking`，会在正文上方展示一个默认折叠的思考摘要区：

- 折叠态会根据状态显示“思考中 / 已思考 / 已停止 / 思考失败”和档位
- 展开后以更灰、更轻的字体显示 thought summary
- 流式生成时 summary 可以随服务端 metadata 增量更新
- 生成停止时，思考摘要与消息状态一起进入停止语义，不继续显示“思考中”

这里展示的是 Gemini 返回的 thought summary，不是模型内部完整思维链。UI 与数据通路只负责承接这类摘要；真实可见内容还取决于上游模型是否在该次请求中返回 `part.thought`。

---

## 8. 一句话理解

`MessageBubble` 是消息区里真正负责“单条消息长什么样、能做什么”的组件：角色、状态、流式 reveal、思考摘要、正文入口、消息操作和消息级 metadata 都在这里汇合。
