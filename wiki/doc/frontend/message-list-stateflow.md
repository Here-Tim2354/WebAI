---
aliases:
  - MessageList 状态流
---

# MessageList 前端状态流说明

本文档用于理解 `MessageList` 的前端运行机制，而不是页面展示结构。

代码入口：
- `src/components/chat/message-list.tsx`

关联笔记：
- [[message-list]]
- [[chatshell-stateflow]]

## 1. 组件定位

`MessageList` 是一个相对纯粹的展示型组件，但它仍然带有少量局部状态和一个 `useEffect`。

它的状态流主要围绕三件事展开：

- 空状态标题如何生成
- 空状态标题如何逐字显示
- 消息区域滚动相关回调如何与父层协作

---

## 2. 来自父层的输入

`MessageList` 不直接持有消息源，它通过 props 接收：

- `messages`
- `messageEndRef`
- `scrollContainerRef`
- `loadingHint`
- `onScroll`
- `onJumpToLatest`
- `showJumpToLatest`

这意味着：

- 消息本身由父层控制
- 滚动策略也由父层 hook 协调
- `MessageList` 主要负责按这些输入做展示

---

## 3. 本组件自身维护的状态

### 3.1 `emptyTitle`

```tsx
const [emptyTitle] = useState(() => ...);
```

作用：
- 在空状态时随机选一句欢迎标题

特点：
- 只在首次初始化时生成一次
- 后续渲染中保持稳定

---

### 3.2 `typedTitle`

```tsx
const [typedTitle, setTypedTitle] = useState("");
```

作用：
- 保存当前逐字动画已经显示到哪一部分

它不是完整标题，而是：

- 空状态动画过程中的中间结果

---

## 4. useEffect 在管理什么

组件内部有一个 `useEffect`。

它管理的内容是：

- 空状态欢迎标题的逐字动画

依赖项：

```tsx
[emptyTitle, messages.length]
```

当前实现：

1. 如果当前已有消息，则直接返回，不启动动画
2. 如果没有消息：
   - 先清空 `typedTitle`
   - 再通过 `setInterval` 每次多切一位字符
   - 持续写入 `typedTitle`
3. 当动画结束时清除定时器
4. 当组件重新切换状态或卸载时，在 cleanup 中清理定时器

这个 effect 的目标是：

- 让空白聊天页更像一个真实的“待开始对话”界面
- 而不是一块完全静止的空白区域

---

## 5. 为什么滚动状态不放在这里

虽然 `MessageList` 有滚动容器，但它并不自己决定滚动逻辑。

当前设计是：

- `MessageList` 只接收 `scrollContainerRef`
- `MessageList` 只接收 `onScroll`
- `MessageList` 只接收 `showJumpToLatest`
- `MessageList` 只接收 `onJumpToLatest`

真正的滚动状态在：

- `useMessageScroll`

这样拆分的好处是：

- 展示层更纯粹
- 滚动逻辑可以被父层统一协调
- `MessageList` 不需要知道“为什么显示回到底部按钮”

---

## 6. 消息展示链路

`MessageList` 的消息展示流程是：

1. 父层把 `messages` 传进来
2. 组件判断 `messages.length`
3. 如果为空，显示欢迎页
4. 如果不为空，遍历渲染 `MessageBubble`

因此它只是消息数组的消费方，不是消息数组的生产方。

---

## 7. 回到底部按钮的状态流

按钮出现与否完全由父层控制：

- 父层根据滚动距离决定 `showJumpToLatest`
- `MessageList` 只负责在为 `true` 时展示按钮
- 点击后调用 `onJumpToLatest`

所以这里的按钮是：

- 展示在 `MessageList`
- 逻辑归 `useMessageScroll`

---

## 8. 一句话总结

`MessageList` 的状态流很轻：它自己只管理空状态标题动画，消息与滚动的主控制权都留在父层和专门的滚动 hook 中。
