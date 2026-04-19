# API 到表的映射

## 当前已使用接口

| 接口 | 涉及表 | 说明 |
| --- | --- | --- |
| `GET /api/conversations` | `conversations` | 读取当前用户会话列表 |
| `POST /api/conversations` | `conversations` | 新建会话 |
| `GET /api/conversations/[conversationId]` | `conversations`, `messages` | 读取会话详情与消息快照 |
| `PATCH /api/conversations/[conversationId]` | `conversations` | 更新标题或提示词 |
| `DELETE /api/conversations/[conversationId]` | `conversations`, `messages` | 删除会话及其消息 |
| `POST /api/chat` | `conversations`, `messages`, `ai_models`, `openai_compatible_models`, `gemini_models` | 写用户消息、读取注册表、写 assistant 消息 |
| `GET /api/models` | `ai_models`, `openai_compatible_models`, `gemini_models` | 返回统一模型列表 |

## 判断规则

- 新功能若还找不到稳定的 API 到表映射，只能算扩展层
- API 已存在但表还没稳定，也不能提前写入已验证关系模式
