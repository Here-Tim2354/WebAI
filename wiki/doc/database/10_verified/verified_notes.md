# 数据库范围说明

这篇笔记帮助我们快速判断某项数据库设计处于什么状态。

## 数据库主线

- 会话 CRUD
- 消息持久化与恢复
- `profiles` 作为用户资料扩展表
- `favorites` 作为会话收藏表，已经存在于云端 schema，但在课程设计叙事中仍属于会话管理增强能力
- `model_catalog` 作为内部 Gemini 能力目录
- `model_fetched` 作为用户可启用 / 停用的 Gemini 模型列表
- 前端模型选择读取已启用模型列表
- 服务端按 `model_fetched.id` 解析 Gemini 上游模型名
- Supabase 环境采用 Gemini-only `model_catalog + model_fetched` 模型结构
- 云端 `model_catalog` 当前有 7 条 Gemini seed，默认模型模板为 `Gemini 3 Flash Preview`
- `messages.metadata` 已进入云端表结构，用于保存 URL Context、附件和 thinking 等消息级上下文

## 暂不进入数据库主线

- 搜索记录表与搜索页面；`search_records` 不存在于当前云端 schema
- 管理员看板与封号能力
- 模型注册表里未进入代码主查询路径的扩展元数据

## 判断规则

- 如果 migration、查询代码、接口契约三者都能对上，就可以进入 `10_verified/`
- 如果只是需求存在或未来准备做，只能进入 `20_extension/`
