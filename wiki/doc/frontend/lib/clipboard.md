# `src/features/chat/lib/clipboard.ts`

## 文件定位

`clipboard.ts` 是复制文本的通用工具。`ChatShell` 的消息复制动作会调用 `copyTextToClipboard`。

## 核心函数

- `copyTextToClipboard(text)`：优先使用 `navigator.clipboard.writeText`。
- `copyTextWithFallback(text)`：创建隐藏 textarea，选中后调用 `document.execCommand("copy")`。

## 设计缘由

复制看似简单，但浏览器权限、HTTP 环境、嵌入环境都会让 Clipboard API 失败。这里保留老式 fallback，是为了让“复制消息”在更多环境里可用。

## 返回规模

没有 UI。复制成功或失败由调用方决定怎么反馈。

## 代码展开

### fallback 的 DOM 生命周期

`copyTextWithFallback` 创建 textarea 后，会立刻 append 到 body、focus、select。执行完 `document.execCommand("copy")` 后，无论成功失败都会在 `finally` 里移除。

这点很重要：隐藏 textarea 只是临时桥，不应该残留在 DOM 里影响页面焦点或可访问性。

### 为什么 catch 后还 fallback

现代 Clipboard API 可能存在但失败，比如权限被拒绝。代码不是看到 API 存在就结束，而是在 catch 中继续尝试 fallback。这样能覆盖更多浏览器环境。
