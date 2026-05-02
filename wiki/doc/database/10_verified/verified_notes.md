# 数据库范围说明

这篇笔记帮助我们快速判断某项数据库设计处于什么状态。

## 数据库主线

- 会话 CRUD
- 消息持久化与恢复
- `profiles` 作为用户资料扩展表
- `ai_models` 作为模型注册表父表
- `openai_compatible_models` / `gemini_models` 作为 provider 子表
- 前端模型选择读取已启用模型列表
- 服务端按 `modelId` 分发到对应 provider
- Supabase 环境采用模型注册表父子表结构
- 首个模型 seed 为 `Gemini 3 Flash Preview`

## 暂不进入数据库主线

- 收藏表与收藏链路
- 搜索记录表与搜索页面
- 管理员看板与封号能力
- 模型注册表里未进入代码主查询路径的扩展元数据

## 判断规则

- 如果 migration、查询代码、接口契约三者都能对上，就可以进入 `10_verified/`
- 如果只是需求存在或未来准备做，只能进入 `20_extension/`
