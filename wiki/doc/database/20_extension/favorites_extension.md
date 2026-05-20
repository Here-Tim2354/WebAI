# Favorites 扩展

需求来源：

- `phase_overview.md` 中 `Phase 4`
- `Phase 4.3` 会话管理增强
- 收藏当前会话

状态：

- `verified extension`
- 对应 migration、代码路径与云端 schema 都围绕会话收藏展开
- `2026-05-20` 已通过 Supabase CLI 确认云端存在 `favorites`
- 收藏入口、头像菜单入口和收藏区空态需要在真实数据下保持清楚
- 是否迁入 `10_verified/` 等 Phase 4.3 多数据场景观察后再定

当前实体：

- `favorites`

当前字段：

- `id`
- `user_id`
- `conversation_id`
- `created_at`

当前约束：

- `favorites.id` 为主键
- `favorites.user_id -> auth.users.id on delete cascade`
- `favorites.conversation_id -> conversations.id on delete cascade`
- `favorites(user_id, conversation_id)` 唯一，避免同一用户重复收藏同一会话

当前索引：

- `favorites_conversation_id_idx`
- `favorites_user_id_created_at_idx`

阶段判断：

- 当前收藏对象是会话，不是单条消息
- `favorites(user_id, conversation_id)` 保持唯一，避免同一用户重复收藏同一会话
- 侧栏最近对话排序不因收藏改变
- 收藏状态服务当前会话控制区，以及用户头像菜单中的收藏区
- 收藏区支持查看收藏会话并点击跳转
- 后续仍需观察多条收藏数据下的排序与跳转体验
