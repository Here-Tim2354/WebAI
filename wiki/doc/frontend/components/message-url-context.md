# `src/features/chat/components/message-url-context.tsx`

## 文件定位

这个文件负责消息里的 URL Context 展示和编辑小组件。它被 `MessageBubble` 的 user 消息展示态和编辑态使用。

## 导出内容

- `MessageUrlContextSummary`：只读摘要。
- `EditableMessageUrlContext`：可编辑 URL 列表。
- `MAX_EDIT_URL_CONTEXT_ITEMS` 和几个 URL 工具函数的再导出。

## `MessageUrlContextSummary`

展示前 `maxVisibleItems` 个 URL，默认 3 个，剩余数量显示为 `+N`。URL 文本通过 `getUrlDisplayText` 压缩成 hostname + pathname，避免整条长链接撑破气泡。

## `EditableMessageUrlContext`

这个组件本身不保存状态，所有状态都由父组件传入：

- `urls`
- `inputValue`
- `error`
- `expanded`
- `disabled`

它只负责触发：展开、输入变化、添加、移除、清错。

## 设计缘由

URL Context 是消息 metadata 的一部分，不应该在这个小组件里自建业务状态。这样编辑 user 消息时，正文、URL、附件可以一起由 `MessageBubble` 汇总后提交。

## 返回组件规模

只读摘要是消息气泡里的小横条。编辑组件是一个轻量块，展开后包含 URL 输入框和添加按钮。

## 代码展开

### Summary 的截断策略

`MessageUrlContextSummary` 默认最多展示 3 个 URL。每个链接最大宽度 `14rem`，内部 truncate。多出的 URL 不展开列表，而是显示 `+N`。这是为了保护消息气泡宽度。

`href` 使用原 URL，展示文本用 `getUrlDisplayText`。所以用户看到的是短域名路径，点击时仍然打开完整地址。

### Editable 组件为什么不自己校验

`EditableMessageUrlContext` 收到 `error` 和 `onClearError`，但不直接调用 `normalizeUrlCandidate`。这是为了让父组件控制“什么时候算错误、什么时候清错误、什么时候提交”。

它只负责把 Enter、按钮点击、移除动作回调出去。这样后续如果编辑态要和附件弹窗共用校验，也不会被这个小组件卡住。
