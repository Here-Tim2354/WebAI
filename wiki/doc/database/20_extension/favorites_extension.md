# Favorites 扩展设想

需求来源：

- `phase_overview.md` 中 `Phase 4`
- 收藏单条消息与收藏区管理能力

当前状态：

- `planned`
- 尚未进入当前已验证数据库主线

建议实体：

- `favorites`

建议最小字段：

- `id`
- `user_id`
- `message_id`
- `created_at`

当前判断：

- 收藏是围绕消息主线的扩展能力
- 只有在实际接口、页面和迁移同时进入主线后，才迁入 `10_verified/`
