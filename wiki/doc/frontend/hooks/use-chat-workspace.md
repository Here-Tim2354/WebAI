# `src/features/chat/hooks/use-chat-workspace.ts`

## 文件定位

`useChatWorkspace` 是工作区级 Hook。它不管输入框文本，也不直接消费模型流；它负责会话、模型、草稿控制项和会话级设置。

调用位置：[[components/chat-shell|ChatShell]]。

## 核心状态

会话列表：

- `conversations`：active 会话列表。
- `archivedConversations`：归档区列表。
- `favoriteConversations`：收藏列表。
- `activeConversationId`：当前激活会话。

动作锁：

- `isCreatingConversation`
- `isDeletingConversationId`
- `isArchivingConversationId`
- `isRestoringConversationId`
- `isLoadingArchivedConversations`
- `isLoadingFavoriteConversations`
- `isTogglingFavorite`
- `isLoadingConversation`

模型和草稿控制项：

- `availableModels`
- `draftModelId`
- `draftSystemPrompt`
- `draftWebSearchEnabled`
- `draftThinkingLevel`

草稿控制项是空白首页的关键设计：用户还没真正发送第一条消息前，模型、提示词、联网、thinking 不落库。

## 派生值

- `activeConversation`：从 active / archived / favorite 三份列表里找当前会话。
- `selectedModel` / `selectedModelId`：当前会话模型优先，否则用草稿模型，再否则用默认模型。
- `currentSystemPrompt`、`currentWebSearchEnabled`、`currentThinkingLevel`：同样遵守“真实会话优先，空白草稿兜底”。

## 关键函数

- `sortConversations()`：按 `updatedAt` 倒序。
- `upsertConversation()`：列表里有则更新，无则插入。
- `createConversation()`：客户端先生成 UUID 做乐观会话，再请求 `/api/conversations`。
- `handleDeleteConversation()`：乐观删除，失败时回滚三份列表和激活会话。
- `patchConversationControls()`：会话级模型、提示词、联网、thinking 的统一 PATCH。
- `handleSelectModel()`、`saveSystemPrompt()`、`toggleWebSearchEnabled()`、`handleSelectThinkingLevel()`：有会话就 PATCH，没会话就写草稿。
- `handleBranchConversation()`：调用分支接口，返回完整会话快照后同步会话和消息。
- `ensureConversationId()`：发送首条消息前兜底创建真实会话，并消费草稿控制项。
- `resetAfterSignOut()`：退出登录后清空工作区。

## `useEffect` 解析

- 首次挂载拉 `/api/models`，校正模型列表和草稿默认模型。
- `activeConversationId` 变化时拉 `/api/conversations/:id`，同步会话详情和完整消息快照。
- 登录后后台预取归档区和收藏区。

这些 effect 都有明确边界：模型刷新、会话详情刷新、二级列表预取。

## 设计缘由

这个 Hook 的价值在于把“会话级语义”从 `ChatShell` 中拿出来。否则 `ChatShell` 会同时处理侧栏、发送、消息流、模型、提示词和弹窗，后续几乎没法读。

## 返回规模

返回值很多，但分组很清楚：列表、当前选择、loading 状态、错误状态、会话动作和控制项动作。

## 代码展开

### 为什么会有三份会话列表

`conversations`、`archivedConversations`、`favoriteConversations` 不是同一数组的不同过滤结果，而是三份按需加载的列表视图。这样 active 侧栏不需要一开始拉完整历史，归档和收藏可以在打开弹窗时刷新。

代价是：收藏、归档、恢复、删除时要同时维护多份列表。比如 `handleToggleFavoriteConversation` 会根据当前会话是否 archived，决定更新 `conversations` 还是 `archivedConversations`，然后再用 `syncFavoriteConversation` 更新收藏列表。

### 乐观创建会话

`createConversation` 先在浏览器生成 UUID：

```ts
const conversationId = crypto.randomUUID();
```

随后立刻构造 `optimisticConversation`，写进侧栏，并同步一份空消息数组。这一步让用户点击“新对话”后马上看到侧栏变化，而不是等待接口。

请求失败时，它会做三件回滚：

1. 从 active / archived / favorite 列表移除乐观会话。
2. 删除这条会话的本地消息缓存。
3. 如果当前激活会话正是这个乐观 ID，就恢复到之前的 active id。

这里的 `optimisticConversationIds` 还有一个作用：当 activeConversationId 指向刚创建的乐观会话时，拉详情的 effect 不会立刻请求 `/api/conversations/:id`。否则会出现“会话还没写入数据库，详情接口先 404”的竞态。

### 激活会话 effect

`activeConversationId` 变化后，会请求：

```txt
GET /api/conversations/:conversationId
```

返回的是会话快照和消息快照。Hook 收到后同时做：

- `syncConversationMessages(conversationId, parsed.messages)`
- `upsertConversation(parsed.conversation)`

这样切换会话时，标题、system prompt、模型、消息都以服务端为准。effect 里用 `cancelled` 标记处理快速切换：如果用户连续点了两个会话，旧请求回来时不会覆盖新会话状态。

### 会话级控制项的草稿语义

`handleSelectModel`、`saveSystemPrompt`、`toggleWebSearchEnabled`、`handleSelectThinkingLevel` 都有同一个分支：

```txt
如果 activeConversationId 不存在，写草稿；
如果存在真实会话，PATCH 数据库。
```

这让空白首页可以先选模型、写提示词、开关联网、选 thinking 档位，但不会在数据库里制造一堆空会话。真正发送第一条消息时，`ensureConversationId` 才调用 `createConversation({ consumeDraftControls: true })`，把草稿一次性落库。

### 删除会话为什么要保存 previous 状态

`handleDeleteConversation` 先乐观移除列表，然后请求 DELETE。它在移除前保存：

- `previousConversations`
- `previousArchivedConversations`
- `previousFavoriteConversations`
- `previousActiveConversationId`

如果接口失败，就把这些完整恢复。这里没有只恢复某一个列表，是因为目标会话可能同时存在于收藏列表，也可能当前正在归档视图里。完整快照回滚比局部推断更稳。

### 分支会话

`handleBranchConversation` 调用：

```txt
POST /api/conversations/:conversationId/branch
```

它返回的是 `chatSessionResponseSchema`，也就是“新会话 + 新消息列表”。Hook 收到后立即 `upsertConversation`、`syncConversationMessages`、`setActiveConversationId`。这样用户创建分支后会直接进入新会话，不需要再等待一次详情拉取。
