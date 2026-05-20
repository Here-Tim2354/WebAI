# `src/features/chat/components/message-list.tsx`

## 文件定位

`MessageList` 是右侧主区域的消息列表。它接收 `ChatShell` 准备好的 `messages`、滚动 ref 和消息操作回调，然后把每条消息交给 [[components/message-bubble|MessageBubble]]。

## 核心职责

它负责两种界面态：

- 空会话欢迎页。
- 有消息时的滚动消息流。

它不管理消息数据，只负责展示和把事件继续往下传。

## 状态与函数

本文件只有轻量状态：

- `emptyTitle`：首次渲染时随机选一个欢迎标题。
- `typedTitle`：空会话标题的逐字动画文本。

`getLatestAssistantMessageId(messages)` 用来判断哪条 assistant 消息可以重新生成。当前策略很明确：只有最新 assistant 消息可以重新生成。

## `useEffect` 解析

当 `messages.length === 0` 时，启动一个 interval，把欢迎标题逐字写到 `typedTitle`。一旦有消息，就不播放这段动画。

## 设计缘由

欢迎态的动画被限制在空会话，历史会话切换时不会反复打扰阅读。重新生成入口放在列表层判断，是因为“最新 assistant”这个条件需要看整条消息数组。

## 返回组件规模

这是一个占满剩余高度的消息滚动区。空态居中显示大标题；消息态使用 `max-w-4xl` 的纵向列表，消息之间 `gap-7`，底部带一个 `messageEndRef`。如果用户离开底部，会出现居中的圆形向下按钮。

## 代码展开

### 空会话欢迎态

`emptyTitleCandidates` 是一组候选标题，组件初始化时随机选一个，保存在 `emptyTitle`。因为 `useState(() => ...)` 只在首次渲染运行，所以同一个空会话界面不会因为父组件重渲染而换标题。

`typedTitle` 则由 effect 每 130ms 追加一个字符。只要 `messages.length > 0`，effect 就直接退出，所以历史会话不会播放欢迎动画。

### 消息态

有消息时，组件渲染：

```tsx
messages.map((message) => <MessageBubble key={message.id} ... />)
```

每条消息都拿到相同的操作回调，但 `canRegenerate` 只给最新 assistant 消息：

```ts
canRegenerate={message.id === latestAssistantMessageId}
```

这个判断放在列表层，因为单个气泡不知道自己是不是最后一条 assistant。

### 滚动事件为什么从 props 传入

`MessageList` 不自己实现滚动策略，只把 `onScroll`、`onWheelCapture`、`onTouchStartCapture`、`onTouchMoveCapture` 传给 `ScrollArea`。真正逻辑在 `useMessageScroll`。这样列表组件只关心“把事件接上”，不关心吸底规则。

### 回到底部按钮

`showJumpToLatest` 为 true 时，按钮固定在消息列表底部居中。它是 `pointer-events-none` 外壳加 `pointer-events-auto` 按钮，保证只有按钮本身吃点击，外层不挡消息滚动。

### UI 规模

空态标题居中，最大宽度 `2xl`。消息态列宽 `max-w-4xl`，上下留足 padding，底部 `messageEndRef` 用来给 `scrollIntoView` 找锚点。
