# API 到表的映射

## 使用中的接口

| 接口 | 涉及表 | 说明 |
| --- | --- | --- |
| `POST /api/auth/password` | `auth.users` | 通过 Supabase Auth 校验邮箱密码并建立 session |
| `POST /api/auth/email-code/send` | `auth.users` | 通过 Supabase Auth 发送邮箱验证码 |
| `POST /api/auth/email-code/verify` | `auth.users` | 通过 Supabase Auth 校验邮箱验证码并建立 session |
| `GET /api/auth/github` | `auth.users` | 发起 Supabase GitHub OAuth 授权 |
| `POST /api/auth/sign-out` | `auth.users` | 清理当前 Supabase session |
| `DELETE /api/profile/account` | `auth.users`, `profiles`, `conversations`, `messages`, `favorites`, Storage objects | 注销当前账户；服务端 admin client 删除 Auth 用户并清理当前用户头像和消息附件对象，业务表依赖外键级联清理 |
| `GET /api/release-notes/current` | 无数据库表 | 读取当前版本 Markdown 更新日志 |
| `GET /api/conversations` | `conversations` | 读取当前用户会话列表 |
| `POST /api/conversations` | `conversations` | 新建会话；可接收浏览器预生成 UUID 以支持乐观更新 |
| `GET /api/conversations/[conversationId]` | `conversations`, `messages` | 读取会话详情与消息快照 |
| `PATCH /api/conversations/[conversationId]` | `conversations` | 更新标题、提示词、模型、`web_search_enabled` 或 `thinking_level` |
| `DELETE /api/conversations/[conversationId]` | `conversations`, `messages` | 删除会话及其消息 |
| `POST /api/chat` | `conversations`, `messages`, `model_fetched` | 写用户消息、读取用户启用的 Gemini 模型、按会话配置决定 `googleSearch` 与 `thinking_level`，按请求参数决定 `urlContext`，再写 assistant 消息 |
| `GET /api/models` | `model_fetched` | 返回当前用户已启用的 Gemini 模型列表 |
| `GET /api/models/fetched` | `model_fetched` | 返回当前用户拉取到的 Gemini 模型列表，包含未启用模型 |
| `PATCH /api/models/fetched/[modelId]` | `model_fetched` | 启用 / 停用模型，或设置默认模型 |
| `POST /api/models/gemini/fetch` | `model_catalog`, `model_fetched` | 用用户提供的 Gemini API Key / URL 拉取模型，并按内部 catalog 补全能力后写入用户模型列表 |

## 判断规则

- 新功能若还找不到稳定的 API 到表映射，只能算扩展层
- API 已存在但表还没稳定，也不能提前写入核心关系模式
