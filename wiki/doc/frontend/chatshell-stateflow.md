---
aliases:
  - ChatShell 状态流
  - ChatShell State Flow
---

# ChatShell 前端状态流说明

这篇笔记帮助我们理解 `ChatShell` 的前端运行机制，而不是页面展示结构。

代码入口：
- `src/features/chat/components/chat-shell.tsx`
- `src/features/chat/hooks/use-chat-workspace.ts`
- `src/features/chat/hooks/use-chat-session.ts`
- `src/features/chat/hooks/use-message-scroll.ts`
- `src/features/chat/hooks/use-fetched-models.ts`
- `src/features/chat/lib/chat-stream.ts`

关联笔记：
- [[chatshell]]
- [[conversation-sidebar-stateflow]]
- [[message-list-stateflow]]
- [[chat-input-stateflow]]
- [[auth-panel-stateflow]]

---

## 1. 文档目标

这份文档主要回答这些问题：

- `ChatShell` 管了哪些状态
- 这些状态分别从哪里来
- 哪些操作会触发状态变化
- 哪些 `useEffect` 在做副作用管理
- 前端请求是如何串到页面更新上的

如果你想看页面结构本身，直接看 [[chatshell]]。

---

## 2. ChatShell 在状态流中的角色

当前版本里，`ChatShell` 已不再独自承担整个工作区状态中枢。

现在更准确的理解应该是：

- `ChatShell` 负责页面壳级状态与页面装配
- `useChatWorkspace` 负责工作区编排状态
- `useChatSession` 负责消息交互状态
- `useMessageScroll` 负责滚动状态
- `useFetchedModels` 负责 Gemini 设置中的模型拉取、启停、默认项和删除请求
- `chat-stream.ts` 负责前端消费 NDJSON 事件、合并 assistant 增量内容和生成本地 cancelled 快照

所以它们四者共同构成聊天工作区的前端状态机，而不是再由 `ChatShell` 一处包办。

---

## 3. 初始数据从哪里来

`ChatShell` 自己不是首个数据来源。

在页面首次进入时，服务端组件 `page.tsx` 会先准备这些初始值：

- `initialUser`
- `initialConversations`
- `initialModels`
- `initialAuthMessage`
- `initialAuthMessageType`

然后再传给 `ChatShell`：

```tsx
<ChatShell
  initialUser={...}
  initialConversations={...}
  initialModels={...}
  initialAuthMessage={...}
  initialAuthMessageType={...}
/>
```

所以 `ChatShell` 的很多 state，不是从空开始，而是从服务端首屏数据初始化出来的。

---

## 4. ChatShell 自身维护的状态

以下状态现在只保留在 `ChatShell` 本体中。

### 4.1 用户状态

```tsx
const [user, setUser] = useState(initialUser);
```

作用：
- 表示当前客户端工作区是否有已登录用户

运行方式：
- 初始值来自服务端
- 退出登录时会被置为 `null`
- 当 `user === null` 时，组件直接切换到 `AuthPanel`

---

### 4.2 退出登录状态

这几类状态都属于“操作中的 UI 标志位”。

```tsx
const [isSigningOut, setIsSigningOut] = useState(false);
```

- `isSigningOut`
  - 当前是否正在退出登录

---

### 4.3 页面局部 UI 状态

```tsx
const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
const [isPromptDialogOpen, setIsPromptDialogOpen] = useState(false);
const [promptEditorValue, setPromptEditorValue] = useState("");
const [isSavingPrompt, setIsSavingPrompt] = useState(false);
```

分别表示：

- `isMobileSidebarOpen`
  - 移动端抽屉侧栏是否打开
- `isPromptDialogOpen`
  - 会话级提示词弹窗是否打开
- `promptEditorValue`
  - 弹窗里的当前编辑值
- `isSavingPrompt`
  - 当前是否正在保存提示词

---

## 5. useChatWorkspace 管理的状态

`useChatWorkspace` 是当前聊天工作区的编排层。

它主要维护这些状态：

- `conversations`
- `activeConversationId`
- `workspaceError`
- `availableModels`
- `draftModelId`
- `draftSystemPrompt`
- `draftWebSearchEnabled`
- `isCreatingConversation`
- `isDeletingConversationId`
- `isLoadingConversation`

