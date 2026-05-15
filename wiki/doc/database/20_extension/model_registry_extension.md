# 模型注册表扩展

需求来源：

- `phase_overview.md` 中 `Phase 4`
- Gemini 模型注册表、模型能力扩展、会话级模型选择

## 系统边界

模型注册表采用 Gemini-only 边界：

- `model_catalog` 保存内部 Gemini 能力目录
- `model_fetched` 保存用户通过 API Key / URL 拉取到的模型列表
- 上层统一映射为 `AIModel`
- 前端模型选择只读取用户已启用的 `model_fetched`
- `model_catalog` 不作为用户模型列表直接暴露，只作为能力补全参照
- 用户 API Key 与 Base URL 不进入数据库，只保存在本机浏览器并随请求临时传入
- 同一用户的模型列表按 `model_id` 去重；重复拉取同一上游模型时刷新能力、名称和来源信息，不再因为 Base URL 不同而保留多条可选项

## 能力补全规则

`model_fetched.model_id` 能对应到 `model_catalog.model_id` 时，系统使用 catalog 中的能力参数补全模型信息。

这条规则服务两个目标：

- 让官方或常用 Gemini 模型拥有稳定的联网、视觉、文件、thinking 等能力标识
- 让用户拉取到的新模型可以展示在设置列表中，但在能力未知时不直接进入聊天可调用集合

不支持的模型可以保留在列表中用于观察端点返回内容，但不能启用为聊天模型，也不能设置为默认模型。

## 默认模型边界

默认模型承担系统兜底入口，不应被用户删除。

默认模型在用户私有列表中表现为 `model_fetched` 记录，便于用户启用、停用和选择，但这些记录的能力来源仍以 `model_catalog` 为准。

## 扩展层内容

以下内容应继续视为扩展字段或候选规划，不直接写进 `10_verified/`：

- 更完整的上游模型元数据镜像
- Gemini 调参模板和默认参数
- 模型分组、展示分区和推荐策略
- 用户手动编辑单个模型能力
- 更细的模型分组和推荐策略

## 建议

- 逻辑层继续把它视为 Gemini-only 模型注册系统
- 物理层区分内部 `model_catalog` 和用户侧 `model_fetched`
- 模型注册表不保存用户私有 API Key
- 拉取到的新模型进入用户私有 `model_fetched`，再由用户决定启用 / 停用
- `base_url` 记录模型来自哪个 Gemini 端点，但当前唯一语义以 `user_id + model_id` 为准
