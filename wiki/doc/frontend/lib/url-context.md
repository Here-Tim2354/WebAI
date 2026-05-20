# `src/features/chat/lib/url-context.ts`

## 文件定位

`url-context.ts` 是 URL Context 的纯工具函数。它被 `ChatInput`、`MessageUrlContext` 和 `useChatSession` 使用。

## 核心内容

- `MAX_URL_CONTEXT_ITEMS = 4`：单条请求最多 4 条 URL。
- `getUrlDisplayText(url)`：展示时压缩成 hostname + pathname。
- `normalizeUrlCandidate(url)`：补全协议、校验 http/https，并返回标准化 URL。
- `areUrlListsEqual(left, right)`：按顺序比较两个 URL 列表。

## 设计缘由

URL 输入可能来自用户粘贴，也可能不带协议。标准化逻辑独立出来后，输入区和编辑弹窗不会出现两套判断。

## 返回规模

没有 UI。它是 URL Context 的规则源之一。

## 代码展开

### normalizeUrlCandidate

如果用户输入没有协议，比如 `example.com/a`，函数会补成 `https://example.com/a` 再交给 `new URL`。如果用户输入已经带协议，就直接使用。

最后只允许 `http:` 和 `https:`。这会挡掉 `javascript:`、`file:` 等不应该进入模型请求的 scheme。

### areUrlListsEqual

这个函数按顺序比较。两个 URL 集合元素相同但顺序不同，会被认为不同。当前 URL Context 的语义是用户输入顺序，因此顺序本身有意义。
