# Migration 验证清单

## 主线表

- [x] `profiles`
- [x] `conversations`
- [x] `messages`
- [x] `model_catalog`
- [x] `model_fetched`
- [x] `conversations.web_search_enabled`
- [x] `20260505023000_phase4_gemini_only_model_registry.sql`
- [x] `20260505043000_phase4_model_catalog_and_fetched.sql`

## 验证项

- [x] migration 文件是否与查询路径一致
- [x] 表名、字段名和代码 `select` 字段一致
- [x] 默认值和非空约束与业务语义一致
- [x] 删除策略与业务语义一致
- [x] `model_catalog` 与 `model_fetched` 的职责边界已明确
- [x] `model_fetched` 默认模型约束已按用户维度明确
- [x] `model_fetched.provider` 约束为 `gemini`
- [x] `model_fetched.api_style` 约束为 `gemini_native`
- [x] 会话级联网搜索字段位于 `conversations`

## 缺口

- [ ] 更多 `Gemini` 常用模型 seed 仍未补齐
- [ ] RLS advisor 与性能 advisor 的遗留项仍需单独收口
- [ ] 用户手动编辑模型能力的交互仍未补齐

## 原则

- migration、查询路径和接口契约没有对齐前，不把字段写入 `10_verified/`
- 文档与 migration 发生冲突时，先回到需求基线和现有实现核对
