# ChatShell 前端状态流说明

本文档用于理解 `ChatShell` 的前端运行机制，而不是页面展示结构。

对应代码文件：
- `src/components/chat/chat-shell.tsx`
- `src/components/chat/use-chat-session.ts`
- `src/components/chat/use-message-scroll.ts`

---

## 1. 文档目标

这份文档主要回答这些问题：

- `ChatShell` 管了哪些状态
- 这些状态分别从哪里来
- 哪些操作会触发状态变化
- 哪些 `useEffect` 在做副作用管理
- 前端请求是如何串到页面更新上的

如果你想看“页面长什么样、由哪些区块组成”，应该看：

- [chatshell.md](E:\Learning\Programming\WebAI\wiki\doc\frontend\chatshell.md)

---

## 2. ChatShell 在状态流中的角色

`ChatShell` 是聊天工作区的前端状态中枢。

它不只是一个页面组件，还负责协调下面几类状态：

- 用户状态
- 会话列表状态
- 当前激活会话状态
- 当前工作区错误状态
- 模型列表与当前选中模型状态
- 当前会话的消息发送入口
- 会话详情加载状态
- 移动端侧栏开关状态

其中：

- 页面级状态主要集中在 `ChatShell`
- 消息交互状态被拆到 `useChatSession`
- 滚动与吸底状态被拆到 `useMessageScroll`

所以它的职责更像“总控层”，不是单纯渲染 JSX。

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

以下状态定义在 `ChatShell` 本体中。

### 4.1 用户状态

```tsx
const [user, setUser] = useState(initialUser);
```

作用：
- 表示当前客户端工作区是否有已登录用户

当前实现：
- 初始值来自服务端
- 退出登录时会被置为 `null`
- 当 `user === null` 时，组件直接切换到 `AuthPanel`

---

### 4.2 会话列表状态

```tsx
const [conversations, setConversations] = useState(
  sortConversations(initialConversations),
);
```

作用：
- 保存当前工作区左侧会话列表

当前实现：
- 初始值来自服务端首屏会话列表
- 创建、重命名、加载会话详情、发送消息后，都会通过 `upsertConversation()` 刷新
- 删除会话时会直接从列表里移除

---

### 4.3 当前激活会话

```tsx
const [activeConversationId, setActiveConversationId] = useState<string | null>(
  initialConversations[0]?.id ?? null,
);
```

作用：
- 表示当前主面板正在查看和交互的是哪一个会话

当前实现：
- 默认取首屏会话列表的第一项
- 点击侧栏会话时更新
- 新建会话时可自动切换到新会话
- 删除当前会话时会自动切到剩余列表中的第一项

---

### 4.4 会话创建、删除、退出、详情加载状态

这几类状态都属于“操作中的 UI 标志位”。

```tsx
const [isCreatingConversation, setIsCreatingConversation] = useState(false);
const [isDeletingConversationId, setIsDeletingConversationId] = useState<string | null>(null);
const [isSigningOut, setIsSigningOut] = useState(false);
const [isLoadingConversation, setIsLoadingConversation] = useState(false);
```

分别表示：

- `isCreatingConversation`
  - 当前是否正在创建新会话
- `isDeletingConversationId`
  - 当前正在删除的是哪一个会话
- `isSigningOut`
  - 当前是否正在退出登录
- `isLoadingConversation`
  - 当前是否正在拉取激活会话的完整消息快照

这里的设计重点是：

- 创建和退出只需要布尔值
- 删除需要精确到某条会话，所以用 `string | null`

---

### 4.5 页面局部 UI 状态

```tsx
const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
const [workspaceError, setWorkspaceError] = useState<string | null>(null);
```

分别表示：

- `isMobileSidebarOpen`
  - 移动端抽屉侧栏是否打开
- `workspaceError`
  - 工作区级别错误提示内容

`workspaceError` 的特点是：

- 多个异步动作都会往这里写错误
- 页面顶部会统一通过 `Alert` 展示出来

---

### 4.6 模型状态

```tsx
const [availableModels, setAvailableModels] = useState<AIModel[]>(initialModels);
const [selectedModelId, setSelectedModelId] = useState<string | null>(...);
```

作用：

- `availableModels`
  - 当前可选模型列表
- `selectedModelId`
  - 当前聊天时使用的模型

当前实现：

- 初始值来自服务端首屏数据
- 客户端挂载后还会再请求一次 `/api/models`
- 如果当前选中的模型仍然存在，就保留
- 如果模型失效，就回退到默认模型或列表第一项

---

## 5. useChatSession 管理的状态

`ChatShell` 自己没有直接保存消息数组，而是把消息相关状态委托给：

- `src/components/chat/use-chat-session.ts`

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

