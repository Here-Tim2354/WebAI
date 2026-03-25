# 关系模式设计

## 文档定位

本文基于当前已完成的：

- 用户需求分析
- 用户视角数据字典
- 实体与联系分析
- E-R 图

继续完成数据库的关系模式设计，用于支撑：

- 课程设计文档编写
- 后续 Supabase 建表
- 主键、外键、索引和约束说明

---

## 一、关系模式总览

当前系统的核心关系模式为：

- `auth.users`
- `profiles`
- `conversations`
- `messages`
- `favorites`
- `search_records`

其中：

- `auth.users` 与 `profiles` 共同承载用户身份与展示资料
- `conversations` 与 `messages` 构成聊天主线
- `favorites` 与 `search_records` 承接消息收藏与搜索行为

结合当前 `Phase 3` 的实施范围，第一批实际落地的最小关系模式应优先为：

- `auth.users`
- `profiles`
- `conversations`
- `messages`

`favorites` 与 `search_records` 保留在整体设计中，但不作为当前首批 migration 的强制范围。

这是一项有意为之的阶段性取舍，而不是设计遗漏。

原因包括：

- 当前阶段的最高优先级是完成数据库课程设计主线
- 当前最小可演示闭环聚焦于会话 CRUD 与消息持久化
- 若在首批实现中同时落地 `favorites` 与 `search_records`，会扩大改动面并分散主线开发注意力

因此当前应将这两张表理解为：

- 在整体数据库设计中保留
- 在整体 ER 图中展示
- 在后续扩展批次中再进入 Supabase 实际落地

也就是说：

- 整体设计范围不等于首批实现范围
- 当前 Supabase 中未落地 `favorites` 与 `search_records`，属于阶段性控制，不代表其被从系统设计中删除

---

## 二、表设计

### 1. 用户表

- 中文表名：用户
- 英文表名：`auth.users`
- 作用：由 `Supabase Auth` 提供认证主身份，不作为当前项目优先自建的业务表

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 否 | 无 | 用户唯一标识 |
| `email` | `varchar(255)` | 否 | 否 | 否 | 无 | 用户邮箱，要求唯一 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 用户创建时间 |

说明：

- 若需要角色、账号状态等业务字段，可在后续扩展到 `profiles` 或单独业务表
- 当前阶段不建议为了课程文档表达而重复自建完整认证主表

### 2. 用户资料表

- 中文表名：用户资料
- 英文表名：`profiles`
- 作用：保存用户在界面中的展示资料

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `user_id` | `uuid` | 否 | 是 | 是 | 无 | 对应 `auth.users.id`，同时形成一对一关系 |
| `display_name` | `varchar(100)` | 是 | 否 | 否 | 无 | 展示名称或昵称 |
| `avatar_url` | `varchar(500)` | 是 | 否 | 否 | 无 | 用户头像地址 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 资料创建时间 |
| `updated_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 资料更新时间 |

### 3. 会话表

- 中文表名：会话
- 英文表名：`conversations`
- 作用：保存用户的聊天会话及其状态信息

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 否 | 无 | 会话唯一标识 |
| `user_id` | `uuid` | 否 | 否 | 是 | 无 | 所属用户 ID |
| `title` | `varchar(100)` | 否 | 否 | 否 | 无 | 会话标题，可自动生成后修改 |
| `system_prompt` | `text` | 是 | 否 | 否 | 无 | 会话级提示词，保存 Markdown 文本 |
| `status` | `conversation_status` | 否 | 否 | 否 | `active` | 会话状态，区分正常与归档 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 会话创建时间 |
| `updated_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 会话更新时间 |

### 4. 消息表

- 中文表名：消息
- 英文表名：`messages`
- 作用：保存会话中的单条聊天消息

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 否 | 无 | 消息唯一标识 |
| `conversation_id` | `uuid` | 否 | 否 | 是 | 无 | 所属会话 ID |
| `sender_type` | `message_sender_type` | 否 | 否 | 否 | 无 | 消息发送者类型 |
| `content` | `text` | 否 | 否 | 否 | 无 | 消息内容 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 消息发送时间 |

### 5. 收藏表

- 中文表名：收藏
- 英文表名：`favorites`
- 作用：保存用户对消息的收藏关系

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 否 | 无 | 收藏记录唯一标识 |
| `user_id` | `uuid` | 否 | 否 | 是 | 无 | 执行收藏操作的用户 ID |
| `message_id` | `uuid` | 否 | 否 | 是 | 无 | 被收藏的消息 ID |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 收藏时间 |

