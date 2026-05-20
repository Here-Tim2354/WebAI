# 核心关系模式设计

## 文档定位

这篇笔记只记录数据库主线中已经纳入系统边界、并能支撑课程设计说明的关系模式。

这里的“核心”指：

- 对应 migration、查询路径和接口契约能互相对上，或
- 已被 `phase_overview.md` 的阶段目标明确纳入，并与系统使用方式保持一致

需求基线：

- [[plan/phase/phase_overview|phase_overview]]

不属于本文的内容：

- `search_records`
- 管理员后台
- 尚未决定的模型注册表扩展字段

这些内容统一转入 `20_extension/`。

说明：

- `favorites` 已经存在于云端 schema，本文件把它作为“已验证的会话组织扩展表”记录，但课程设计主线仍以 `profiles`、`conversations`、`messages` 为核心。
- `search_records` 当前不存在于云端 schema，继续视为撤回方向。

---

## 一、核心关系模式总览

纳入数据库主线或系统配置层的表为：

- `auth.users`
- `profiles`
- `conversations`
- `messages`
- `favorites`
- `model_catalog`
- `model_fetched`

其中：

- `auth.users` 与 `profiles` 承接用户身份与展示资料
- `conversations` 与 `messages` 构成数据库课程设计主线
- `favorites` 承接 Phase 4.3 的会话收藏能力
- `model_catalog` 是服务端私有维护的 Gemini 能力参照表
- `model_fetched` 是用户通过 Gemini 设置拉取并启用 / 停用的模型列表

阶段位置：

- 数据库课程设计主线仍是“用户进入系统 -> 创建或打开会话 -> 发送消息 -> 恢复历史会话”
- 模型目录属于 `Phase 4` 的系统配置能力
- 模型目录影响前端模型选择和服务端 Gemini 请求，因此不能当作纯设想

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
| `model_id` | `uuid` | 是 | 否 | `model_fetched.id` | 无 | 当前会话模型 |
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
| `status` | `message_status` | 否 | 否 | 否 | `complete` | 消息状态，支持 pending / streaming / complete / cancelled / error |
| `metadata` | `jsonb` | 否 | 否 | 否 | `{}` | 消息级上下文，保存 URL Context、附件、thinking 等扩展信息 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 发送时间 |

说明：

- `metadata` 必须是 JSON object。
- user 消息要求状态为 `complete`，且正文、`metadata.attachments`、`metadata.urls` 至少存在其一。
- assistant 消息允许 `pending`、`streaming` 的空正文过渡态，也允许 `cancelled` / `error` 空正文状态。

### 5. 会话收藏表

- 中文表名：会话收藏
- 英文表名：`favorites`
- 作用：保存用户收藏的会话

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 否 | `gen_random_uuid()` | 收藏记录唯一标识 |
| `user_id` | `uuid` | 否 | 否 | `auth.users.id` | 无 | 所属用户 |
| `conversation_id` | `uuid` | 否 | 否 | `conversations.id` | 无 | 被收藏会话 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 收藏时间 |

说明：

- 收藏对象是会话，不是单条消息。
- `favorites(user_id, conversation_id)` 保持唯一，避免重复收藏。
- 删除用户或会话时，收藏记录随外键级联删除。

### 6. 内部模型目录表

- 中文表名：内部模型目录
- 英文表名：`model_catalog`
- 作用：保存 Gemini 主流模型的能力补全参照，不直接作为用户可选模型列表

| 字段名 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | 否 | 目录主键 |
| `provider` | `varchar(50)` | 否 | 固定为 `gemini` |
| `api_style` | `varchar(50)` | 否 | 固定为 `gemini_native` |
| `model_id` | `varchar(160)` | 否 | Gemini 模型唯一标识 |
| `label` | `varchar(160)` | 否 | 模型展示名称 |
| `description` | `text` | 是 | 模型说明 |
| `icon` | `text` | 是 | 图标资源 |
| `input_token_limit` | `integer` | 是 | 输入 token 上限 |
| `output_token_limit` | `integer` | 是 | 输出 token 上限 |
| `capabilities` | `jsonb` | 否 | 能力覆盖表 |
| `raw_metadata` | `jsonb` | 否 | 上游原始元数据 |
| `source` | `varchar(50)` | 否 | 来源标记 |
| `default_enabled` | `boolean` | 否 | 用户模型列表初始化时是否默认启用 |
| `is_default` | `boolean` | 否 | 是否作为默认模型模板 |
| `sort_order` | `integer` | 否 | 展示排序权重 |

说明：

- `model_catalog` 不开放给普通用户直接维护
- fetch 到的模型若能按 `model_id` 命中目录，就使用目录能力补全不完整的上游参数

### 7. 用户拉取模型表

- 中文表名：用户拉取模型
- 英文表名：`model_fetched`
- 作用：保存用户通过 Gemini URL / API Key 拉取到的模型，并提供启用、停用和默认模型选择

