# 索引验证清单

## 主线表

- [ ] `conversations.user_id`
- [ ] `conversations(user_id, status)`
- [ ] `messages.conversation_id`
- [ ] `messages(conversation_id, created_at)`

## 模型注册表

- [ ] `ai_models` 是否按 `is_enabled + sort_order + label` 查询模式优化
- [ ] `ai_models(provider)` 是否有 `is_default = true` 的部分唯一约束
- [ ] `openai_compatible_models.ai_model_id` 是否有唯一索引与外键索引
- [ ] `gemini_models.ai_model_id` 是否有唯一索引与外键索引

## 原则

- 外键列默认要有索引
- 多列查询优先考虑复合索引
- 常见过滤条件优先考虑部分索引
