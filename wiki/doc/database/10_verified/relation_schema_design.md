# 核心关系模式设计

## 文档定位

这篇笔记只记录数据库主线中已经纳入系统边界、并能支撑课程设计说明的关系模式。

这里的“核心”指：

- 对应 migration、查询路径和接口契约能互相对上，或
- 已被 `phase_overview.md` 的阶段目标明确纳入，并与系统使用方式保持一致

需求基线：

- [[plan/phase/phase_overview|phase_overview]]

不属于本文的内容：

- `favorites`
- `search_records`
- 管理员后台
- 尚未决定的模型注册表扩展字段

这些内容统一转入 `20_extension/`。

---

## 一、核心关系模式总览

纳入数据库主线或系统配置层的表为：

- `auth.users`
- `profiles`
- `conversations`
- `messages`
- `ai_models`
- `openai_compatible_models`
- `gemini_models`

其中：

- `auth.users` 与 `profiles` 承接用户身份与展示资料
- `conversations` 与 `messages` 构成数据库课程设计主线
- `ai_models` 作为模型注册表父表承接通用字段
- `openai_compatible_models` 与 `gemini_models` 作为 provider 子表承接实现差异

阶段位置：

- 数据库课程设计主线仍是“用户进入系统 -> 创建或打开会话 -> 发送消息 -> 恢复历史会话”
- 模型注册表属于 `Phase 4` 已进入实现的系统配置能力
- 模型注册表已经影响前端模型选择和服务端 provider 分发，因此不能再当作纯设想

---

## 二、表设计

### 1. 用户身份表

- 中文表名：用户身份
- 英文表名：`auth.users`
- 作用：由 `Supabase Auth` 提供认证主身份

| 字段名 | 类型 | 可空 | 主键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 无 | 用户唯一标识 |
| `email` | `varchar(255)` | 否 | 否 | 无 | 用户邮箱 |
| `created_at` | `timestamptz` | 否 | 否 | `now()` | 用户创建时间 |

说明：

- 认证主表不在当前项目中重复自建
- 课程文档中应把它视为认证身份来源，而不是普通业务表

### 2. 用户资料表

- 中文表名：用户资料
- 英文表名：`profiles`
- 作用：保存展示资料和业务补充信息

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `user_id` | `uuid` | 否 | 是 | `auth.users.id` | 无 | 与认证用户一对一 |
| `display_name` | `varchar(100)` | 是 | 否 | 否 | 无 | 展示名称 |
| `avatar_url` | `varchar(500)` | 是 | 否 | 否 | 无 | 头像地址 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 更新时间 |

### 3. 会话表