| 字段名 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| `id` | `uuid` | 否 | 用户模型主键，也是前后端统一使用的 `modelId` |
| `user_id` | `uuid` | 否 | 所属用户 |
| `provider` | `varchar(50)` | 否 | 固定为 `gemini` |
| `api_style` | `varchar(50)` | 否 | 固定为 `gemini_native` |
| `base_url` | `text` | 否 | Gemini API Base URL，默认官方地址 |
| `model_id` | `varchar(160)` | 否 | Gemini 上游模型标识 |
| `label` | `varchar(160)` | 否 | 前端展示名称 |
| `description` | `text` | 是 | 模型说明 |
| `icon` | `text` | 是 | 图标资源 |
| `input_token_limit` | `integer` | 是 | 输入 token 上限 |
| `output_token_limit` | `integer` | 是 | 输出 token 上限 |
| `capabilities` | `jsonb` | 否 | 合并后的能力覆盖表 |
| `raw_metadata` | `jsonb` | 否 | 上游原始元数据 |
| `catalog_id` | `uuid` | 是 | 命中的内部目录记录 |
| `source` | `varchar(50)` | 否 | `catalog` 或 `fetched` |
| `is_enabled` | `boolean` | 否 | 是否在模型选择器中启用 |
| `is_default` | `boolean` | 否 | 是否为该用户默认模型 |
| `sort_order` | `integer` | 否 | 展示排序权重 |
| `fetched_at` | `timestamptz` | 是 | 最近一次拉取时间 |

说明：

- 前端模型选择只读取用户已启用的 `model_fetched`
- 用户拉取模型时只保存模型元数据，不保存 API Key

---

## 三、主键、外键与约束

### 主键

- `auth.users.id`
- `profiles.user_id`
- `conversations.id`
- `messages.id`
- `favorites.id`
- `model_catalog.id`
- `model_fetched.id`

### 外键

- `profiles.user_id -> auth.users.id`
- `conversations.user_id -> auth.users.id`
- `messages.conversation_id -> conversations.id`
- `favorites.user_id -> auth.users.id`
- `favorites.conversation_id -> conversations.id`
- `conversations.model_id -> model_fetched.id`
- `model_fetched.user_id -> auth.users.id`
- `model_fetched.catalog_id -> model_catalog.id`

### 核心约束

- `model_catalog.provider` 与 `model_fetched.provider` 固定为 `gemini`
- `model_catalog.api_style` 与 `model_fetched.api_style` 固定为 `gemini_native`
- `model_catalog.model_id` 全局唯一
- `model_fetched(user_id, model_id)` 唯一
- 每个用户最多一个启用中的默认模型
- 同一用户不能重复收藏同一会话
- `conversations.status` 取值为 `active` / `archived`
- `messages.sender_type` 取值为 `user` / `assistant`
- `messages.status` 取值为 `pending` / `streaming` / `complete` / `cancelled` / `error`

---

## 四、索引设计

以下索引属于当前结构应明确维护的重点：

- `conversations.user_id`
- `conversations(user_id, status)`
- `conversations(user_id, status, updated_at desc)`
- `conversations.updated_at`
- `conversations.archived_at`
- `conversations.model_id`
- `messages.conversation_id`
- `messages(conversation_id, created_at)`
- `messages.created_at`
- `favorites.conversation_id`
- `favorites(user_id, created_at desc)`
- `model_catalog(default_enabled, sort_order, label)`
- `model_fetched(user_id, is_enabled, sort_order, label)`
- `model_fetched(user_id, model_id)`
- `model_fetched(user_id)` with `is_default = true and is_enabled = true` 的部分唯一约束

说明：

- 外键列索引和复合索引是当前查询路径的必要条件
- 用户侧默认模型通过 `model_fetched` 的用户维度部分唯一约束保证

---

## 五、删除策略

### 删除会话

- `messages.conversation_id` 应使用级联删除
- 删除会话后不应残留孤立消息
- `favorites.conversation_id` 应使用级联删除
- 删除会话后不应残留孤立收藏记录

### 删除用户

- `profiles.user_id`、`conversations.user_id`、`favorites.user_id` 与 `model_fetched.user_id` 都应跟随用户边界处理
- 用户拉取模型属于用户私有配置，不应跨用户共享

### 模型目录

- `model_catalog` 是内部能力参照表
- `model_fetched.catalog_id` 使用 `on delete set null`，避免目录调整直接破坏用户侧模型列表
- `conversations.model_id` 使用 `on delete set null`，避免停用或清理用户模型时破坏会话记录

---

## 六、边界总结

数据库设计需要区分两层：

- 数据库主线：
  - `auth.users`
  - `profiles`
  - `conversations`
  - `messages`
- 系统配置层：
  - `model_catalog`
  - `model_fetched`
- 已验证会话组织扩展：
  - `favorites`

这篇笔记不混入的扩展实体：

- `search_records`
- 后台管理相关表
- 尚未确认落库的模型扩展字段

---

## 七、一句话总结

这组核心关系模式足以支撑数据库课程设计主线和 Gemini-only 模型目录；后续扩展能力继续通过扩展层笔记推进，避免和数据库主线混写。
