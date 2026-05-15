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
- 会话级思考档位入口
- 请求级 URL Context 输入区
- URL 上限的局部警示反馈
- 图片与文件附加项入口

它自己保存主消息正文草稿，但不保存 URL 列表、附件列表或会话级控制项。父层传入：

- `webSearchEnabled`
- `thinkingLevel`
- `urlContextInputValue`
- `urlContextUrls`
- `attachments`
- `isUrlContextPanelOpen`
- `isUploadingAttachments`
- `onToggleWebSearch`
- `onThinkingLevelChange`
- `onUrlContextInputChange`
- `onAttachmentsChange`
- `onToggleUrlContextPanel`
- `onAddUrlContextUrl`
- `onRemoveUrlContextUrl`
- `onUploadAttachments`
- `onSubmit`
- `onStop`
- `isSubmitting`
- `disabled`

所以它本质上是：

- 输入展示层
- 输入交互层

而不是：

- 消息状态源头

---

## 2. 来自父层的输入

### `onSubmit`

作用：
- 当用户点击发送或按回车时，把本地正文草稿、草稿附件和本次 URL 传给父层发送逻辑

### `isSubmitting`

作用：
- 当前是否正在发送消息

### `disabled`

作用：
- 是否整体禁用输入区

### URL、附件和控制项 props

作用：
- `urlContextInputValue` / `urlContextUrls` 由 `useChatSession` 维护
- `attachments` / `isUploadingAttachments` 由 `useChatSession` 维护
- `webSearchEnabled` / `thinkingLevel` 由 `useChatWorkspace` 根据真实会话或空白页草稿推导
- 模型能力 props 决定联网、URL Context、图片、文件和思考档位入口是否可用

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
const canSend =
  (
    draftValue.trim().length > 0 ||
    attachments.length > 0 ||
    urlContextUrls.length > 0 ||
    pendingUrlContextUrl !== null
  ) &&
  !isSubmitting &&
  !disabled;
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

### `draftValue`

作用：
- 保存主输入框中的正文草稿
- 发送开始时先清空，发送失败时恢复

它留在 `ChatInput` 内部，避免每一次敲字都推动工作区层重渲染。

### `optimisticThinkingLevel`

作用：
- 思考档位菜单切换时先更新按钮展示
- 父层真实 `thinkingLevel` 变化后再同步回来

### `attachmentError`

作用：
- 展示粘贴、拖拽或文件选择时的附件校验和上传错误

### `textareaHeight`

作用：
- 只保存测量后的目标高度，真实高度动画交给 Motion 驱动

---

## 4. 本组件的 useEffect / useLayoutEffect

### 4.1 高度自适应 layout effect

依赖：

```tsx
[draftValue]
```

它管理的内容：

- 输入框高度随内容变化自动增长

运行方式：

1. 先拿到 `textareaRef.current`
2. 临时把高度设为 `auto`
3. 读取新的 `scrollHeight`
4. 把目标高度限制在 224px 内
5. 再把目标高度交给 Motion 的 `animate`

目标：

- 输入内容越多，高度越高
- 但最大不超过 224px，避免输入区无限增高

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

### 4.4 思考档位同步 effect

依赖：

```tsx
[thinkingLevel]
```

它管理的内容：

- 把父层传入的真实思考档位同步到本地 `optimisticThinkingLevel`

目标：

- 菜单点击时可以立刻反馈
- 如果父层回滚或切换会话，本地按钮展示也能跟随真实状态

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
2. 触发本地 `setDraftValue(event.target.value)`
3. `ChatInput` 本地重渲染并重新测量 textarea 高度

正文草稿不再上提到 `ChatShell` 或 `useChatSession`。

---

### 5.4 键盘发送

链路：

1. 用户按下键盘
2. 触发 `onKeyDown`
3. 如果满足：
   - `event.key === "Enter"`
   - `!event.shiftKey`
4. 阻止默认换行行为
5. 调用 `handleSubmitDraft()`
6. `handleSubmitDraft()` 计算待提交正文、附件和 URL
7. 调用父层 `onSubmit(content, attachments, urls)`

结果：
- Enter 发送
- Shift + Enter 换行

---

### 5.5 点击发送按钮

链路：

1. 用户点击按钮
2. 触发 `onClick`
3. 如果正在生成，调用 `onStop()`
4. 如果没有生成，调用 `handleSubmitDraft()`

前提：
- `canSend === true`
- 正在生成时不看 `canSend`，而是通过 `canStop` 允许停止按钮可点

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

### 5.7 附件上传

链路：

1. 用户通过文件按钮、粘贴或拖拽提供文件
2. 组件先调用 `getAttachmentFileValidationError()` 做本地预校验
3. 校验失败时写入 `attachmentError`
4. 校验通过时调用父层 `onUploadAttachments(files)`
5. 上传成功后通过 `onAttachmentsChange()` 追加到草稿附件列表
6. 上传失败时把错误文案写入 `attachmentError`

结果：
- 附件状态仍由父层持有
- 输入区只负责入口、校验反馈和预览交互

---

### 5.8 思考档位切换

链路：

1. 用户打开思考档位菜单
2. 点击 `minimal / low / medium / high`
3. 组件先更新 `optimisticThinkingLevel`
4. 调用父层 `onThinkingLevelChange(nextThinkingLevel)`
5. 父层根据当前是否有真实会话，决定写入草稿态或 patch 当前会话

---

## 6. 一句话总结

`ChatInput` 的状态流已经从“单一文本输入框”升级为“主消息输入 + URL Context 输入 + 附件入口 + 会话级控制按钮”的局部交互状态机：正文草稿留在本组件内部，URL、附件和会话级控制项由父层管理，本组件负责把这些状态组织成顺手、连续且可反馈的输入体验。附件入口目前仍属于 `Phase 4.4` 首轮接入能力，需要继续真实文件回归。
