# `src/features/chat/hooks/use-message-scroll.ts`

## 文件定位

`useMessageScroll` 管消息区滚动。它被 `ChatShell` 调用，返回 ref 和一组滚动事件处理器，再传给 `MessageList`。

## 核心状态

- `messageEndRef`：消息列表底部锚点。
- `scrollContainerRef`：真实滚动容器。
- `showJumpToLatest`：是否显示“回到底部”按钮。
- `shouldStickToBottomRef`：是否继续自动吸底。
- `isAutoScrollPausedByUserRef`：用户是否主动上滑打断自动滚动。
- `scrollIntentRef`：当前滚动意图，`up` 或 `down`。
- `lastScrollTopRef`、`lastTouchYRef`：判断方向。

## 关键函数

- `isNearBottom(element)`：离底部 80px 内算接近底部。
- `getOverlayViewport(root)`：找到 OverlayScrollbars 的真实 viewport。
- `pauseAutoScroll(container)`：用户上滑时暂停吸底，并显示按钮。
- `resumeAutoScrollIfAtBottom(container)`：用户滚回底部时恢复吸底。
- `scrollToLatest()`：点击按钮或主动跳底。
- `handleScroll()`：根据滚动位置和方向更新吸底状态。
- `handleWheelCapture()` / `handleTouchMoveCapture()`：更早捕获用户向上滚动意图。

## `useEffect` 解析

`messages` 变化时，如果仍处于吸底状态，就 `scrollIntoView({ behavior: "smooth" })`；如果用户已经上滑，则只显示回到底部按钮，不强行拉回底部。

## 设计缘由

AI 回复流式输出时，自动滚动很容易和用户阅读冲突。这里的规则是：默认吸底；用户只要主动上滑，就暂停；用户回到底部或点击按钮，再恢复。

## 返回规模

这个 Hook 不渲染 UI。实际按钮由 [[components/message-list|MessageList]] 根据 `showJumpToLatest` 渲染。

## 代码展开

### OverlayScrollbars viewport

`ScrollArea` 外层不是实际滚动元素，OverlayScrollbars 会创建自己的 viewport。所以这个 Hook 不能简单读 `event.currentTarget.scrollTop`。

`getOverlayViewport` 会先判断当前 root 是否带 `data-overlayscrollbars-viewport`，否则向下 query。`getScrollElement` 还会从事件 target 的 closest viewport 找真实滚动元素。

### 用户上滑如何打断吸底

滚轮向上时，`handleWheelCapture` 会在 capture 阶段先调用 `pauseAutoScroll`。这样即使后面还有 smooth scroll 动画，也会立即写回当前 scrollTop，打断上一轮自动滚动。

触摸场景通过 `lastTouchYRef` 判断手指方向。手指向下移动通常代表内容向上滚，也就是用户想看旧消息，因此暂停吸底。

### 恢复吸底

用户向下滚动且接近底部时，`resumeAutoScrollIfAtBottom` 会恢复：

- `isAutoScrollPausedByUserRef = false`
- `shouldStickToBottomRef = true`
- 隐藏回到底部按钮

点击按钮则直接 `scrollToLatest()`，强制恢复吸底。

### messages effect 的细节

消息数组变化时，如果 `shouldStickToBottomRef.current` 为 true，就滚到 `messageEndRef`。否则只显示按钮，不打扰用户阅读旧消息。

这条规则让长回复流式输出时比较自然：用户不动，持续吸底；用户上滑，系统停止追着最新消息跑。
