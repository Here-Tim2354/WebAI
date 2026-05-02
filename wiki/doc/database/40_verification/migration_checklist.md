# Migration 验证清单

## 主线表

- [x] `profiles`
- [x] `conversations`
- [x] `messages`
- [x] `ai_models`
- [x] `openai_compatible_models`
- [x] `gemini_models`
- [x] `conversations.web_search_enabled`

## 验证项

- [x] migration 文件是否与查询路径一致
- [x] 表名、字段名和代码 `select` 字段一致
- [x] 默认值和非空约束与业务语义一致
- [x] 删除策略与业务语义一致
- [x] 模型注册表父表与子表外键关系已明确
- [x] 模型注册表默认模型约束已明确
- [x] 若采用破坏式重建，需确认 `openai_compatible_models` 与 `gemini_models` 可直接删除重建
- [x] 父表 `ai_models` 作为统一入口，子表仅保留 provider 专属字段
- [x] 会话级联网搜索字段位于 `conversations`

## 缺口

- [ ] `OpenAI compatible` 首批 seed 仍未补齐
- [ ] 更多 `Gemini` 常用模型 seed 仍未补齐
- [ ] RLS advisor 与性能 advisor 的遗留项仍需单独收口
- [ ] `Gemini URL Context` 的前端输入入口与结果展示仍未补齐

## 原则

- migration、查询路径和接口契约没有对齐前，不把字段写入 `10_verified/`
- 文档与 migration 发生冲突时，先回到需求基线和现有实现核对
