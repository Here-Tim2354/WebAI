---
aliases:
  - ChatInput 状态流
---

# ChatInput 前端状态流说明

这篇笔记帮助我们理解 `ChatInput` 的前端运行机制，而不是页面展示结构。

代码入口：
- `src/features/chat/components/chat-input.tsx`

关联笔记：
- [[chat-input]]
- [[chatshell-stateflow]]

## 1. 组件定位

`ChatInput` 仍然是受控输入组件，但它现在不只控制主消息文本，还承接：

- 会话级联网开关入口
- 请求级 URL Context 输入区
- URL 上限的局部警示反馈
- 图片与文件附加项入口

它自己不保存主消息文本或 URL 列表，而是依赖父层传入：

- `value`
- `webSearchEnabled`
- `urlContextInputValue`
- `urlContextUrls`
- `isUrlContextPanelOpen`
- `onChange`
- `onToggleWebSearch`
- `onUrlContextInputChange`
- `onToggleUrlContextPanel`
- `onAddUrlContextUrl`
- `onRemoveUrlContextUrl`
- `onSubmit`
- `isSubmitting`
- `disabled`

所以它本质上是：

- 输入展示层
- 输入交互层

而不是：

- 消息状态源头

---

## 2. 来自父层的输入

### `value`

作用：
- 当前输入框内容

### `onChange`

作用：
- 当用户输入时，把最新文本回传给父层

### `onSubmit`

作用：
- 当用户点击发送或按回车时，触发发送逻辑

### `isSubmitting`

作用：
- 当前是否正在发送消息

### `disabled`

作用：
- 是否整体禁用输入区

---

## 3. 本组件自己的引用与派生状态

### `textareaRef`

```tsx
const textareaRef = useRef<HTMLTextAreaElement | null>(null);
```

作用：
- 直接拿到底层 textarea DOM

主要用于：

- 动态调整高度
- 重新聚焦输入框

### `canSend`

```tsx
const canSend = value.trim().length > 0 && !isSubmitting && !disabled;
```

作用：
- 统一决定发送按钮是否可点击

它不是 state，而是根据 props 派生出来的即时结果。

### `hasUrlContext`

作用：
- 当前是否已经确认过至少一个 URL

### `canToggleWebSearch`

作用：
- 联网按钮当前是否允许切换

### `canToggleUrlContext`

作用：
- URL Context 按钮当前是否允许展开 / 收起

### `isUrlLimitWarningVisible`

```tsx
const [isUrlLimitWarningVisible, setIsUrlLimitWarningVisible] = useState(false);
```

作用：
- 控制 URL 超上限时的短时警示态

它会影响：

- 外层输入框红色边框闪动
- 右侧辅助文案切换为红色警示文本

### `urlLimitWarningTimeoutRef`

作用：
- 管理 URL 上限警示的自动恢复定时器
- 避免连续触发时留下旧的 timeout

---

## 4. 本组件的三个 useEffect

### 4.1 高度自适应 effect

依赖：

```tsx
[value]
```

它管理的内容：

- 输入框高度随内容变化自动增长

运行方式：

1. 先拿到 `textareaRef.current`
2. 把高度暂时设为 `0px`
3. 读取新的 `scrollHeight`
4. 把高度设置为 `min(scrollHeight, 240)`

目标：

- 输入内容越多，高度越高
- 但最大不超过 240px，避免输入区无限增高

---

### 4.2 发送完成后焦点回归 effect

依赖：

```tsx
[isSubmitting]
```

它管理的内容：

- 发送完成后把焦点重新放回输入框

运行方式：

- 当 `isSubmitting === false` 时
- 调用 `textareaRef.current?.focus()`

目标：

- 保持连续聊天体验
- 用户发完一条后可以立刻继续输入下一条

---

### 4.3 URL 警示清理 effect

依赖：

```tsx
[]
```

它管理的内容：

- 组件卸载时清掉 URL 上限警示的 timeout

目标：

- 避免组件卸载后定时器继续回写 state
- 保持局部警示逻辑闭环

---

## 5. 输入到发送的行为链路

### 5.0 URL Context 输入

链路：

1. 用户点击底部链接按钮
2. 触发 `onToggleUrlContextPanel`
3. 父层切换 `isUrlContextPanelOpen`
4. `ChatInput` 通过 `AnimatePresence` 展开或收起 URL 区

---

### 5.1 URL 确认

链路：

1. 用户在 URL 输入框中输入
2. 触发 `onUrlContextInputChange`
3. 父层更新 `urlContextInputValue`
4. 用户按下 `Enter`
5. `ChatInput` 调用 `onAddUrlContextUrl()`
6. 父层根据结果决定：
   - `added`
   - `duplicate`
   - `invalid`
   - `limit`
7. 若结果是 `limit`，则本组件触发 `showUrlLimitWarning()`

结果：

- 合法 URL 会进入已确认列表
- 第 5 条 URL 不会进入列表，而是触发局部红色警示

---

### 5.2 URL 删除

链路：

1. 用户点击某条 URL 右侧删除按钮
2. 调用 `onRemoveUrlContextUrl(url)`
3. 父层更新 `urlContextUrls`
4. `ChatInput` 重渲染，已确认 URL 列表同步变化

---

### 5.3 普通输入

链路：

1. 用户在 `Textarea` 中输入
2. 触发 `onChange`
3. 调用父层传入的 `onChange(event.target.value)`
4. 父层更新 `value`
5. `ChatInput` 接收到新的 `value` 并重渲染

---

### 5.4 键盘发送

链路：

1. 用户按下键盘
2. 触发 `onKeyDown`
3. 如果满足：
   - `event.key === "Enter"`
   - `!event.shiftKey`
4. 阻止默认换行行为
5. 调用 `onSubmit()`

结果：
- Enter 发送
- Shift + Enter 换行

---

### 5.5 点击发送按钮

链路：

1. 用户点击按钮
2. 触发 `onClick`
3. 调用 `onSubmit()`

前提：
- `canSend === true`

---

### 5.6 URL 上限警示

链路：

1. 当前已确认 URL 数量达到 4
2. 用户继续在 URL 输入框按下 `Enter`
3. `onAddUrlContextUrl()` 返回 `limit`
4. `showUrlLimitWarning()` 设置 `isUrlLimitWarningVisible = true`
5. 外层 `motion.div` 播放一次红色边框闪动
6. 右侧文案临时切换为 `至多输入4条URL`
7. 1.5 秒后自动恢复正常态

---

## 6. 一句话总结

`ChatInput` 的状态流已经从“单一文本输入框”升级为“主消息输入 + URL Context 输入 + 附件入口 + 会话级控制按钮”的局部交互状态机：主数据仍由父层控制，本组件负责把这些状态组织成顺手、连续且可反馈的输入体验。附件入口目前仍属于 `Phase 4.4` 首轮接入能力，需要继续真实文件回归。
