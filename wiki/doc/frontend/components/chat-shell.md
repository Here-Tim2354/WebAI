# `src/features/chat/components/chat-shell.tsx`

## 文件定位

`ChatShell` 是登录后工作区的总壳。它不直接访问数据库，但会把服务端首屏数据、前端 Hook、侧栏、顶部栏、消息区、输入区和多个弹窗接在一起。

真实链路是：

`page.tsx -> ChatShell -> useChatWorkspace / useChatSession / useFetchedModels / useMessageScroll -> 具体 UI 组件`。

## 状态分区

这个文件里有不少 `useState`，但它们大多是页面壳状态，而不是核心业务状态：

- `user`：当前登录用户，退出或注销后置空。
- `authPanelMessage` / `authPanelMessageType`：回到登录页时展示一次性提示。
- `isMobileSidebarOpen`：移动端侧栏抽屉。
- `isPromptDialogOpen` / `promptEditorValue` / `isSavingPrompt`：会话级提示词弹窗。
- `releaseNote` 系列：更新日志读取、弹窗、每天一次提示和“不再弹出”。
- `workspaceNotice`：顶部轻提示。

真正的会话状态在 [[hooks/use-chat-workspace]]，消息流状态在 [[hooks/use-chat-session]]。这一点很重要，不然会误以为 `ChatShell` 什么都自己管。

## 关键函数

- `showWorkspaceNotice`：写入顶部提示，支持指定时间后自动清掉。
- `loadCurrentReleaseNote`：从 `/api/release-notes/current` 读取更新日志 Markdown。
- `handleSaveSystemPrompt`：把弹窗中的提示词交给 `saveSystemPrompt`。
- `handleSignOut` / `handleDeleteAccount`：调用接口后清空用户和工作区。
- `handleSendMessage`：发送消息前先 `ensureConversationId`，空白首页会先建会话，再把消息交给 `handleSubmit`。
- `handleEditMessage` / `handleRegenerateMessage` / `handleBranchFromMessage`：把消息操作转发给对应 Hook 或工作区逻辑。

## `useEffect` 解析

- 登录成功提示：从 `sessionStorage` 取 `webai:auth-notice`，展示后清除。
- 更新日志自动提示：按 `userId + releaseId + date` 控制每天最多一次。
- `Ctrl/Cmd + N`：在非输入元素中触发新建对话。
- 自动拉取 Gemini 模型：用户有 API Key、还没有 fetched model 时自动触发一次。

## 设计缘由

`ChatShell` 保留“拼装层”身份，而不是继续膨胀成全部业务逻辑。这样文件虽然长，但主要长在 UI 拼接和弹窗上；真正复杂的会话语义、流式语义都被下沉到 Hook。

## 返回组件规模

返回的是整屏工作区：左侧 `ConversationSidebar`，右侧 `main`，内部包含 `ChatHeader`、错误/Key 提示、`MessageList` 和底部 `ChatInput`。此外还有更新日志弹窗和会话级提示词弹窗。

## 代码展开

### 首屏数据如何进入工作区

`ChatShell` 的 props 全部来自 `page.tsx`。这里没有再次请求“当前用户是谁”，而是直接把 `initialUser` 放进本地 `user` 状态：

```tsx
const [user, setUser] = useState(initialUser);
```

这个状态只在三类情况下变化：登录页返回工作区、退出登录、注销账户。普通聊天、切换会话、拉模型都不应该改它。

`initialConversations` 和 `initialModels` 没有在 `ChatShell` 里直接存，而是交给 `useChatWorkspace`。这样页面壳不用知道会话列表怎么排序、怎么乐观更新、怎么回滚。

### 四个 Hook 的分工

`ChatShell` 同时调用四个核心 Hook：

1. `useGeminiRuntimeConfig(user?.id)`：读取浏览器本地的 Gemini Key / URL。
2. `useChatSession()`：消息缓存、发送流、编辑流、重新生成流、附件草稿。
3. `useChatWorkspace(...)`：会话列表、当前会话、模型选择、提示词、联网、thinking。
4. `useMessageScroll({ messages })`：消息滚动状态和回到底部按钮。

这里值得注意的是 `useChatWorkspace` 需要接收 `syncConversationMessages` 和 `removeConversationMessages`。这说明会话层有时必须影响消息缓存，比如创建新会话时同步空数组、删除会话时清掉旧消息、分支会话返回完整消息快照时写入缓存。

### 发送消息的真实链路

`handleSendMessage` 不是简单转发 `onSubmit`。它先根据正文生成自动标题：

```tsx
const autoTitle = createAutoConversationTitle(content);
const conversationId = await ensureConversationId({ title: autoTitle });
```

如果当前是空白首页，`ensureConversationId` 会创建真实会话，并把草稿模型、提示词、联网、thinking 一起落到会话里。之后如果新会话还叫默认标题，且用户第一条消息能生成更好的标题，就尝试调用 `handleRenameConversation`。这一步失败不会阻断发送，因为自动标题只是辅助体验。

最后才调用 `handleSubmit`，并把 `onConversationSynced` 传进去。聊天接口流结束或中途更新会话时，`useChatSession` 不直接管理会话列表，而是回调给 `ChatShell`，再由 `upsertConversation` 写回工作区。

### 消息操作为什么都在这里接线

复制、编辑、分支、重新生成都是从 `MessageBubble` 点出来的，但 `MessageBubble` 不知道当前会话 ID、当前模型、thinking、Gemini runtime config。这些上下文只有 `ChatShell` 最完整，所以这里有四个桥接函数：

- `handleCopyMessage`：只需要消息正文，失败写 `workspaceError`。
- `handleEditMessage`：带上 `activeConversationId`、`selectedModelId`、`currentThinkingLevel`、runtime config。
- `handleBranchFromMessage`：先显示 loading notice，成功后显示切换成功。
- `handleRegenerateMessage`：只允许作用于当前会话，并且会把输入区临时 URL Context 一起交给重新生成。

这也是 `ChatShell` 仍然比较长的原因：它不是业务细节的实现处，但它是上下文汇合处。

### 更新日志弹窗

更新日志用两组 localStorage key：

- `dismissed`：用户勾选“不再弹出本次更新内容”。
- `last-shown`：同一浏览器每天最多自动提示一次。

`autoReleaseNotePromptRef` 用来防止同一次渲染周期里重复触发自动弹窗。这里不用 state，是因为这个标记只服务于 effect 去重，不需要驱动 UI。

### UI 层级

登录后返回的 DOM 可以这样理解：

```txt
WorkspaceNotice
└─ div h-[100dvh]
   ├─ ConversationSidebar
   └─ main
      ├─ 背景渐变层
      ├─ ChatHeader
      ├─ workspaceError / API Key Alert
      └─ section 消息区
         ├─ MessageList
         └─ ChatInput
Dialog: 更新日志
Dialog: 会话级提示词
```

`main` 里的背景层是 `pointer-events-none absolute inset-0`，只负责视觉。真正可交互内容都在 `relative z-10` 或 `z-20` 层。
