# `src/features/chat/components/message-bubble.tsx`

## 文件定位

`MessageBubble` 是单条消息的渲染和操作层。`MessageList` 遍历消息时会为每条消息创建一个 `MessageBubble`。

## 核心职责

它把 `ChatMessage` 映射成可读的气泡：

- user / assistant / system / error 的样式区分。
- pending / streaming / cancelled / error 的状态展示。
- assistant 流式回复的局部 reveal。
- user 消息编辑和附加项修改。
- 复制、分支、重新生成等操作按钮。
- thought summary 折叠展示。

## 关键内部函数

流式 reveal 相关：

- `splitStreamingUnits(text)`：把新增文本切成适合逐步展示的单位。CJK 按单字，英文按短片段，空格和换行单独保留。
- `getRevealBatchSize(backlog)`：积压越多，一次揭示越多，避免长回复追不上模型速度。
- `getRevealDelay(backlog)`：积压越多，延迟越短。
- `StreamingMarkdownMessage`：把服务端已经收到的完整内容，再按更自然的节奏显示给用户。

操作相关：

- `handleCopy()`：调用上层复制函数，成功后短暂显示 `CheckIcon`。
- `handleStartEdit()` / `handleCancelEdit()`：进入和退出编辑态。
- `handleSaveEdit()`：把正文、URL 和附件一起交给上层 `onEdit`。
- `handleBranch()`：从 assistant 消息创建分支。
- `handleRegenerate()`：对最新 assistant 消息重新生成。

## 状态解析

- `isEditing`：是否处于编辑态。
- `editValue`、`editUrls`、`editAttachments`：编辑态的消息副本。
- `isAttachmentDialogOpen`：修改附加项弹窗。
- `isSubmittingEdit`、`isBranching`、`isRegenerating`：分别锁住对应动作。
- `copiedMessageId`：复制成功后的短反馈。

`useEffect` 会在非编辑态下同步最新消息内容到编辑草稿。这样服务端回写或切换消息时，编辑框不会拿到旧内容。

## 设计缘由

消息操作放在气泡层，因为按钮是否出现取决于单条消息的 role 和 status。但真正的数据修改不在这里做，而是通过 `onEdit`、`onBranch`、`onRegenerate` 回到上层。

## 返回组件规模

单个气泡最大宽度是 `52rem`。assistant 靠左，user 靠右。编辑态里会出现一个约 `min(72vw, 32rem)` 的 textarea 和“修改附加项”入口。

## 代码展开

### 气泡如何判断动作可用

`MessageBubble` 会先从消息状态推导几个布尔值：

- `isAssistantLike`：assistant 或 system。
- `isUser`：用户消息。
- `isStreaming`：状态为 streaming。
- `isActionLocked`：上层锁定、pending、streaming 都会锁住操作。
- `canCopy`：未锁定且正文非空。
- `canEdit`：只有 user 消息可编辑。
- `canBranch`：只有完成后的 assistant 消息可分支。
- `canRegenerate`：必须是 assistant，并且上层判断它是最新 assistant。

所以“按钮出现”和“按钮可点”不是 JSX 随便写的，而是从 role/status 推出来的。

### 流式 reveal 的处理

服务端已经用 NDJSON 把 assistant 内容逐步推给前端，但 `StreamingMarkdownMessage` 又做了一层本地 reveal。原因是模型流的 chunk 不一定符合阅读节奏，可能一大段突然出现。

它的处理方式是：

1. 比较新 `content` 和当前显示内容加队列内容。
2. 如果新内容不是旧内容前缀，直接重置，说明发生了重新生成或回退。
3. 如果是前缀扩展，把新增内容切成 units。
4. 根据队列积压决定一次显示多少和延迟多久。
5. 用 `startTransition` 降低 Markdown 重渲染优先级。

CJK 文本按单字揭示，英文按短词片段揭示。这样中文回复不会一整句跳出来，英文长单词也不会逐字闪得太碎。

### thinking summary

assistant 消息如果有 `metadata.thinking.content`，会显示 `ThinkingSummary`。它默认折叠，只展示状态：思考中、已思考、已停止或思考失败。展开后才看 thought summary 内容。

这能避免 thought summary 和最终回答混在一起，也能保留模型 thinking 过程的可见性。

### 编辑态

点击编辑后，组件进入 `isEditing`，并把正文、URL、附件复制到局部草稿：

- `editValue`
- `editUrls`
- `editAttachments`

保存时提交的是一个 `EditMessageUpdate`：正文、URL、附件一起提交。只改 URL 或只改附件也可以触发重新生成，只要三者不是全空。

编辑态里还有一个 `AttachmentEditorDialog`。它不直接保存消息，只修改 `editUrls` 和 `editAttachments`，最后由“保存”按钮统一提交。

### 失败和反馈

复制成功会用 `copiedMessageId` 展示 1.3 秒的 check 图标。分支和重新生成有各自的 loading state，用于把按钮换成旋转图标。

编辑保存时会先把 `isEditing` 设为 false，再 await 上层请求。这样用户点保存后不会停留在编辑框里等待流式生成；后续真正的 assistant 占位和流式状态由 `useChatSession` 接管。

### UI 规模

user 气泡是浅蓝背景，assistant 更接近无框阅读块。操作按钮放在气泡下方，hover 或 focus-within 才显示，避免消息区一直堆满按钮。