它负责的行为包括：

- 创建、重命名、删除会话
- 切换当前会话
- 首屏后同步模型列表
- 切换会话时拉取会话详情
- 协调当前会话模型、提示词与联网设置
- 在首条消息发送前，把草稿控制项一并落入新会话

因此现在的边界是：

- `ChatShell` 不再直接保存整套会话/模型/工作区错误状态
- 这些状态统一通过 `useChatWorkspace` 暴露给页面壳消费

---

## 6. useChatSession 管理的状态

`ChatShell` 自己没有直接保存消息数组，而是把消息相关状态委托给：

- `src/features/chat/hooks/use-chat-session.ts`

它主要维护这几个状态。

### 5.1 各会话消息缓存

```tsx
const [conversationMessages, setConversationMessages] = useState<
  Record<string, ChatMessage[]>
>({});
```

作用：
- 以 `conversationId -> messages[]` 的形式缓存各会话消息

为什么这样设计：
- 切换不同会话时，不需要把所有消息都塞进 `ChatShell`
- 消息状态与页面布局状态分层更清楚

---

### 5.2 输入框内容

```tsx
const [inputValue, setInputValue] = useState("");
```

作用：
- 保存当前输入框中的用户文本

---

### 5.3 URL Context 相关状态

当前 `useChatSession` 还维护：

- `urlContextInputValue`
- `urlContextUrls`
- `isUrlContextPanelOpen`

作用：

- 保存当前 URL 输入框内容
- 保存当前这次发送已确认的 URL 列表
- 控制 URL Context 输入区是否展开

---

