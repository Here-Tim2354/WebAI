# `src/features/chat/lib/chat-stream.ts`

## 文件定位

`chat-stream.ts` 是前端消费聊天 NDJSON 流的工具层。它被 [[hooks/use-chat-session|useChatSession]] 的发送、编辑、重新生成三条链路共用。

## 核心职责

- 判断 abort 错误。
- 合并 assistant 消息增量。
- 创建 cancelled assistant 消息。
- 读取 `Response.body`，逐行解析服务端事件。

## 关键函数

- `isAbortError(error)`：兼容 `DOMException` 和普通 `Error` 的 AbortError。
- `mergeAssistantMessageParts(previousMessage, nextMessage)`：根据服务端快照计算 `parts`。如果新内容是旧内容前缀扩展，就只把新增文本作为新 part；如果不是单调增长，就重建完整 part。
- `createCancelledAssistantMessage(message)`：把 assistant 状态改成 `cancelled`，同时把 `metadata.thinking.status` 也改成 cancelled。
- `consumeAssistantStream(options)`：真正读流。

## 流消费逻辑

`consumeAssistantStream` 用 `reader.read()` 读 Uint8Array，用 `TextDecoder` 解码。因为一条 JSON 可能被切成多个 chunk，所以文件里维护了 `buffer`，只处理完整换行。

支持的事件：

- `assistant-message-created`
- `assistant-message-updated`
- `conversation-updated`
- `done`

每个事件都先经过 `chatStreamEventSchema.parse`，这能让前端在运行时也守住数据形状。

## 设计缘由

发送、编辑、重新生成虽然入口不同，但服务端返回的都是同一种事件流。把流消费器抽出来，能避免三条链路各写一套 reader / decoder / replace 逻辑。

## 返回规模

工具函数不渲染 UI。`consumeAssistantStream` 最后返回当前 assistant message id 和最新 assistant 消息，用于 `useChatSession` 做取消、错误和任务清理。

## 代码展开

### assistant message id 为什么会变化

前端一开始创建的是本地 assistant placeholder，有一个临时 id。服务端真正写入数据库后，会发 `assistant-message-created` 事件，里面带数据库消息 id。

`applyAssistantMessageSnapshot(parsedEvent.message, assistantPlaceholder.id)` 会用真实消息替换本地 placeholder，并通过 `onAssistantMessageIdChanged` 通知 `useChatSession`。这一步对取消生成很重要：取消接口需要带真实 assistantMessageId，不能一直拿临时 id。

### parts 合并的目的

`mergeAssistantMessageParts` 不只是复制 content。它会尽量保留每次新增片段，方便消息气泡做本地 reveal。

如果新内容是旧内容前缀扩展，就把追加部分作为新的 text part。如果新内容不是旧内容前缀，说明发生了回退、重算或完整快照覆盖，就放弃旧 parts，用完整 content 重建。

### trailing buffer

流结束时 buffer 里可能还剩一条没有换行的 JSON。代码会在 while 之后检查 `trailingLine`，如果是 `done` 事件，也会应用最后的消息和会话快照。

这个兜底避免服务端最后一行没带 `\n` 时丢掉最终状态。

### 错误会在哪里抛出

`consumeAssistantStream` 里 `JSON.parse` 和 `chatStreamEventSchema.parse` 都可能抛错。它不在这里吞掉错误，而是交给 `useChatSession` catch。这样发送、编辑、重新生成可以按各自语义决定回滚还是标 error。
