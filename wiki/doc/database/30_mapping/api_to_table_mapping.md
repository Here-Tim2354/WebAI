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
| `GET /api/conversations?favorite=true` | `conversations`, `favorites` | 读取当前用户收藏会话列表 |
| `GET /api/conversations?status=archived` | `conversations` | 读取当前用户归档会话列表 |
| `POST /api/conversations` | `conversations` | 新建会话；可接收浏览器预生成 UUID 以支持乐观更新 |
| `GET /api/conversations/[conversationId]` | `conversations`, `messages` | 读取会话详情与消息快照 |
| `PATCH /api/conversations/[conversationId]` | `conversations` | 更新标题、提示词、模型、`web_search_enabled` 或 `thinking_level` |
| `DELETE /api/conversations/[conversationId]` | `conversations`, `messages` | 删除会话及其消息 |
| `POST /api/conversations/[conversationId]/favorite` | `favorites`, `conversations` | 收藏当前会话 |
| `DELETE /api/conversations/[conversationId]/favorite` | `favorites`, `conversations` | 取消收藏当前会话 |
| `POST /api/conversations/[conversationId]/branch` | `conversations`, `messages` | 从消息上下文创建分支会话，并复制目标上下文前的消息 |
| `POST /api/chat` | `conversations`, `messages`, `model_fetched` | 写用户消息、读取用户启用的 Gemini 模型、按会话配置决定 `googleSearch` 与 `thinking_level`，按请求参数决定 `urlContext`，再写 assistant 消息 |
| `POST /api/chat/cancel` | `messages`, `conversations` | 将当前 assistant 消息状态更新为 `cancelled` |
| `PATCH /api/messages/[messageId]` | `messages` | 编辑 user 消息，更新 `content` / `metadata` 并删除后续消息 |
| `POST /api/messages/[messageId]/regenerate` | `messages`, `conversations`, `model_fetched` | 重新生成最后一条 assistant 消息，可更新对应 user 消息的 URL / 附件 metadata |
| `POST /api/attachments/upload` | `message_attachments` | 上传图片 / PDF / 文本 / Markdown / CSV / Excel 转换后的 CSV |
| `GET /api/attachments/object` | `message_attachments` | 代理读取当前用户自己的私有附件对象 |
| `GET /api/models` | `model_fetched` | 返回当前用户已启用的 Gemini 模型列表 |
| `GET /api/models/fetched` | `model_fetched` | 返回当前用户拉取到的 Gemini 模型列表，包含未启用模型 |
| `PATCH /api/models/fetched/[modelId]` | `model_fetched` | 启用 / 停用模型，或设置默认模型 |
| `POST /api/models/gemini/fetch` | `model_catalog`, `model_fetched` | 用用户提供的 Gemini API Key / URL 拉取模型，并按内部 catalog 补全能力后写入用户模型列表 |
| `GET /api/profile` | `profiles` | 读取当前用户资料 |
| `PATCH /api/profile` | `profiles` | 修改当前用户昵称 |
| `POST /api/profile/avatar` | `profile_avatars`, `profiles` | 上传头像对象并保存头像路径 |
| `GET /api/profile/avatar` | `profile_avatars` | 代理读取当前用户自己的私有头像对象 |
| `PATCH /api/profile/password` | `auth.users` | 登录后修改当前用户密码 |

## 判断规则

- 新功能若还找不到稳定的 API 到表映射，只能算扩展层
- API 已存在但表还没稳定，也不能提前写入核心关系模式
