# Search Records 扩展

需求来源：

- `phase_overview.md` 中 `Phase 4`
- `Phase 4.3` 曾短暂尝试会话搜索

状态：

- `withdrawn`
- 搜索入口与 `/api/conversations/search` 不进入产品主链路
- `20260427083000_phase4_conversation_organization.sql` 曾创建该实验对象
- `20260427091000_remove_conversation_search.sql` 用于清理相关函数与表
- Supabase 环境不应保留 `search_records` 与 `search_user_conversations`

当前实体：

- `search_records`（撤回）

当前字段：

- `id`
- `user_id`
- `query`
- `active_conversation_id`
- `matched_conversation_ids`
- `result_count`
- `created_at`

阶段判断：

- 当前产品判断认为会话搜索暂不需要进入 Phase 4.3 主链路
- 搜索记录不迁入 `10_verified/`
- 后续如果重新启用搜索，应重新评估入口位置、排序规则和搜索记录是否真的服务课程设计主线