### 6. 搜索记录表

- 中文表名：搜索记录
- 英文表名：`search_records`
- 作用：保存用户执行过的搜索行为

| 字段名 | 类型 | 可空 | 主键 | 外键 | 默认值 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | 否 | 是 | 否 | 无 | 搜索记录唯一标识 |
| `user_id` | `uuid` | 否 | 否 | 是 | 无 | 执行搜索的用户 ID |
| `keyword` | `varchar(100)` | 否 | 否 | 否 | 无 | 搜索关键词 |
| `created_at` | `timestamptz` | 否 | 否 | 否 | `now()` | 搜索时间 |

---

## 三、主键与外键设计

### 主键

- `auth.users.id`
- `profiles.user_id`
- `conversations.id`
- `messages.id`
- `favorites.id`
- `search_records.id`

### 外键

- `profiles.user_id -> auth.users.id`
- `conversations.user_id -> auth.users.id`
- `messages.conversation_id -> conversations.id`
- `favorites.user_id -> auth.users.id`
- `favorites.message_id -> messages.id`
- `search_records.user_id -> auth.users.id`

---

## 四、约束设计

### 1. 唯一约束

- `auth.users.email` 唯一，用于保证邮箱不重复
- `favorites(user_id, message_id)` 唯一，用于保证同一用户对同一消息只能收藏一次

### 2. 枚举约束

- `conversations.status` 只能取 `active`、`archived`
- `messages.sender_type` 只能取 `user`、`assistant`

### 3. 非空约束

以下核心字段必须非空：

- 用户标识字段
- 会话归属字段
- 会话标题
- 消息归属字段
- 消息发送者类型
- 消息内容
- 收藏关联字段
- 搜索关键词

---

## 五、删除策略

删除策略需要与当前产品需求保持一致。

### 1. 删除会话

当用户删除会话时，应同时删除该会话下的所有消息，以及由这些消息产生的收藏记录。

建议策略：

- `messages.conversation_id` 使用级联删除
- `favorites.message_id` 使用级联删除

这样可以保证：

- 删除会话后不会残留孤立消息
- 删除消息后不会残留失效收藏

### 2. 删除归档会话

归档会话本质上仍是普通会话，只是状态不同。

因此从归档区域删除会话时，应遵循与普通会话相同的删除策略。

### 3. 删除用户

当前阶段不把“删除用户”作为普通业务功能重点，但从数据库完整性角度，若用户被删除，其资料、会话、消息、收藏和搜索记录也应同步清理或统一由系统管理逻辑处理。

课程文档中可写为：

- 用户相关数据应保持引用完整性
- 用户删除策略由系统级管理逻辑统一控制

---

## 六、索引设计

### 1. 用户表索引

- `auth.users.email`

作用：

- 支撑登录身份唯一性与认证查询

### 2. 会话表索引

- `conversations.user_id`
- `conversations.updated_at`
- `conversations(user_id, status)`

作用：

- 支撑按用户查询会话
- 支撑按更新时间排序
- 支撑正常会话与归档会话分区查询

### 3. 消息表索引

- `messages.conversation_id`
- `messages.created_at`
- `messages(conversation_id, created_at)`

作用：

- 支撑按会话读取消息
- 支撑按时间排序消息

### 4. 收藏表索引

- `favorites.user_id`
- `favorites.message_id`
- `favorites(user_id, message_id)` 唯一索引

作用：

- 支撑按用户读取收藏
- 支撑消息收藏关系查询
- 保证不重复收藏

### 5. 搜索记录表索引

- `search_records.user_id`
- `search_records.created_at`

作用：

- 支撑按用户查看搜索记录
- 支撑按时间排序搜索行为

---

## 七、关系模式总结

可将当前关系模式概括为：

- `auth.users(id, email, created_at, ...)`
- `profiles(user_id, display_name, avatar_url, created_at, updated_at)`
- `conversations(id, user_id, title, system_prompt, status, created_at, updated_at)`
- `messages(id, conversation_id, sender_type, content, created_at)`
- `favorites(id, user_id, message_id, created_at)`
- `search_records(id, user_id, keyword, created_at)`

---

## 八、一句话总结

当前关系模式已经能够支撑用户身份管理、会话持久化、消息记录、消息收藏、搜索行为记录等核心需求；其中 `Phase 3` 首批实现应优先落地 `auth.users / profiles / conversations / messages`，并以此作为后续 Supabase migration 与课程文档撰写的直接基础。
