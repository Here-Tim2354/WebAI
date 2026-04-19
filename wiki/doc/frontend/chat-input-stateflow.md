---
aliases:
  - ChatInput 状态流
---

# ChatInput 前端状态流说明

本文档用于理解 `ChatInput` 的前端运行机制，而不是页面展示结构。

代码入口：
- `src/components/chat/chat-input.tsx`

关联笔记：
- [[chat-input]]
- [[chatshell-stateflow]]

## 1. 组件定位

`ChatInput` 是一个典型的受控输入组件。

它自己不保存输入文本，而是依赖父层传入：

- `value`
- `onChange`
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

---

## 4. 本组件的两个 useEffect

### 4.1 高度自适应 effect

依赖：

```tsx
[value]
```

它管理的内容：

- 输入框高度随内容变化自动增长

当前实现：

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

当前实现：

- 当 `isSubmitting === false` 时
- 调用 `textareaRef.current?.focus()`

目标：

- 保持连续聊天体验
- 用户发完一条后可以立刻继续输入下一条

---

## 5. 输入到发送的行为链路

### 5.1 普通输入

链路：

1. 用户在 `Textarea` 中输入
2. 触发 `onChange`
3. 调用父层传入的 `onChange(event.target.value)`
4. 父层更新 `value`
5. `ChatInput` 接收到新的 `value` 并重渲染

---

### 5.2 键盘发送

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

### 5.3 点击发送按钮

链路：

1. 用户点击按钮
2. 触发 `onClick`
3. 调用 `onSubmit()`

前提：
- `canSend === true`

---

## 6. 一句话总结

`ChatInput` 的状态流核心很简单：文本内容由父层控制，本组件负责输入交互、焦点控制和高度自适应，让发送体验更像一个真正的聊天输入框。
