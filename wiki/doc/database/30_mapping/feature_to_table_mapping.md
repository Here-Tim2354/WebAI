# 功能到表的映射

需求基线：

- [[plan/phase/phase_overview|phase_overview]]

## 当前数据库主线

| 功能 | 主要表 | 说明 |
| --- | --- | --- |
| 用户登录与身份恢复 | `auth.users`, `profiles` | 认证与展示资料 |
| 查看会话列表 | `conversations` | 按用户读取并排序 |
| 新建会话 | `conversations` | 首次发送前可先建空会话 |
| 重命名会话 | `conversations` | 修改标题 |
| 删除会话 | `conversations`, `messages` | 删除会话并清理其消息 |
| 查看历史消息 | `messages` | 按 `conversation_id` 与时间顺序读取 |
| 发送消息 | `messages`, `conversations` | 先写用户消息，再 touch 会话更新时间 |
| 保存会话级提示词 | `conversations` | `system_prompt` |

## 当前系统配置层

| 功能 | 主要表 | 说明 |
| --- | --- | --- |
| 模型列表读取 | `ai_models`, `openai_compatible_models`, `gemini_models` | 父表提供统一入口，子表补全实现细节 |
| 当前模型选择 | `ai_models` | 前端持有注册表主键作为 `modelId` |
| 按模型发起请求 | `ai_models`, `openai_compatible_models`, `gemini_models` | 服务端先解析父表，再补全 provider 子表 |

## 当前仍在扩展层

| 功能 | 目标表 | 当前状态 |
| --- | --- | --- |
| 收藏消息 | `favorites` | `planned` |
| 搜索记录 | `search_records` | `planned` |
| 归档区管理增强 | `conversations` 或额外扩展表 | 需求存在，未完整验证 |
