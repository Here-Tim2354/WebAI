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

### Input

- URL Context 输入框
- 用于补充当前这次发送要带上的 URL

### Motion

- 用于 URL 输入区展开/收起动画
- 用于 URL 上限警示时的外层红色边框闪动

### Button

- 联网搜索开关按钮
- URL Context 展开按钮
- 发送 / 停止按钮

---

## 1. 组件职责

`ChatInput` 是聊天页面底部输入区。

它负责：

- 接收用户输入
- 响应回车发送
- 响应按钮发送
- 管理输入框高度自适应
- 在发送中控制交互可用性
- 承接会话级联网搜索开关入口
- 承接请求级 URL Context 输入、确认、删除与上限反馈

---

## 2. 顶层结构

当前结构已经不是“一个输入框 + 一个发送按钮”，而是三层：

```tsx
<motion.div>
  <AnimatePresence>
    {isUrlContextPanelOpen ? <motion.div>...</motion.div> : null}
  </AnimatePresence>

  <div>
    <Textarea ... />
    <div>
      <Button ... />
      <Button ... />
      <Button ...>发送</Button>
    </div>
  </div>
</motion.div>
```

也就是说，这个组件现在主要由两大区域组成：

- 上方可展开的 URL Context 输入层
- 下方主消息输入层与底部控制按钮

---

## 3. URL Context 区域

当 `isUrlContextPanelOpen === true` 时，顶部会展开 URL Context 区。

它当前包含两部分：

- 已确认 URL 列表
- 一条轻量 URL 输入位

### 3.1 已确认 URL 列表

每个 URL 当前以“链接图标 + 截断文本 + 删除按钮”的方式展示。

它负责：

- 展示当前已确认的 URL
- 文本超长时做截断
- 鼠标悬停时通过 `title` 查看完整 URL
- 点击删除按钮后移除对应 URL

### 3.2 URL 输入位

URL 输入位使用的是 `Input`，而不是 `Textarea`。

它负责：

- 展示当前 `urlContextInputValue`
- 在输入时回调 `onUrlContextInputChange`
- 在按下 `Enter` 时尝试确认当前 URL
- 在 URL 数量超上限时触发页面内联警示

右侧辅助文案当前有两种语义：

- 正常态：`Gemini将检索输入的URL`
- 上限警示态：`至多输入4条URL`

---

## 4. 主消息输入区域

主消息输入框使用的是 `Textarea`。

它负责：

- 展示当前 `value`
- 在输入时回调 `onChange`
- 在按下回车且未按 Shift 时发送

这里的行为约定是：

- `Enter`：发送消息
- `Shift + Enter`：换行

这是一种典型聊天输入框交互。

---

## 5. 底部控制按钮区域

底部控制区当前包括三个入口：

- 联网搜索开关按钮
- URL Context 展开按钮
- 发送 / 停止按钮

### 5.1 联网搜索开关按钮

它负责：

- 展示当前会话的联网搜索开关状态
- 点击后调用 `onToggleWebSearch`
- 根据当前模型能力决定按钮是否高亮或弱化

### 5.2 URL Context 按钮

它负责：

- 展开 / 收起 URL Context 区
- 通过角标展示当前已确认 URL 数量

### 5.3 发送 / 停止按钮

右下角按钮负责：

- 未生成时点击执行 `onSubmit`
- 生成中点击执行 `onStop`
- 根据 `canSend / canStop` 决定是否禁用

`canSend` 的判断条件是：

- 输入不为空
- 当前不在发送中
- 输入区未被禁用

---

## 6. 一句话理解

`ChatInput` 现在不只是一个文本输入框，而是聊天工作区的底部控制终端：主消息输入、会话级联网开关、请求级 URL Context 和发送控制都在这里汇合。
