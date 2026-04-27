# Current Todo

更新时间：2026-04-28 02:07:42

## 当前阶段

- 当前主线：`Phase 4.4` 文件与图片输入扩展
- 已完成阶段：
  - `Phase 1`、`Phase 2`
  - `Phase 3.1` 至 `Phase 3.5`
  - `Phase 4.1` 生成体验与会话控制基础升级
  - `Phase 4.2` 消息侧增强与会话分支能力
  - `Phase 4.3` 会话管理增强与组织能力扩展第一轮
- 并行补做：`Phase 3.6` 课程材料、RLS 与数据库说明验收

## 当前完成状态

- 数据库主线已稳定：
  - `profiles`
  - `conversations`
  - `messages`
  - `ai_models`
  - `gemini_models`
  - `openai_compatible_models`
- 聊天主链路已完成：
  - 流式输出
  - 中断生成
  - 消息状态细分
  - 消息持久化与历史恢复
  - 会话级模型、提示词、联网开关
  - Gemini URL Context 请求级输入与消息级 metadata 保存
- 消息侧能力已完成：
  - 复制
  - user 消息编辑并重新生成
  - assistant 最新消息重新生成
  - assistant 消息分支到新会话
  - 分支继承模型、提示词、联网开关与消息 metadata
- 文件与图片输入已完成第一轮，但本阶段仍需要大量调整：
  - `messages.metadata.attachments` 已接入
  - `message_attachments` 私有 Storage bucket 已落到远端
  - 输入区支持上传、粘贴、拖拽附加项
  - URL、图片、文件统一进入“修改附加项”窗口
  - 图片缩略图展示与点击放大已接入
  - 图片放大预览已改为页面级 Portal，不再被输入区容器裁切
  - 草稿区图片缩略图支持快捷移除
  - 附加项弹窗的“添加”入口已改为原生 file input 透明覆盖按钮区域，避免程序化 click 被弹窗/浏览器吞掉
  - 文件选择后已先拷贝为普通 `File[]` 再清空 input，避免 live `FileList` 被清空导致上传静默跳过
  - 附件上传会按当前模型能力过滤图片 / 文件，并提前校验单条消息最多 5 个、总大小 20MB
  - Windows / Office 常见空 MIME 场景已按扩展名兜底识别
  - 批量附件上传如果中途失败，会清理本批次已写入 Storage 但未返回前端的对象
  - 粘贴 / 拖拽上传失败会在输入区显示错误，不再静默失败
  - 图片 / PDF / 文本文件已接入 Gemini 输入组装
  - 普通发送、编辑与重新生成均已确认会把附件 metadata 传给服务端
  - Gemini 请求组装已改为从私有 Storage 下载附件，并以 `inlineData` 传入图片 / PDF
  - 编辑带附件消息时，正文、metadata 与删除后续消息已合并为数据库 RPC 原子操作
  - user 消息已支持“正文为空但保留附件”的数据库约束
  - Office 三件套按“`libreoffice-convert` 转 PDF 后保存 PDF”处理
  - 重新生成与分支继续沿用消息 metadata 上下文
  - 当前只应视为“首轮接入完成”，不是稳定收口；真实文件选择、上传反馈、编辑保存、历史恢复、移动端预览和部署环境转换链路仍需要继续打磨
- 会话管理增强已完成第一轮：
  - 收藏 / 取消收藏
  - 头像菜单中的收藏区
  - 收藏会话点击跳转
  - 归档 / 恢复
  - 头像菜单中的归档区
  - 会话列表二级菜单归档入口
  - 头像菜单承接收藏、归档区与退出登录
## 数据库与迁移

- 已推送远端 Supabase：
  - `20260427083000_phase4_conversation_organization.sql`
  - `20260427091000_remove_conversation_search.sql`
  - `20260428103000_phase4_message_attachments.sql`
  - `20260428113000_phase4_attachment_edit_contract.sql`
- 当前确认：
  - `favorites` 已落到远端
  - `conversations.archived_at` 已落到远端
  - `supports_file_search` 已重命名为 `supports_files`
  - `message_attachments` bucket 为私有 bucket
  - 附件 Storage select / insert / delete policy 已按用户目录隔离
  - `messages_content_valid_check` 已允许 user 消息正文为空但 metadata 中存在附件
  - `edit_user_message_metadata_and_delete_following` 已落到远端
- 当前查询与 API：
  - `/api/conversations?status=active`
  - `/api/conversations?status=archived`
  - `/api/conversations?favorite=true`
  - `/api/conversations/[conversationId]/favorite`
  - `PATCH /api/conversations/[conversationId]` 支持 `status`
  - `POST /api/attachments/upload`
  - `GET /api/attachments/object?path=...`

## 验证结果

- `npm run typecheck` 通过
- `npm run lint` 通过
  - 剩余 `src/components/chat/model-icon.tsx` 与 `src/components/chat/message-attachments.tsx` 的 `<img>` warning
- `npm run build` 通过
  - 沙箱内可能触发已知 `spawn EPERM`
  - 越权运行可通过
- browser-use 已验收：
  - 页面可正常加载
  - 输入区可见“修改附加项”入口
  - 附加项弹窗可见原生 file input 覆盖的“添加文件和图片”入口
  - 页面级图片预览与草稿缩略图快捷移除入口已接入
  - 发送入口可见
  - 浏览器控制台无 error/warning

## 当前待办

- `Phase 4.4` 大量调整与端到端验收：
  - 用真实图片、PDF、文本文件反复验证“选择文件 -> 上传 -> UI 反馈 -> 发送 -> AI 识别 -> 历史恢复”完整链路
  - 重点复测“修改附加项”窗口中的添加、删除、保存、取消、错误提示和按钮禁用状态
  - 重点复测编辑带附件 user 消息后的 metadata 保存、后续消息截断、重新生成和失败回滚表现
  - 重点复测 assistant 重新生成、分支会话是否稳定继承原 user 消息附件上下文
  - 用真实图片、PDF、文本文件验证上传、历史恢复、重新生成、分支
  - 在部署环境确认 Office 转 PDF 工具链是否可用
  - 观察私有 Storage 图片预览在移动端下的加载与放大表现
  - 评估未引用附件自动清理失败时是否需要后台补偿任务
- `Phase 4.3` 观察：
  - 继续用真实页面观察收藏、归档、恢复在多会话数据下的交互稳定性
  - 检查移动端 Sheet 下收藏区、归档区和会话菜单弹层表现
  - 观察 CSS-only Tooltip 是否仍会在特殊容器里被裁切
- `Phase 3.6` 补做：
  - RLS 验证
  - 数据库说明补全
  - migration 与表设计说明整理
  - 页面功能与数据库操作映射关系整理
  - 答辩支撑材料整理


## 一句话结论

`Phase 4.4` 文件与图片输入第一轮已经落地并完成远端 migration、typecheck、lint、build 与浏览器 smoke test，但当前阶段仍处于高风险调试期，需要用真实附件数据继续做端到端验收，并对上传反馈、编辑保存、历史恢复、移动端预览和 Office 转 PDF 部署链路做大量调整。