- 中文表名：会话
- 英文表名：`conversations`
- 作用：保存用户的聊天会话及其状态信息

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 否 | 无 | 会话唯一标识 |
| `user_id` | `uuid` | 否 | 否 | `auth.users.id` | 无 | 所属用户 |
| `title` | `varchar(100)` | 否 | 否 | 否 | 无 | 会话标题 |
| `system_prompt` | `text` | 是 | 否 | 否 | 无 | 会话级提示词 |
| `model_id` | `uuid` | 是 | 否 | `ai_models.id` | 无 | 当前会话模型 |
| `web_search_enabled` | `boolean` | 否 | 否 | 否 | `true` | 会话级联网开关 |
| `thinking_level` | `text` | 否 | 否 | 否 | `minimal` | 会话级思考档位，取值为 `minimal / low / medium / high` |
| `status` | `conversation_status` | 否 | 否 | 否 | `active` | 会话状态 |
| `archived_at` | `timestamptz` | 是 | 否 | 否 | 无 | 归档时间 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 创建时间 |
| `updated_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 更新时间 |

### 4. 消息表

- 中文表名：消息
- 英文表名：`messages`
- 作用：保存会话中的单条聊天消息

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 否 | 无 | 消息唯一标识 |
| `conversation_id` | `uuid` | 否 | 否 | `conversations.id` | 无 | 所属会话 |
| `sender_type` | `message_sender_type` | 否 | 否 | 否 | 无 | 发送者类型 |
| `content` | `text` | 否 | 否 | 否 | 无 | 消息内容 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 发送时间 |

### 5. 模型注册表父表

- 中文表名：模型注册表
- 英文表名：`ai_models`
- 作用：保存跨 provider 通用的模型元数据，并作为统一 `modelId` 的来源

字段以查询路径和接口契约为准：

| 字段名 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | 否 | 注册表主键，也是前后端统一使用的 `modelId` |
| `provider` | `varchar(50)` | 否 | 当前取值为 `openai_compatible` / `gemini` |
| `api_style` | `varchar(50)` | 否 | 当前 provider 对应的接口风格 |
| `upstream_model_id` | `varchar(160)` | 否 | 上游真实模型标识 |
| `label` | `varchar(160)` | 否 | 前端展示名称 |
| `description` | `text` | 是 | 模型说明 |
| `icon` | `text` | 是 | 图标资源 |
| `is_enabled` | `boolean` | 否 | 是否启用 |
| `is_default` | `boolean` | 否 | 是否为该 provider 的默认模型 |
| `sort_order` | `integer` | 否 | 前端排序权重 |

说明：

- `ai_models` 是当前模型注册表的统一入口
- `src/lib/supabase/model-registry.ts` 已先读取父表，再按 provider 到子表补全细节

### 6. OpenAI 兼容模型子表

- 中文表名：OpenAI 兼容模型
- 英文表名：`openai_compatible_models`
- 作用：保存采用 OpenAI 兼容接口的 provider 专属字段与能力位

字段以查询路径和接口契约为准：

| 字段名 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| `ai_model_id` | `uuid` | 否 | 关联 `ai_models.id` |
| `model_id` | `varchar(160)` | 否 | 上游兼容接口模型标识 |
| `base_url` | `text` | 是 | 兼容接口基地址 |
| `supports_text` | `boolean` | 否 | 文本能力 |
| `supports_image` | `boolean` | 否 | 图像能力 |
| `supports_audio` | `boolean` | 否 | 音频能力 |
| `supports_video` | `boolean` | 否 | 视频能力 |
| `supports_web_search` | `boolean` | 否 | 联网能力 |
| `supports_function_calling` | `boolean` | 否 | 函数调用能力 |
| `supports_tools` | `boolean` | 否 | 工具能力总开关 |
| `supports_files` | `boolean` | 否 | 文件输入能力 |
| `supports_structured_outputs` | `boolean` | 否 | 结构化输出能力 |
| `supports_streaming` | `boolean` | 否 | 流式能力 |
| `supports_reasoning` | `boolean` | 否 | 推理能力 |

说明：

- 模型注册表采用父子表结构
- `base_url` 仍由该子表提供给 `OpenAI compatible` 调用层
- 通用展示字段、启用状态与默认模型策略统一放在父表 `ai_models`

### 7. Gemini 模型子表

- 中文表名：Gemini 模型
- 英文表名：`gemini_models`
- 作用：保存 Gemini provider 专属字段与能力位

字段以查询路径和接口契约为准：

| 字段名 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| `ai_model_id` | `uuid` | 否 | 关联 `ai_models.id` |
| `name` | `varchar(160)` | 否 | Gemini 官方模型名 |
| `supports_text` | `boolean` | 否 | 文本能力 |
| `supports_image` | `boolean` | 否 | 图像能力 |
| `supports_audio` | `boolean` | 否 | 音频能力 |
| `supports_video` | `boolean` | 否 | 视频能力 |
| `supports_google_search` | `boolean` | 否 | Google Search grounding |
| `supports_url_context` | `boolean` | 否 | URL Context |
| `supports_code_execution` | `boolean` | 否 | Code Execution |
| `supports_function_calling` | `boolean` | 否 | 函数调用能力 |
| `supports_tools` | `boolean` | 否 | 工具能力总开关 |
| `supports_files` | `boolean` | 否 | 文件输入能力 |
| `supports_structured_outputs` | `boolean` | 否 | 结构化输出能力 |
| `supports_streaming` | `boolean` | 否 | 流式能力 |
| `supports_reasoning` | `boolean` | 否 | 推理能力 |

说明：

- 模型注册表采用父子表结构
- `url_context`、`code_execution` 等能力位仍由该子表提供给运行时模型
- 通用展示字段、启用状态与默认模型策略统一放在父表 `ai_models`

---

## 三、主键、外键与约束

### 主键

- `auth.users.id`
- `profiles.user_id`
- `conversations.id`
- `messages.id`
- `ai_models.id`
- `openai_compatible_models.id`
- `gemini_models.id`

### 外键

- `profiles.user_id -> auth.users.id`
- `conversations.user_id -> auth.users.id`
- `messages.conversation_id -> conversations.id`
- `openai_compatible_models.ai_model_id -> ai_models.id`
- `gemini_models.ai_model_id -> ai_models.id`

### 核心约束

- `ai_models.provider` 取值为 `openai_compatible` / `gemini`
- `conversations.status` 取值为 `active` / `archived`
- `messages.sender_type` 取值为 `user` / `assistant`
- `openai_compatible_models.model_id` 仍与父表 `upstream_model_id` 一致
- `gemini_models.name` 仍与父表 `upstream_model_id` 一致

---

## 四、索引设计

以下索引属于当前结构应明确维护的重点：

- `conversations.user_id`
- `conversations(user_id, status)`
- `conversations.updated_at`
- `messages.conversation_id`
- `messages(conversation_id, created_at)`
- `ai_models(is_enabled)`
- `ai_models(sort_order, label)` with `is_enabled = true` 的查询模式
- `ai_models(provider)` with `is_default = true` 的部分唯一约束
- `openai_compatible_models.ai_model_id`
- `gemini_models.ai_model_id`

说明：

- 外键列索引和复合索引是当前查询路径的必要条件
- 默认模型当前通过父表按 provider 维度约束，而不是再由两张子表各自兜底

---

## 五、删除策略

### 删除会话

- `messages.conversation_id` 应使用级联删除
- 删除会话后不应残留孤立消息

### 删除用户

- 用户删除不是当前普通业务功能重点
- 但从完整性角度，用户相关资料与会话数据应由系统级逻辑统一处理

### 模型注册表

- 模型注册表当前更偏系统配置层
- 当前主线不是删除模型记录，而是启用 / 停用与默认模型切换
- 当前统一入口是 `ai_models`，provider 子表跟随父表记录一起维护

---

## 六、边界总结

数据库设计需要区分两层：

- 数据库主线：
  - `auth.users`
  - `profiles`
  - `conversations`
  - `messages`
- 系统配置层：
  - `ai_models`
  - `openai_compatible_models`
  - `gemini_models`

这篇笔记不混入的扩展实体：

- `favorites`
- `search_records`
- 后台管理相关表
- 尚未确认落库的模型扩展字段

---

## 七、一句话总结

这组核心关系模式足以支撑数据库课程设计主线和“父表 + provider 子表”的第一版模型注册表；后续扩展能力继续通过扩展层笔记推进，避免和数据库主线混写。
