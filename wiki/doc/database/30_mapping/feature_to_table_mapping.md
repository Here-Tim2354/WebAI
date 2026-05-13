# 功能到表的映射

需求基线：

- [[plan/phase/phase_overview|phase_overview]]

## 当前数据库主线

| 功能 | 主要表 | 说明 |
| --- | --- | --- |
| 用户登录与身份恢复 | `auth.users`, `profiles` | 认证与展示资料 |
| 邮箱密码登录 | `auth.users` | 由 Supabase Auth 建立 session |
| 邮箱验证码登录 | `auth.users` | 由 Supabase Auth 发送并校验邮箱 OTP 后建立 session |
| GitHub OAuth 登录 | `auth.users` | 由 Supabase Auth provider 建立外部登录 session |
| 修改登录密码 | `auth.users` | 登录后通过 Auth 更新密码 |
| 修改昵称 | `profiles` | 更新用户展示名称 |
| 上传头像 | `profile_avatars`, `profiles` | Storage 保存头像对象，`profiles.avatar_url` 保存路径 |
| 查看会话列表 | `conversations` | 按用户读取并排序 |
| 新建会话 | `conversations` | 首次发送前可先建空会话 |
| 重命名会话 | `conversations` | 修改标题 |
| 删除会话 | `conversations`, `messages` | 删除会话并清理其消息 |
| 查看历史消息 | `messages` | 按 `conversation_id` 与时间顺序读取 |
| 发送消息 | `messages`, `conversations` | 先写用户消息，再 touch 会话更新时间 |
| 保存会话级提示词 | `conversations` | `system_prompt` |
| 会话级联网搜索偏好 | `conversations` | `web_search_enabled`，当前默认开启 |
| 会话级思考档位 | `conversations` | `thinking_level`，取值为 `minimal / low / medium / high`，当前默认 `minimal` |

## 当前系统配置层

| 功能 | 主要表 | 说明 |
| --- | --- | --- |
| 模型列表读取 | `model_fetched` | 只返回当前用户已启用的 Gemini 模型 |
| 当前模型选择 | `model_fetched` | 前端持有用户模型主键作为 `modelId` |
| 按模型发起请求 | `model_fetched` | 服务端确认模型属于当前用户且已启用，再用对应 `model_id` 调 Gemini |
| `Gemini URL Context` 能力判断 | `model_fetched` | 由用户模型记录中的能力字段决定是否可用 |
| Gemini 模型拉取 | `model_catalog`, `model_fetched` | 内部 catalog 负责能力补全，用户可见与可开关的是 fetched 记录 |

## 当前仍在扩展层

| 功能 | 目标表 | 状态 |
| --- | --- | --- |
| 收藏会话 | `favorites` | 已用于会话收藏入口 |
| 搜索记录 | `search_records` | `planned` |
| 归档区管理增强 | `conversations.archived_at` | 已用于归档区入口 |
