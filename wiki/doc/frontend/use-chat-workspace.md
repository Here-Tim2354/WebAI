---
aliases:
  - useChatWorkspace
  - Chat 工作区编排层
---

# useChatWorkspace 说明

本文档用于理解 `useChatWorkspace` 在当前前端架构里的位置，以及它具体负责哪些工作区编排逻辑。

代码入口：
- `src/components/chat/use-chat-workspace.ts`

关联笔记：
- [[chatshell]]
- [[chatshell-stateflow]]
- [[conversation-sidebar]]
- [[message-list]]

## 1. 组件定位

`useChatWorkspace` 不是消息发送 hook，也不是纯展示组件。

它当前承担的是“聊天工作区编排层”的职责，主要负责：

- 会话列表状态
- 当前激活会话
- 模型列表同步
- 草稿控制项
- 会话级提示词、模型与联网搜索开关 patch
- 当前会话详情同步
- 工作区级错误状态

一句话说：

- `ChatShell` 管页面壳
- `useChatWorkspace` 管工作区编排
- `useChatSession` 管消息交互

---

## 2. 它维护的核心状态

当前 hook 内部维护的重点状态包括：

- `conversations`
- `activeConversationId`
- `availableModels`
- `draftModelId`
- `draftSystemPrompt`
- `draftWebSearchEnabled`
- `workspaceError`
- `isCreatingConversation`
- `isDeletingConversationId`
- `isLoadingConversation`

这些状态的共同特点是：

- 都和“当前聊天工作区处于什么会话、什么配置、什么加载阶段”有关
- 但不直接等于“消息流本身”

---

## 3. 它暴露给页面壳的能力

当前 `useChatWorkspace` 主要向 `ChatShell` 暴露这些能力：

- `handleCreateConversation`
- `handleRenameConversation`
- `handleDeleteConversation`
- `handleSelectModel`
- `saveSystemPrompt`
- `toggleWebSearchEnabled`
- `ensureConversationId`
- `upsertConversation`
- `resetAfterSignOut`

这说明它不只是“提供状态”，还负责：

- 创建 / 重命名 / 删除会话
- 同步当前会话配置
- 协调首条消息前的草稿控制项落库

---

## 4. 两个关键副作用

当前这个 hook 里有两个最关键的 `useEffect`。

### 4.1 模型列表刷新

挂载后会请求：

- `/api/models`

作用：

- 获取当前数据库里最新启用的模型集合
- 校正当前草稿模型或默认模型

### 4.2 当前会话详情加载

当 `activeConversationId` 变化时，会请求：

- `/api/conversations/:conversationId`

作用：

- 同步当前会话的消息快照
- 同步标题、`systemPrompt`、`modelId`、`webSearchEnabled`
- 避免首页一次性塞入所有历史消息

---

## 5. 为什么它值得单独存在

如果没有 `useChatWorkspace`，这些逻辑会继续全部堆在 `ChatShell`：

- 会话列表排序
- 当前激活会话
- 模型列表拉取
- 当前会话详情拉取
- 草稿模型 / 草稿提示词 / 草稿联网搜索开关
- 会话级提示词保存
- 会话级模型切换
- 会话级联网搜索切换

这会让 `ChatShell` 很快重新膨胀成“页面壳 + 工作区规则总控”。

当前把它抽成独立 hook 的好处是：

- 页面结构和工作区规则分层更清楚
- 后续承接联网开关、更多会话级控制项会更自然
- 更利于按代码链路理解当前前端架构

---

## 6. 一句话理解

`useChatWorkspace` 是当前聊天工作区的编排层：它把会话、模型、草稿控制项、联网搜索偏好、工作区错误和会话级 patch 收在一起，让 `ChatShell` 可以回到页面壳组件的角色。
