# Favorites 扩展

需求来源：

- `phase_overview.md` 中 `Phase 4`
- `Phase 4.3` 会话管理增强
- 收藏当前会话

当前状态：

- `local implementation`
- 已进入本地 migration 与代码接线
- 已推送远端 Supabase
- browser-use 已完成首轮入口与空态验收
- 是否迁入 `10_verified/` 等 Phase 4.3 多数据场景观察后再定

当前实体：

- `favorites`

当前字段：

- `id`
- `user_id`
- `conversation_id`
- `created_at`

当前判断：

- 当前收藏对象是会话，不是单条消息
- `favorites(user_id, conversation_id)` 保持唯一，避免同一用户重复收藏同一会话
- 侧栏最近对话排序不因收藏改变
- 收藏状态服务当前会话控制区，以及用户头像菜单中的收藏区
- 收藏区支持查看收藏会话并点击跳转
- 首轮浏览器验收已确认收藏入口、头像菜单入口和收藏区空态
- 后续仍需观察多条收藏数据下的排序与跳转体验