### 5.3 发送中状态

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);
```

作用：
- 当前是否正在发送消息并等待模型返回

这个状态会直接影响：

- 发送按钮是否禁用
- 输入框焦点回归时机
- 是否允许重复提交

---

## 6. useMessageScroll 管理的状态

滚动逻辑没有放在 `ChatShell` 本体，而是委托给：

- `src/components/chat/use-message-scroll.ts`

它主要管理：

- `messageEndRef`
- `scrollContainerRef`
- `showJumpToLatest`
- `shouldStickToBottomRef`
- `lastMessageIdRef`

用途分别是：

- 定位消息末尾锚点
- 获取滚动容器
- 控制“回到底部”按钮显示
- 记录当前是否应自动吸底
- 判断本次变化是不是一条真正的新消息

---

## 7. ChatShell 的两个 useEffect

`ChatShell` 自身目前有两个关键副作用。

### 7.1 挂载后同步模型列表

触发时机：

- 仅在组件首次挂载后执行一次

依赖数组：

```tsx
[]
```

它管理的内容：

- 客户端挂载后的模型列表刷新

当前实现：

1. 请求 `/api/models`
2. 校验响应结构
3. 更新 `availableModels`
4. 校正 `selectedModelId`
5. 如果组件已经卸载，则通过 `cancelled` 阻止过期回写

为什么首屏已有 `initialModels` 还要再拉一次：

- `initialModels` 是服务端首屏快照
- 客户端挂载后再同步一次，可以尽量拿到数据库里的最新启用模型

---

### 7.2 当前会话切换时加载详情

触发时机：

- `activeConversationId` 变化时

依赖数组：

```tsx
[activeConversationId, syncConversationMessages]
```

它管理的内容：

- 当前激活会话的完整快照加载

当前实现：

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

## 8. 其它组件中的 useEffect

虽然它们不在 `ChatShell` 本体里，但都参与了 `ChatShell` 页面运行。

### 8.1 ChatInput 的两个 effect

对应文件：
- `src/components/chat/chat-input.tsx`

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

---

### 8.2 MessageList 的 effect

对应文件：
- `src/components/chat/message-list.tsx`

作用：
- 管理空会话欢迎标题的逐字动画

实现：
- 只有在 `messages.length === 0` 时才启动
- 通过定时器逐步把 `emptyTitle` 写到 `typedTitle`
- 在 cleanup 里清除定时器

---

### 8.3 AuthPanel 的 effect

对应文件：
- `src/components/chat/auth-panel.tsx`

作用：
- 登录页首次挂载时做本地状态恢复

实现：

1. 读取 `localStorage` 中的上次邮箱
2. 解析 URL 和 hash 中的登录回跳结果
3. 写入提示信息
4. 若是链接过期，则自动聚焦邮箱框

---

### 8.4 useMessageScroll 的 effect

对应文件：
- `src/components/chat/use-message-scroll.ts`

作用：
- 管理消息变化后的自动吸底行为

实现：

1. 在 `messages` 变化后执行
2. 如果当前仍处于“应吸底”状态，则滚动到消息末尾
3. 如果是新消息，用 `smooth`
4. 如果只是同一条消息的重复渲染，用 `auto`

---

## 9. 关键行为链路

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
5. 本地先做乐观更新：
   - 插入用户消息
   - 插入 assistant 占位消息
6. `POST /api/chat`
7. 成功后：
   - 用后端返回的真实消息快照覆盖本地缓存
   - 用后端返回的会话信息更新会话列表
8. 失败时：
   - 把 assistant 占位消息替换成 error 气泡

结果：
- 用户能立即看到发送动作
- 后续再被真实服务端结果校正

---

### 9.4 删除会话

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

### 9.5 退出登录

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

---

## 10. 状态之间的关系

可以把 `ChatShell` 的前端状态流压缩成下面这张关系图：

```text
服务端初始数据
  -> initialUser
  -> initialConversations
  -> initialModels
  -> ChatShell useState 初始化

ChatShell
  -> 管页面级状态
  -> 触发会话与模型请求
  -> 把消息状态委托给 useChatSession
  -> 把滚动状态委托给 useMessageScroll

useChatSession
  -> 管各会话消息缓存
  -> 管输入框文本
  -> 管发送中状态

useMessageScroll
  -> 管自动吸底
  -> 管“回到底部”按钮

子组件
  -> ConversationSidebar 负责会话交互入口
  -> MessageList 负责消息区域展示
  -> ChatInput 负责输入与发送入口
```

---

## 11. 一句话总结

`ChatShell` 的本质不是“把几个组件摆出来”，而是把用户、会话、模型、消息、副作用和请求链路协调成一个能持续运行的聊天工作区前端状态机。
