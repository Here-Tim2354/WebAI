# RLS 验证清单

## 当前重点

- [x] `profiles`
- [x] `conversations`
- [x] `messages`
- [x] `favorites`
- [x] `model_fetched`
- [x] `storage.objects` 中的 `message_attachments`
- [x] `storage.objects` 中的 `profile_avatars`

## 当前原则

- 用户只能访问自己的业务数据
- 业务隔离优先依赖数据库层 RLS，而不是只靠应用层过滤
- 模型注册表如面向所有登录用户可读，应明确只读边界

## 待确认

- [x] 当前模型注册表是否需要对 `authenticated` 角色开放只读策略
- [ ] 当前服务端访问路径是否全部通过服务端 client 承接

结论：

- `model_catalog` 已启用 RLS，但云端没有 `model_catalog` 的 SELECT policy；因此普通 `authenticated` 用户不能直接读取该表。
- 这与当前文档口径一致：`model_catalog` 是内部 Gemini 能力参照表，不作为用户模型列表直接暴露。
- 用户可见模型列表通过 `model_fetched` 承接，云端已配置 select / insert / update / delete own policy。

## 云端策略摘要

- `profiles`：用户只能 select / insert / update 自己的 `user_id`
- `conversations`：用户只能 select / insert / update / delete 自己的会话
- `messages`：通过所属 `conversations.user_id = auth.uid()` 判断 select / insert / update / delete 权限
- `favorites`：用户只能读取和删除自己的收藏；插入时还要求被收藏会话属于当前用户
- `model_fetched`：用户只能管理自己的模型列表
- `message_attachments`：Storage object 的第一层目录必须等于 `auth.uid()`
- `profile_avatars`：Storage object 的第一层目录必须等于 `auth.uid()`

## 云端核对记录

- `2026-05-20`：使用 Supabase CLI 导出远端 `public,storage` schema 后核对 RLS policy。
