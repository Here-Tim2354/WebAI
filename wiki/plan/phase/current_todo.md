# Current Todo

更新时间：2026-05-03 00:25:08

## 项目工作面

- 主线：`Phase 4.4` 文件与图片输入扩展
- 并行：`Phase 3.6` 课程材料、RLS 与数据库说明
- 方向：让聊天主链路保持自然顺手，同时把附件、思考档位、联网和消息操作逐步收口成稳定体验。

## 系统能力

### 数据库主线

- 用户、会话、消息和模型注册表已经形成基础数据骨架：
  - `profiles`
  - `conversations`
  - `messages`
  - `ai_models`
  - `gemini_models`
  - `openai_compatible_models`
- 会话组织能力围绕 `favorites` 与 `conversations.archived_at` 展开。
- 附件能力围绕 `message_attachments` 私有 Storage bucket、消息级 `metadata.attachments` 和用户目录隔离策略展开。
- 会话控制项包含模型、提示词、联网开关与 `thinking_level`。

### 聊天生成

- 消息支持流式输出、中断生成、状态细分、持久化保存与历史恢复。
- 会话能够记住模型、提示词、联网开关和思考档位。
- Gemini URL Context 作为请求级输入进入模型，同时以消息级 metadata 留下上下文线索。
- 用户在长回复中上移阅读时，消息区应暂停自动吸底；圆形向下箭头负责把用户带回底部。

### 消息操作

- user 消息支持覆盖式编辑并重新生成。
- 最新 assistant 消息支持重新生成。
- assistant 消息可以分支到新会话，分支继承模型、提示词、联网开关和消息 metadata。
- 复制、编辑、重新生成和分支都应保持清楚的操作反馈，不让用户猜系统是否接住了动作。

### 文件与图片输入

- 输入区支持上传、粘贴和拖拽图片或文件。
- URL、图片和文件统一进入“修改附加项”窗口，但输入框左下角的加号只表达“添加文件”的语义。
- 模型能力会限制图片 / 文件输入；单条消息最多 5 个附件，总大小最多 20MB。
- 图片单个最多 5MB，普通文件单个最多 10MB。
- Windows / Office 常见空 MIME 场景按扩展名识别。
- Storage object key 使用 `userId/drafts/attachmentId/attachment.ext` 这种安全路径，原始文件名只作为展示信息保存在 metadata 中。
- 图片、PDF 和文本类文件进入 Gemini 输入组装；Excel `.xlsx` 转为 CSV 后进入文件链路；Word / PPT 仍依赖 LibreOffice / soffice 转 PDF。
- 编辑、重新生成与分支继续沿用消息 metadata 上下文。

### 思考档位

- Gemini 3 Flash 的 thinking 能力以会话级 `thinking_level` 保存，取值为 `minimal / low / medium / high`。
- 输入区左下角提供思考档位按钮，菜单原样展示英文档位。
- assistant 的 thought summary 作为独立折叠区展示，不混入最终回答正文。
- thought summary 是否出现取决于模型在该次请求中是否返回 `part.thought`。

### 会话组织

- 会话支持收藏、取消收藏、归档和恢复。
- 头像菜单承接收藏区、归档区和退出登录。
- 侧栏菜单提供会话归档入口。

## 数据库与接口边界

- 数据库对象包括：
  - `20260427083000_phase4_conversation_organization.sql`
  - `20260427091000_remove_conversation_search.sql`
  - `20260428103000_phase4_message_attachments.sql`
  - `20260428113000_phase4_attachment_edit_contract.sql`
  - `20260429110000_phase4_conversation_thinking_level.sql`
- `supports_files` 表达模型是否支持文件输入。
- `message_attachments` bucket 为私有 bucket，Storage select / insert / delete policy 按用户目录隔离。
- `messages_content_valid_check` 允许 user 消息正文为空，只要 metadata 中存在附件。
- `edit_user_message_metadata_and_delete_following` 承担“更新目标消息 + 删除后续消息”的原子编辑语义；编辑链路保留普通 update + delete 作为兜底路径。
- 主要 API：
  - `/api/conversations?status=active`
  - `/api/conversations?status=archived`
  - `/api/conversations?favorite=true`
  - `/api/conversations/[conversationId]/favorite`
  - `PATCH /api/conversations/[conversationId]`
  - `POST /api/attachments/upload`
  - `GET /api/attachments/object?path=...`
  - `PATCH /api/messages/[messageId]`

## 验收关注

- 附件链路需要继续用真实图片、PDF、文本文件、Excel、Word 和 PPT 复测。
- “修改附加项”窗口需要重点观察添加、删除、保存、取消、错误提示和按钮禁用状态。
- 编辑带附件 user 消息时，要关注正文、metadata、后续消息截断、重新生成和失败回滚是否一致。
- assistant 重新生成和分支会话需要稳定继承原 user 消息附件上下文。
- LaTeX 渲染需要覆盖行内 `$...$`、块级 `$$...$$`、中文段落混排和流式输出。
- 长回复流式输出期间，用户 wheel / touch 上移应立即暂停自动吸底；点击向下箭头后再回到底部。
- Word / PPT 转 PDF 依赖部署环境中的 LibreOffice / soffice；Excel 当前走 CSV 转换，不依赖 LibreOffice。
- 私有 Storage 图片预览在移动端下的加载、放大和退出动效仍需观察。
- 未引用附件自动清理失败时，后续可能需要后台补偿任务。
- 浏览器日志中的 Supabase `42703` 需要单独排查，避免它和滚动体验问题混在一起判断。

## 下一步

- `Phase 4.4`：
  - 复测真实附件上传、发送、AI 识别、历史恢复、重新生成和分支。
  - 复测编辑带附件 user 消息的多种组合：只改正文、只改附件、正文和附件都改。
  - 用更复杂的 Gemini 3 Flash 提示观察 `part.thought` 的返回、流式增量、折叠区展开和历史恢复。
  - 继续打磨输入区、附件按钮、图片预览、停止状态和消息区滚动体验。
- `Phase 4.3`：
  - 继续观察多会话数据下收藏、归档、恢复和头像菜单的稳定性。
  - 检查移动端 Sheet 下收藏区、归档区和会话菜单弹层表现。
  - 观察 CSS-only Tooltip 是否在特殊容器里被裁切。
- `Phase 3.6`：
  - 补齐 RLS 验证。
  - 整理数据库说明、migration 与表设计说明。
  - 整理页面功能与数据库操作映射关系。
  - 准备答辩支撑材料。

## 一句话结论

`Phase 4.4` 已进入体验打磨段。接下来最值得一起盯住的是：真实附件链路、LaTeX 流式展示、Word / PPT 转 PDF 工具链、长回复上滑体验，以及 Gemini thought summary 在复杂提示下的稳定表现。
