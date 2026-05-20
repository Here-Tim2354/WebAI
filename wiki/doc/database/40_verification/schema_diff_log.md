# Schema 差异记录

这篇笔记记录“文档口径”和“系统结构”之间的差异。

## 已收口差异

- `relation_schema_design.md` 不把 `favorites` 与 `search_records` 视为核心关系模式
- 模型注册表被单独视为系统配置层，不再和会话主线混写
- `phase_overview.md` 被明确为需求基线

## 2026-05-20 云端核对

- 日期：2026-05-20
- 文档：`overall_er_graph.dbml`、`overall_er_graph.sql`
- 系统结构 / migration：远端 `public,storage` schema dump
- 差异描述：文档仍把 `favorites` 写成消息收藏 `message_id`，但云端实际为会话收藏 `conversation_id`
- 处理结论：改为 `favorites.conversation_id -> conversations.id`，并保留 `favorites(user_id, conversation_id)` 唯一约束

- 日期：2026-05-20
- 文档：`overall_er_graph.dbml`、`overall_er_graph.sql`
- 系统结构 / migration：远端 `public,storage` schema dump
- 差异描述：文档仍保留 `search_records` 物理表，但云端当前不存在 `search_records`
- 处理结论：从整体 ER 图和 SQL 参考中移除 `search_records`，搜索方向继续由 `search_records_extension.md` 记录为撤回

- 日期：2026-05-20
- 文档：`relation_schema_design.md`、`verified_notes.md`
- 系统结构 / migration：远端 `messages` 表
- 差异描述：文档中的 `messages` 字段仍停留在 Phase 3，只记录 `content` 与 `created_at`
- 处理结论：补入 `messages.status`、`messages.metadata` 与消息内容校验约束说明

## 后续发现差异时的记录格式

- 日期：
- 文档：
- 系统结构 / migration：
- 差异描述：
- 处理结论：
