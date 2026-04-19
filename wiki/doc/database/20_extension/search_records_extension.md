# Search Records 扩展设想

需求来源：

- `phase_overview.md` 中 `Phase 4`
- 搜索历史内容与搜索记录能力

当前状态：

- `planned`
- 尚未进入当前已验证数据库主线

建议实体：

- `search_records`

建议最小字段：

- `id`
- `user_id`
- `keyword`
- `created_at`

当前判断：

- 搜索记录属于围绕会话和消息的扩展行为数据
- 在搜索页面、接口和 migration 未统一落地前，不应写入已验证关系模式
