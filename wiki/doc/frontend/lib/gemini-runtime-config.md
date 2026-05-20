# `src/features/chat/lib/gemini-runtime-config.ts`

## 文件定位

这个文件管理用户本机的 Gemini API Key 和 Base URL。它不是数据库状态，而是浏览器 `localStorage` 状态。

调用位置：[[components/chat-shell|ChatShell]] 和 [[hooks/use-fetched-models|useFetchedModels]]。

## 核心函数

- `normalizeGeminiRuntimeConfig(config)`：去掉空白，只保留非空 `apiKey` 和 `baseUrl`。
- `loadStoredGeminiRuntimeConfig(userId)`：从 `localStorage` 读取并 normalize。
- `removeStoredGeminiRuntimeConfig(userId)`：清除当前用户和旧版 legacy key。
- `useGeminiRuntimeConfig(userId)`：Hook，返回配置、保存函数和清除函数。

## `useEffect` 解析

当 `userId` 变化时，用 `queueMicrotask` 读取本地配置。没有用户时清空配置；有用户时使用 `webai.gemini.runtimeConfig.${userId}` 这个 key。

## 设计缘由

Gemini Key / URL 按用户隔离，但不进数据库。这样同一台浏览器不同账号不会误用上一位用户的 Key，同时也避免把私人运行时配置持久化到远端。

## 返回规模

没有 UI。配置会进入聊天请求和模型拉取请求。

## 代码展开

### localStorage key

新 key 是：

```txt
webai.gemini.runtimeConfig.${userId}
```

旧 key 是：

```txt
webai.gemini.runtimeConfig
```

读取新配置时会移除旧 key，避免历史版本留下的全局 Key 继续影响当前用户。

### normalize 的意义

`normalizeGeminiRuntimeConfig` 会 trim 两个字段，并且只保留非空值。这使得保存空字符串等价于清除配置，不会在 localStorage 里留下 `{ apiKey: "" }` 这种半无效状态。

### useEffect 为什么用 queueMicrotask

`useGeminiRuntimeConfig` 在 userId 变化时用 `queueMicrotask` 再读 localStorage。它还能通过 `cancelled` 防止组件卸载或用户切换后继续写状态。

这里没有 SSR 读取，因为 `localStorage` 只存在浏览器。服务端首屏不会知道用户本机 Key。

### 保存和清除

`saveGeminiRuntimeConfig` 会先更新 React state，再写 localStorage。如果 normalized 后是空对象，就删除当前用户 key。

`clearGeminiRuntimeConfig` 同时清 state 和 localStorage。当前代码主要暴露了这个函数，后续如果账户切换或设置里需要清空 Key，可以直接使用。
