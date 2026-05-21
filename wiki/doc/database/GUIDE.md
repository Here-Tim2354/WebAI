# Database 文档索引

需求基线：

- [[plan/phase/phase_overview|phase_overview]]

## 需求口径

- [[doc/database/00_contract/user_requirements|user_requirements]]
- [[doc/database/00_contract/user_data_dictionary|user_data_dictionary]]
- [[doc/database/00_contract/entity_relationship_analysis|entity_relationship_analysis]]

## 数据库事实

- [[doc/database/10_verified/relation_schema_design|relation_schema_design]]
- [[doc/database/10_verified/verified_notes|verified_notes]]
- [[doc/database/overall_er_graph.dbml|overall_er_graph.dbml]]
- [[doc/database/overall_er_graph.sql|overall_er_graph.sql]]

## 扩展设想

- [[doc/database/20_extension/favorites_extension|favorites_extension]]
- [[doc/database/20_extension/search_records_extension|search_records_extension]]
- [[doc/database/20_extension/model_registry_extension|model_registry_extension]]
- [[doc/database/20_extension/message_attachments_extension|message_attachments_extension]]
- [[doc/database/20_extension/profile_avatars_extension|profile_avatars_extension]]

## 映射

- [[doc/database/30_mapping/feature_to_table_mapping|feature_to_table_mapping]]
- [[doc/database/30_mapping/api_to_table_mapping|api_to_table_mapping]]

## 验证

- [[doc/database/40_verification/migration_checklist|migration_checklist]]
- [[doc/database/40_verification/index_verification|index_verification]]
- [[doc/database/40_verification/rls_verification|rls_verification]]
- [[doc/database/40_verification/schema_diff_log|schema_diff_log]]

## 推荐阅读顺序

1. [[plan/phase/phase_overview|phase_overview]]
2. [[doc/database/00_contract/user_requirements|user_requirements]]
3. [[doc/database/00_contract/user_data_dictionary|user_data_dictionary]]
4. [[doc/database/00_contract/entity_relationship_analysis|entity_relationship_analysis]]
5. [[doc/database/10_verified/relation_schema_design|relation_schema_design]]
6. [[doc/database/30_mapping/feature_to_table_mapping|feature_to_table_mapping]]
7. [[doc/database/40_verification/migration_checklist|migration_checklist]]

## 数据库状态

- 已于 `2026-05-20` 通过 Supabase CLI 对云端项目 `webai_base`（ref: `ekswdwnxsugmtkdxfmnd`）导出并核对 `public` / `storage` schema
- 云端 `public` 业务表当前包括：`profiles`、`conversations`、`messages`、`favorites`、`model_catalog`、`model_fetched`
- `search_records` 和旧 `search_user_conversations` 不存在于当前云端 schema，应继续视为已撤回搜索方向，不进入当前数据库说明主线
- Supabase 环境采用 `model_catalog + model_fetched` 的 Gemini-only 模型结构
- `model_catalog` 是服务端内部能力参照表，不作为用户模型列表直接暴露
- `model_fetched` 是用户通过 Gemini 设置拉取后的模型列表，支持启用 / 停用和默认模型选择
- 默认能力目录预期包含 8 条 Gemini seed：`gemini-3.5-flash`、`gemini-3-flash-preview`、`gemini-3-pro-preview`、`gemini-3.1-pro-preview`、`gemini-3.1-flash-lite-preview`、`gemini-2.5-pro`、`gemini-2.5-flash`、`gemini-2.5-flash-lite`
- Storage bucket 当前包括公开图标 bucket `ai_svgs`，以及私有 bucket `message_attachments`、`profile_avatars`
- 用户头像使用私有 Storage bucket `profile_avatars`，展示资料仍落在 `profiles`
