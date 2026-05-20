# 索引验证清单

## 主线表

- [x] `conversations.user_id`
- [x] `conversations(user_id, status)`
- [x] `conversations(user_id, status, updated_at desc)`
- [x] `conversations.updated_at desc`
- [x] `conversations.archived_at desc where archived_at is not null`
- [x] `conversations.model_id`
- [x] `messages.conversation_id`
- [x] `messages(conversation_id, created_at)`
- [x] `messages.created_at`

## 会话组织

- [x] `favorites.conversation_id`
- [x] `favorites(user_id, created_at desc)`
- [x] `favorites(user_id, conversation_id)` 唯一约束

## 模型注册表

- [x] `model_catalog(default_enabled, sort_order, label)` 是否有索引
- [x] `model_catalog(is_default)` 是否有 `is_default = true` 的部分唯一约束
- [x] `model_fetched(user_id, is_enabled, sort_order, label)` 是否有索引
- [x] `model_fetched(user_id, model_id)` 是否有唯一约束；云端由 `model_fetched_user_model_unique` 约束提供
- [x] `model_fetched(user_id)` 是否有 `is_default = true and is_enabled = true` 的部分唯一约束

索引状态：

- Supabase 环境需要包含 `model_catalog_default_enabled_idx`
- Supabase 环境需要包含 `model_fetched_user_enabled_idx`
- Supabase 环境不需要额外保留普通 `model_fetched_user_model_idx`，因为唯一约束已提供同列索引语义
- Supabase 环境需要包含 `model_fetched_single_default_per_user_idx`
- Supabase 环境当前保留 `conversations_title_trgm_idx` 与 `messages_content_trgm_idx`，用于标题 / 内容模糊检索；搜索产品方向虽已撤回，但这两个索引仍可服务轻量检索或后续观察
- advisor 如果提示这些索引“尚未使用”，通常属于观测期现象，不等于索引设计错误

## 云端核对记录

- `2026-05-20`：上述索引来自 Supabase CLI 远端 schema dump，不是仅按 migration 推断。

## 原则

- 外键列默认要有索引
- 多列查询优先考虑复合索引
- 常见过滤条件优先考虑部分索引
