---
aliases:
  - useChatWorkspace 状态流
---

# useChatWorkspace 状态流说明

这篇笔记帮助我们理解 `useChatWorkspace` 如何协调会话、模型、草稿控制项与工作区错误状态。

代码入口：
- `src/features/chat/hooks/use-chat-workspace.ts`

关联笔记：
- [[use-chat-workspace]]
- [[chatshell-stateflow]]

## 1. 状态来源

这个 hook 的状态来源可以分成三层：

- 服务端首屏传入：
  - `initialConversations`
  - `initialModels`
- 当前 hook 自己维护的工作区状态
- 通过参数传入的消息缓存同步函数：
  - `syncConversationMessages`
  - `removeConversationMessages`

因此它本身不拥有消息数组，但会决定“当前该同步哪一个会话的消息快照”。

---

## 2. 当前自身维护的状态

当前重点状态包括：

- `conversations`
- `activeConversationId`
- `availableModels`
- `draftModelId`
- `draftSystemPrompt`
- `draftWebSearchEnabled`
- `draftThinkingLevel`
- `workspaceError`
- `isCreatingConversation`
- `isDeletingConversationId`
- `isArchivingConversationId`
- `isRestoringConversationId`
- `isLoadingArchivedConversations`
- `isLoadingFavoriteConversations`
- `isLoadingConversation`

这些状态共同描述的是：

- 当前工作区正在看哪个会话
- 当前有哪些可用模型
- 当前草稿控制项是什么
- 当前是否在做某类会话操作

---

## 3. 两个关键派生值

在这些原始状态之上，当前还会推导出：

- `selectedModelId`
- `currentSystemPrompt`
- `currentWebSearchEnabled`
- `currentThinkingLevel`

推导规则是：

- 如果当前已进入真实会话，则优先用当前会话上的配置
- 如果当前还是空白工作区，则回退到草稿模型、草稿提示词、草稿联网开关和草稿思考档位

这个规则决定了：

- 为什么首页试选模型和提示词不会立刻写库
- 为什么发送第一条消息后这些控制项会自然变成会话级配置
- 为什么首页先切联网开关，也会在建会话时一并落库
- 为什么首页先选思考档位，也会在建会话时一并落库

---

## 4. 两个关键 useEffect

### 4.1 模型列表同步

挂载后会请求：

- `/api/models`

作用：

- 获取数据库里当前最新启用模型
- 如果当前草稿模型还存在，就继续保留
- 否则回退到默认模型

### 4.2 当前会话详情同步

当 `activeConversationId` 变化时，会请求：

- `/api/conversations/:conversationId`

作用：

- 同步消息快照
- 同步标题、`modelId`、`systemPrompt`、`webSearchEnabled`、`thinkingLevel`
- 更新当前会话在列表里的真实状态

### 4.3 收藏区和归档区静默预取

登录后的工作区会尝试在后台加载收藏会话和归档会话。

作用：

- 用户第一次打开收藏区或归档区时更快看到内容
- 静默加载失败时不打断聊天主链路
- 用户主动打开二级菜单时仍会触发一次带反馈的刷新

---

## 5. 关键行为链路

### 5.1 新建会话

1. `handleCreateConversation()`
2. 内部调用 `createConversation()`
3. `POST /api/conversations`
4. 成功后：
   - `upsertConversation()`
   - `syncConversationMessages(newId, [])`
   - `setActiveConversationId(newId)`

### 5.2 模型切换

1. 如果当前还没有真实会话：
   - 只更新 `draftModelId`
2. 如果当前已有会话：
   - 先乐观更新当前会话
   - 再 `PATCH /api/conversations/:id`
   - 失败则回滚

### 5.3 提示词保存

1. 如果当前还没有真实会话：
   - 只更新 `draftSystemPrompt`
2. 如果当前已有会话：
   - `PATCH /api/conversations/:id`
   - 成功后 `upsertConversation()`

### 5.4 联网开关切换

1. 如果当前还没有真实会话：
   - 只更新 `draftWebSearchEnabled`
2. 如果当前已有会话：
   - 先乐观更新当前会话上的 `webSearchEnabled`
   - 再 `PATCH /api/conversations/:id`
   - 失败则回滚

### 5.5 思考档位切换

1. 如果当前还没有真实会话：
   - 只更新 `draftThinkingLevel`
2. 如果当前已有会话：
   - 先乐观更新当前会话上的 `thinkingLevel`
   - 再 `PATCH /api/conversations/:id`
   - 失败则回滚

### 5.6 首条消息前确保会话存在

`ensureConversationId()` 的语义是：

- 如果已经有 `activeConversationId`，直接返回
- 如果没有，则带上草稿模型、草稿提示词、草稿联网开关和草稿思考档位先建会话

这就是当前“先选控制项，后发首条消息”的前端前置条件。

### 5.7 收藏和归档

收藏会话：

- 调用会话收藏接口
- 更新当前列表中的收藏状态
- 收藏区已加载时同步刷新收藏区

归档会话：

- 调用会话归档接口
- 从最近列表移除会话
- 如果归档的是当前会话，则切换到剩余会话或空白工作区

恢复归档：

- 调用归档恢复接口
- 从归档区移除会话
- 重新加入最近会话列表

---

## 6. 一句话总结

`useChatWorkspace` 的状态流本质上是：用“真实会话配置”和“空白页草稿配置”两套状态，拼出一个连续的聊天工作区编排层；同时把收藏、归档和后台预取纳入工作区层统一协调。
