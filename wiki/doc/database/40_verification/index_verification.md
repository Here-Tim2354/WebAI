# 索引验证清单

## 主线表

- [ ] `conversations.user_id`
- [ ] `conversations(user_id, status)`
- [ ] `messages.conversation_id`
- [ ] `messages(conversation_id, created_at)`

## 模型注册表

- [x] `model_catalog(default_enabled, sort_order, label)` 是否有索引
- [x] `model_fetched(user_id, is_enabled, sort_order, label)` 是否有索引
- [x] `model_fetched(user_id)` 是否有 `is_default = true and is_enabled = true` 的部分唯一约束

索引状态：

- Supabase 环境需要包含 `model_catalog_default_enabled_idx`
- Supabase 环境需要包含 `model_fetched_user_enabled_idx`
- Supabase 环境需要包含 `model_fetched_user_model_idx`
- Supabase 环境需要包含 `model_fetched_single_default_per_user_idx`
- advisor 如果提示这些索引“尚未使用”，通常属于观测期现象，不等于索引设计错误

## 原则

- 外键列默认要有索引
- 多列查询优先考虑复合索引
- 常见过滤条件优先考虑部分索引