### 5.4 发送中状态

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);
```

作用：
- 当前是否正在发送消息并等待模型返回

这个状态会直接影响：

- 发送按钮是否禁用
- 输入框焦点回归时机
- 是否允许重复提交

### 5.5 停止生成状态

`useChatSession` 还维护：

- `streamingConversationId`
- `abortControllerRef`
- `streamingConversationIdRef`

它们共同服务“停止生成”：

- `streamingConversationId` 表示当前哪一个会话处于生成中
- `abortControllerRef` 用于中断浏览器侧 fetch reader
- `streamingConversationIdRef` 让停止按钮在异步回调里仍能拿到最新会话 id

点击停止后，前端会同时：

- 请求 `/api/chat/cancel`，让服务端停止模型流
- abort 当前 fetch，让本地 reader 尽快结束
- 把本次 assistant 占位或流式消息转成 `cancelled`

如果本地还没有收到服务端创建的真实 assistant id，会优先替换当前会话最后一条 `pending / streaming` assistant，避免把上一条回复误标为已停止。

---

## 7. useMessageScroll 管理的状态

滚动逻辑没有放在 `ChatShell` 本体，而是委托给：

- `src/features/chat/hooks/use-message-scroll.ts`

它主要管理：

- `messageEndRef`
- `scrollContainerRef`
- `showJumpToLatest`
- `shouldStickToBottomRef`
- `isAutoScrollPausedByUserRef`
- `scrollIntentRef`
- `lastMessageIdRef`
- `lastScrollTopRef`

用途分别是：

- 定位消息末尾锚点
- 获取滚动容器。这里应指向 OverlayScrollbars 的真实 viewport
- 控制“回到底部”按钮显示
- 记录当前是否应自动吸底
- 记录用户是否已经主动上移
- 记录 wheel / touch 的最近滚动意图
- 保留最新消息 id
- 记录上一帧滚动位置，用于识别真实上移

---

## 8. useChatWorkspace 的两个关键 useEffect

当前与工作区编排最相关的两个副作用已经放进 `useChatWorkspace`。

### 8.1 挂载后同步模型列表

触发时机：

- 仅在组件首次挂载后执行一次

依赖数组：

```tsx
[]
```

它管理的内容：

- 客户端挂载后的模型列表刷新

运行方式：

1. 请求 `/api/models`
2. 校验响应结构
3. 更新 `availableModels`
4. 校正 `selectedModelId`
5. 如果组件已经卸载，则通过 `cancelled` 阻止过期回写

为什么首屏已有 `initialModels` 还要再拉一次：

- `initialModels` 是服务端首屏快照
- 客户端挂载后再同步一次，可以尽量拿到数据库里的最新启用模型

---

### 8.2 当前会话切换时加载详情

触发时机：

- `activeConversationId` 变化时

依赖数组：

```tsx
[activeConversationId, syncConversationMessages]
```

它管理的内容：

- 当前激活会话的完整快照加载

运行方式：

1. 如果没有 `activeConversationId`，直接结束
2. 请求 `/api/conversations/:conversationId`
3. 获取该会话的消息列表和会话信息
4. 调用 `syncConversationMessages()` 更新缓存
5. 调用 `upsertConversation()` 同步会话信息
6. 通过 `cancelled` 防止切换过程中的过期请求回写

这个 effect 的目标是：

- 页面只在真正切到某会话时才拉它的消息
- 避免首页一次性把所有历史消息都塞进首屏数据

---

## 9. 其它组件中的 useEffect

虽然它们不在 `ChatShell` 本体里，但都参与了 `ChatShell` 页面运行。

### 9.1 ChatInput 的三个 effect

对应文件：
- `src/features/chat/components/chat-input.tsx`

#### effect 1：输入框高度自适应

作用：
- 让 textarea 随内容增长，但最高不超过 240px

实现：
- 每次 `value` 变化后先把高度设为 `0px`
- 再读取 `scrollHeight`
- 回写新的受限高度

#### effect 2：发送完成后恢复焦点

作用：
- 提升连续对话体验

实现：
- 当 `isSubmitting` 从 `true` 回到 `false` 时
- 自动重新聚焦输入框

#### effect 3：URL 上限警示清理

作用：
- 清理 URL 上限反馈使用的 timeout

实现：
- 组件卸载时清理未结束的 warning timer

---

### 9.2 MessageList 的 effect

对应文件：
- `src/features/chat/components/message-list.tsx`

作用：
- 管理空会话欢迎标题的逐字动画

实现：
- 只有在 `messages.length === 0` 时才启动
- 通过定时器逐步把 `emptyTitle` 写到 `typedTitle`
- 在 cleanup 里清除定时器

---

### 9.3 AuthPanel 的 effect

对应文件：
- `src/features/chat/components/auth-panel.tsx`

作用：
- 登录页首次挂载时做本地状态恢复

实现：

1. 读取 `localStorage` 中的上次邮箱
2. 解析 URL 和 hash 中的登录回跳结果
3. 写入提示信息
4. 若是链接过期，则自动聚焦邮箱框

---

### 9.4 useMessageScroll 的 effect

对应文件：
- `src/features/chat/hooks/use-message-scroll.ts`

作用：
- 管理消息变化后的自动吸底行为

实现：

1. 在 `messages` 变化后执行
2. 如果当前仍处于“应吸底”状态，则滚动到消息末尾
3. 如果用户已经主动上移，则不再抢滚动位置，只显示回到底部按钮
4. wheel / touch 捕获阶段会提前暂停自动吸底，避免等流式内容更新后再被拉回底部
5. 点击回到底部按钮后，才恢复自动吸底

---

## 10. 关键行为链路

下面是几个重要的前端行为链路。

### 9.1 新建会话

链路：

1. 用户点击 `ConversationSidebar` 中的“新对话”
2. 调用 `handleCreateConversation()`
3. 内部调用 `createConversation()`
4. 前端 `POST /api/conversations`
5. 成功后：
   - `upsertConversation()`
   - `syncConversationMessages(newId, [])`
   - `setActiveConversationId(newId)`

结果：
- 左侧列表新增一条会话
- 主面板切到新会话

---

### 9.2 切换会话

链路：

1. 用户点击侧栏某条会话
2. `setActiveConversationId(conversationId)`
3. 触发 `ChatShell` 第二个 `useEffect`
4. 请求 `/api/conversations/:id`
5. 返回后同步消息缓存和会话信息

结果：
- 主消息区切换到所选会话的完整消息快照

---

### 9.3 发送消息

链路：

1. 用户在 `ChatInput` 中点击发送或按回车
2. `handleSendMessage()` 调用 `useChatSession().handleSubmit()`
3. `handleSubmit()` 先确认 `conversationId`
4. 如果没有激活会话，则通过 `ensureConversationId()` 先建一个
   - 当前会带上草稿模型、草稿提示词和草稿联网开关
5. 本地先做乐观更新：
   - 插入用户消息
   - 插入 assistant 占位消息
6. `POST /api/chat`
   - 当前若存在 `urlContextUrls`，会一并作为 `urls` 传给后端
7. 成功后：
   - 用后端返回的真实消息快照覆盖本地缓存
   - 用后端返回的会话信息更新会话列表
   - 清空 URL 输入值、已确认 URL 列表，并收起 URL 输入区
8. 失败时：
   - 把 assistant 占位消息替换成 error 气泡

结果：
- 用户能立即看到发送动作
- 后续再被真实服务端结果校正

---

### 9.4 联网开关切换

链路：

1. 用户点击 `ChatInput` 左下角联网按钮
2. `ChatShell` 调用 `useChatWorkspace.toggleWebSearchEnabled()`
3. 如果当前还没有真实会话：
   - 只切换 `draftWebSearchEnabled`
4. 如果当前已有会话：
   - 先乐观更新当前会话对象
   - 再 `PATCH /api/conversations/:id`
   - 失败则回滚

结果：
- 联网开关已经成为当前会话的真实控制项

---

### 9.5 删除会话

链路：

1. 用户在侧栏触发删除
2. `handleDeleteConversation(conversationId)`
3. `DELETE /api/conversations/:id`
4. 成功后：
   - 移除消息缓存
   - 从 `conversations` 列表删掉该项
   - 如果删的是当前会话，则切到剩余列表第一项

结果：
- 页面不会继续停留在一个已不存在的会话上

---

### 9.6 退出登录

链路：

1. 用户点击退出登录
2. `handleSignOut()`
3. `POST /api/auth/sign-out`
4. 成功后：
   - `setUser(null)`
   - 清空会话列表
   - 清空当前激活会话
   - `router.refresh()`

结果：
- `ChatShell` 重新走 `if (!user)` 分支
- 页面切回 `AuthPanel`
- Gemini Key / Base URL 保留在浏览器本地配置中，便于同一用户重新登录后恢复使用

---

## 11. 状态之间的关系

可以把 `ChatShell` 的前端状态流压缩成下面这张关系图：

```text
服务端初始数据
  -> initialUser
  -> initialConversations
  -> initialModels
  -> ChatShell useState 初始化

