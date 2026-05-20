# Migration 验证清单

## 主线表

- [x] `profiles`
- [x] `conversations`
- [x] `messages`
- [x] `model_catalog`
- [x] `model_fetched`
- [x] `conversations.web_search_enabled`
- [x] `conversations.thinking_level`
- [x] `messages.status`
- [x] `messages.metadata`
- [x] `favorites`
- [x] `conversations.archived_at`
- [x] `message_attachments`
- [x] `profile_avatars`
- [x] `20260505023000_phase4_gemini_only_model_registry.sql`
- [x] `20260505043000_phase4_model_catalog_and_fetched.sql`
- [x] `20260511193000_phase5_profile_avatars.sql`

## 验证项

- [x] migration 文件是否与查询路径一致
- [x] 表名、字段名和代码 `select` 字段一致
- [x] 默认值和非空约束与业务语义一致
- [x] 删除策略与业务语义一致
- [x] `model_catalog` 与 `model_fetched` 的职责边界已明确
- [x] `model_fetched` 默认模型约束已按用户维度明确
- [x] `model_fetched.provider` 约束为 `gemini`
- [x] `model_fetched.api_style` 约束为 `gemini_native`
- [x] 会话级联网搜索字段位于 `conversations`
- [x] 消息正文校验允许 user 消息以正文、URL Context 或附件三者至少之一成立
- [x] `search_records` 不存在于云端 schema，与“搜索方向撤回”一致
- [x] 附件 Storage bucket 为私有 bucket
- [x] 附件 Storage policy 按用户 ID 一级目录隔离
- [x] 头像 Storage bucket 为私有 bucket
- [x] 头像 Storage policy 按用户 ID 一级目录隔离

## 缺口

- [ ] RLS advisor 与性能 advisor 的遗留项仍需单独收口
- [ ] 用户手动编辑模型能力的交互仍未补齐
- [ ] 头像替换后的旧对象清理策略仍可后续补充

## 云端核对记录

- `2026-05-20`：使用 Supabase CLI 导出远端 `public,storage` schema，并排除用户业务数据后导出元数据数据行
- 云端项目：`webai_base`，project ref `ekswdwnxsugmtkdxfmnd`
- CLI 版本：`v2.90.0`；CLI 提示存在 `v2.100.1`，本次未升级

## 原则

- migration、查询路径和接口契约没有对齐前，不把字段写入 `10_verified/`
- 文档与 migration 发生冲突时，先回到需求基线和现有实现核对
