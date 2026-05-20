# `src/features/chat/hooks/use-chat-session.ts`

## 文件定位

`useChatSession` 是消息会话级 Hook。它不管会话列表，也不管模型列表；它负责每个会话的消息缓存、URL 草稿、附件草稿和流式任务。

调用位置：[[components/chat-shell|ChatShell]]。

## 核心状态

- `conversationMessages`：`Record<conversationId, ChatMessage[]>`，本地消息缓存。
- `urlContextInputValue`、`urlContextUrls`：发送前的 URL Context 草稿。
- `draftAttachments`：发送前的附件草稿。
- `isUploadingAttachments`：附件上传锁。
- `isUrlContextPanelOpen`：输入区 URL 面板开关。
- `streamingTasks`：用于 UI 展示的流式任务快照。
- `streamingTasksRef`：保存真实 `AbortController` 和 assistant message id。

`streamingTasksRef` 用 ref 而不是 state，是因为中断生成需要拿到最新 controller，但不希望每次写入都触发复杂重渲染。

## 关键函数

基础消息缓存：

- `getMessages(conversationId)`：读取某个会话消息。
- `syncConversationMessages()`：同步服务端快照。如果当前会话正在流式生成，默认不覆盖，避免旧快照冲掉流式内容。
- `removeConversationMessages()`：删除本地缓存键。
- `updateConversationMessages()`：用 updater 形式保证异步场景下基于最新数组计算。
- `replaceMessage()`：替换 assistant 占位或追加消息。

流式任务：

- `beginStreamingTask()`：同一会话已有任务时直接拒绝。
- `updateStreamingAssistantMessageId()`：服务端创建真实 assistant 消息后，更新 cancel 目标。
- `endStreamingTask()`：清理 ref 和 UI 快照。
- `stopStreaming()`：请求 `/api/chat/cancel`，同时 abort 浏览器 fetch。

发送和再生成：

- `handleSubmit()`：普通发送，乐观插入 user 消息和 assistant 占位，再消费 `/api/chat` 流。
- `editMessageAndRegenerate()`：编辑 user 消息，截断后续上下文，调用 `PATCH /api/messages/:id` 并重新生成。
- `regenerateAssistantMessage()`：对最新 assistant 重新生成，调用 `/api/messages/:id/regenerate`。

## URL 与附件

- `addUrlContextUrl()`：标准化 URL、去重、限制最多 4 条。
- `removeUrlContextUrl()`：移除 URL。
- `uploadAttachments()`：把文件打包成 `FormData`，交给 `/api/attachments/upload`。

## 设计缘由

这个 Hook 的重点是会话级并发隔离：每个 conversationId 可以独立有一个 streaming task，不再用全局 submit lock 把整个工作区锁住。

另外，编辑和重新生成失败时会恢复旧消息列表，避免前端停在服务端没有接受的乐观状态。

## 返回规模

返回值主要供 `ChatShell` 分发给 `ChatInput`、`MessageList` 和 `MessageBubble`。它本身不渲染 UI。

## 代码展开

### 消息缓存为什么按 conversationId 分桶

`conversationMessages` 是一个对象：

```ts
Record<string, ChatMessage[]>
```

这样每个会话都有自己的本地消息数组。用户切换会话时，不需要把旧会话消息清空再覆盖；只要 `getMessages(activeConversationId)` 取当前桶即可。分支、新建、删除也都能按会话 ID 精确处理。

### streamingTasks 和 streamingTasksRef 的区别

`streamingTasks` 是给 UI 用的 state，里面只有 `assistantMessageId` 快照。`streamingTasksRef` 里才有真实 `AbortController`。

如果把 `AbortController` 放进 state，会让每次任务更新都触发渲染，而且 controller 本身不适合序列化或展示。用 ref 保存控制器，用 state 保存可展示快照，这个分层更合适。

### 普通发送链路

`handleSubmit` 的顺序是：

1. trim 正文，合并当前 URL 和附件草稿。
2. 如果正文、URL、附件都为空，直接返回。
3. 如果当前会话已有 streaming task，直接返回，避免同一会话重入。
4. 本地构造 user 消息和 assistant placeholder。
5. `beginStreamingTask` 注册 abort controller。
6. 本地乐观追加两条消息。
7. 清空 URL、附件和面板状态。
8. `fetch('/api/chat')`。
9. `consumeAssistantStream` 持续替换 assistant 消息。
10. finally 中 `endStreamingTask`。

这条链路的重点是：UI 先出现 user 消息和 assistant 占位，网络流回来后再逐步替换占位。

### 编辑并重新生成

`editMessageAndRegenerate` 会先保存 `previousMessages`。随后它在本地找到目标 user 消息，把该消息内容和 metadata 更新为编辑后的值，并截断后面的上下文，再追加新的 assistant placeholder。

服务端接受前端请求后，会执行同样语义：编辑目标 user 消息，删除后续消息，再重新生成 assistant。若服务端在接受请求前失败，前端用 `syncConversationMessages(..., { force: true })` 恢复旧消息，避免 UI 留在假状态。

如果服务端已经接受请求，但流式生成中途失败，则不会恢复旧上下文，而是把新 assistant 标成 error。这个区别很关键：请求是否被服务端接受，决定前端应该回滚还是展示新链路失败。

### 重新生成 assistant

`regenerateAssistantMessage` 和编辑类似，但它目标是 assistant 消息。前端会把目标 assistant 之前的消息保留，并追加新的 assistant placeholder。

如果用户在输入区临时放了新的 URL 或附件，重新生成会尝试覆盖“上一条 user 消息”的 metadata。服务端也会同步更新这条 user 消息，保证历史记录和 UI 一致。

### 取消生成

`stopStreaming` 做两件事：

```ts
fetch('/api/chat/cancel', { conversationId, assistantMessageId })
task.abortController.abort()
```

第一个动作通知服务端停止模型流并把消息写成 cancelled；第二个动作让浏览器 reader 尽快结束。两者都需要，因为只 abort 前端 fetch 不一定能及时影响服务端生成。

如果前端捕获到 AbortError，会调用 `markAssistantMessageCancelled`。它会尽量找到正在 pending/streaming 的 assistant 消息，并用 `createCancelledAssistantMessage` 保留已有内容、改掉状态。

### syncConversationMessages 的保护

如果某个会话正在 streaming，默认 `syncConversationMessages` 不覆盖它。原因是会话详情请求可能在流式输出期间返回旧快照，如果直接覆盖，用户正在看的增量回复会被数据库旧状态冲掉。

只有传入 `{ force: true }` 时才强制覆盖，通常用于失败回滚。