ChatShell
  -> 管页面壳级状态
  -> 触发消息发送与退出登录

useChatWorkspace
  -> 管会话与模型编排状态
  -> 管联网草稿与会话级持久化切换
  -> 管收藏、归档和二级菜单所需列表
  -> 登录后静默预取收藏区与归档区
  -> 触发会话与模型请求
  -> 把消息状态委托给 useChatSession
  -> 把滚动状态委托给 useMessageScroll

useChatSession
  -> 管各会话消息缓存
  -> 管输入框文本
  -> 管 URL Context 输入与已确认 URL
  -> 管发送中状态
  -> 管停止生成后的本地 cancelled 状态和服务端精确取消请求
  -> 调用 chat-stream.ts 消费服务端 NDJSON 事件

useFetchedModels
  -> 管 Gemini 设置里的 fetched model 列表
  -> 管拉取、启停、默认模型和删除状态

useMessageScroll
  -> 管自动吸底
  -> 管“回到底部”按钮

子组件
  -> ConversationSidebar 负责会话交互入口
  -> MessageList 负责消息区域展示
  -> ChatInput 负责输入与发送入口
```

---

## 12. 一句话总结

当前聊天工作区前端状态机已经拆成四层：`ChatShell` 管页面壳，`useChatWorkspace` 管工作区编排，`useChatSession` 管消息交互，`useMessageScroll` 管滚动吸底；它们一起把用户、会话、模型、消息、副作用和请求链路协调成一个可持续运行的聊天页面。
