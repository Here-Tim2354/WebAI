---
aliases:
  - ChatInput
  - ChatInput 页面结构
---

# ChatInput 页面结构说明

本文档用于快速理解 `ChatInput` 组件在页面中的职责，以及它在页面底部展示什么。

代码入口：
- `src/components/chat/chat-input.tsx`

关联笔记：
- [[chat-input-stateflow]]
- [[chatshell]]

## 本组件所用到的子组件

### Textarea

- 多行文本输入框
- 用于用户输入聊天内容

### Button

- 发送按钮

---

## 1. 组件职责

`ChatInput` 是聊天页面底部输入区。

它负责：

- 接收用户输入
- 响应回车发送
- 响应按钮发送
- 管理输入框高度自适应
- 在发送中控制交互可用性

---

## 2. 顶层结构

整体结构很简单：

```tsx
<motion.div>
  <Textarea ... />
  <div>
    <Button ...>发送</Button>
  </div>
</motion.div>
```

也就是说，这个组件主要由两部分组成：

- 输入框
- 发送按钮

---

## 3. 输入框区域

输入框使用的是 `Textarea`。

它负责：

- 展示当前 `value`
- 在输入时回调 `onChange`
- 在按下回车且未按 Shift 时发送

这里的行为约定是：

- `Enter`：发送消息
- `Shift + Enter`：换行

这是一种典型聊天输入框交互。

---

## 4. 发送按钮区域

右下角按钮负责：

- 点击时执行 `onSubmit`
- 根据 `canSend` 决定是否禁用

`canSend` 的判断条件是：

- 输入不为空
- 当前不在发送中
- 输入区未被禁用

---

## 5. 一句话理解

`ChatInput` 本质上是聊天工作区的输入终端：用户所有新消息都从这里进入系统。
