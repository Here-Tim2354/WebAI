# 索引验证清单

## 主线表

- [ ] `conversations.user_id`
- [ ] `conversations(user_id, status)`
- [ ] `messages.conversation_id`
- [ ] `messages(conversation_id, created_at)`

## 模型注册表

- [x] `ai_models` 是否按 `is_enabled + sort_order + label` 查询模式优化
- [x] `ai_models(provider)` 是否有 `is_default = true` 的部分唯一约束
- [x] `openai_compatible_models.ai_model_id` 是否有唯一索引与外键索引
- [x] `gemini_models.ai_model_id` 是否有唯一索引与外键索引

当前状态：

- 远端 Supabase 已存在 `ai_models_enabled_idx`
- 远端 Supabase 已存在 `ai_models_sort_order_idx`
- 远端 Supabase 已存在 `ai_models_default_per_provider_unique_idx`
- 远端 Supabase 已存在 `openai_compatible_models_ai_model_id_idx`
- 远端 Supabase 已存在 `gemini_models_ai_model_id_idx`
- advisor 当前提示这些索引“尚未使用”，这属于观测期现象，不等于索引设计错误

## 原则

- 外键列默认要有索引
- 多列查询优先考虑复合索引
- 常见过滤条件优先考虑部分索引
