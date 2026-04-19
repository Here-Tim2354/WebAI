# Migration 验证清单

## 当前主线表

- [ ] `profiles`
- [ ] `conversations`
- [ ] `messages`
- [ ] `ai_models`
- [ ] `openai_compatible_models`
- [ ] `gemini_models`

## 验证项

- [ ] migration 文件是否与当前代码查询路径一致
- [ ] 表名、字段名和代码 `select` 字段一致
- [ ] 默认值和非空约束与当前业务一致
- [ ] 删除策略与当前业务一致
- [ ] 模型注册表父表与子表外键关系已明确
- [ ] 模型注册表默认模型约束已明确

## 当前原则

- migration 未验证前，不把字段写入 `10_verified/`
- 文档与 migration 发生冲突时，先回到需求基线和现有实现核对
