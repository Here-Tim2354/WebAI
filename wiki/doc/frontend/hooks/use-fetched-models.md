# `src/features/chat/hooks/use-fetched-models.ts`

## 文件定位

`useFetchedModels` 管 Gemini 设置弹窗里的远端模型列表。它和 `useChatWorkspace` 的关系是：完整 fetched models 留给设置弹窗，已启用 models 同步给聊天顶部模型选择。

调用位置：[[components/chat-shell|ChatShell]]。

## 核心状态

- `fetchedModels`：用户私有 fetched model 列表。
- `isLoadingFetchedModels`：读取列表。
- `isFetchingGeminiModels`：正在向 Gemini 拉取模型。
- `updatingFetchedModelId`：正在启停、设默认或删除的模型 id。

## 关键函数

- `syncFetchedModelState(models)`：同时更新 `fetchedModels`，并把 `models.filter(model => model.isEnabled)` 同步给 `useChatWorkspace`。
- `loadFetchedModels()`：GET `/api/models/fetched`。
- `fetchGeminiModels(config)`：先 normalize 并保存运行时配置，再 POST `/api/models/gemini/fetch`。
- `updateFetchedModel(modelId, updates)`：PATCH `/api/models/fetched/:id`。
- `deleteFetchedModel(modelId)`：DELETE `/api/models/fetched/:id`。

## `useEffect` 解析

`enabled` 为 true 时自动 `loadFetchedModels()`。这里的 `enabled` 通常等于是否已登录。

## 设计缘由

启用、默认和删除都让服务端返回完整列表，前端不局部猜测结果。因为默认模型唯一、不支持模型不可启用、保护模型不可删除这些规则更适合在服务端统一判断。

## 返回规模

返回 fetched model 列表、三个 loading 状态和四个动作函数。它不渲染 UI，UI 在 `ConversationSidebar` 的 Gemini 设置弹窗里。

## 代码展开

### 完整模型列表和可用模型列表

`fetchedModels` 是 Gemini 设置弹窗要展示的完整列表，里面可能有未启用、未命中 catalog、正在更新的模型。聊天顶部真正可选的模型不是它，而是：

```ts
models.filter((model) => model.isEnabled)
```

这一步在 `syncFetchedModelState` 里完成，并通过 `onAvailableModelsSynced` 通知 `useChatWorkspace`。

### 拉取模型为什么先保存 runtime config

`fetchGeminiModels(config)` 先调用 `normalizeGeminiRuntimeConfig`，并要求必须有 `apiKey`。随后会先 `onRuntimeConfigSaved(normalizedConfig)`，再请求 `/api/models/gemini/fetch`。

这样用户点击“拉取模型”时，Key / URL 同步成为后续聊天请求的本地配置。否则可能出现“拉取模型用了新 Key，但聊天仍用旧 Key”的割裂。

### 更新模型为什么不乐观改

`updateFetchedModel` 和 `deleteFetchedModel` 都等待服务端返回完整列表，再 `syncFetchedModelState`。这是因为模型设置里有服务端规则：默认模型唯一、保护模型不可删、不支持模型不可启用。前端如果自己乐观推断，很容易和服务端规则不一致。

### enabled effect

`useEffect` 只在 `enabled` 为 true 时自动加载。未登录时不请求 fetched models，因为这些模型是用户私有列表。
