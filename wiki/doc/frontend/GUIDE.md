---
aliases:
  - Frontend Docs
  - 前端文档索引
---

# Frontend 文档索引

这组笔记只解释前端可见层和前端状态层。读的时候先抓一条主线：`src/app/page.tsx` 在服务端准备首屏数据，`ChatShell` 把页面壳、弹窗和各个 Hook 拼起来，`useChatWorkspace` 管会话与模型，`useChatSession` 管消息缓存和流式任务，最后由 `MessageList -> MessageBubble -> MarkdownMessage -> CodeBlock` 渲染内容。

## 阅读顺序

1. [[app/page]]：首页 Server Component，负责认证和首屏数据。
2. [[components/chat-shell]]：客户端页面壳，所有大块 UI 和 Hook 在这里汇合。
3. [[hooks/use-chat-workspace]]：会话列表、激活会话、模型、提示词、联网和 thinking 档位。
4. [[hooks/use-chat-session]]：消息缓存、发送、编辑、重新生成、停止生成、URL 与附件草稿。
5. [[components/message-list]]、[[components/message-bubble]]：消息区域的滚动、操作和单条消息视觉语义。
6. [[components/chat-input]]：输入区、附件、URL Context、联网和 thinking 控制。
7. [[components/conversation-sidebar]]：侧栏、个人账户、Gemini 设置、收藏和归档。

## 目录

### App 入口

- [[app/layout]]：全局 HTML 壳、字体变量和 metadata。
- [[app/page]]：首页服务端数据恢复。
- [[app/globals]]：Tailwind token、主题、Markdown、代码块和滚动条样式。

### Feature 组件

- [[components/auth-panel]]：未登录入口，密码、验证码和 GitHub 登录。
- [[components/chat-shell]]：登录后工作区总壳。
- [[components/chat-header]]：顶部模型选择、收藏和提示词入口。
- [[components/conversation-sidebar]]：会话导航和账户/模型设置。
- [[components/chat-input]]：底部输入区和附加项草稿。
- [[components/message-list]]：欢迎态、消息列表和回到底部按钮。
- [[components/message-bubble]]：单条消息、编辑、复制、分支、重新生成。
- [[components/markdown-message]]：Markdown、公式、表格和代码块入口。
- [[components/code-block]]：高亮代码块与复制。
- [[components/message-attachments]]：附件预览、图片放大和附加项编辑弹窗。
- [[components/message-url-context]]：URL Context 展示和编辑小组件。
- [[components/model-icon]]：模型图标映射。
- [[components/workspace-notice]]：顶部轻提示。

### Hooks

- [[hooks/use-chat-workspace]]：工作区会话编排。
- [[hooks/use-chat-session]]：消息会话编排。
- [[hooks/use-fetched-models]]：Gemini 模型拉取、启停和默认项同步。
- [[hooks/use-message-scroll]]：消息区自动吸底和用户滚动意图。

### Lib

- [[lib/chat-stream]]：NDJSON 流消费与 assistant 快照合并。
- [[lib/attachment-client]]：附件选择前的客户端预校验。
- [[lib/clipboard]]：复制文本的 Clipboard API 与降级方案。
- [[lib/gemini-runtime-config]]：按用户隔离的 Gemini Key / URL 本地配置。
- [[lib/motion-presets]]：Motion 动画参数。
- [[lib/url-context]]：URL 标准化、展示和数量上限。

### UI Primitive

- [[ui/alert]]、[[ui/badge]]、[[ui/button]]、[[ui/dialog]]、[[ui/dropdown-menu]]
- [[ui/input]]、[[ui/scroll-area]]、[[ui/scroll-options]]、[[ui/sheet]]、[[ui/textarea]]、[[ui/tooltip]]

