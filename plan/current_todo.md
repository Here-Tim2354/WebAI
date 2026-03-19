# Current Todo

更新时间：2026-03-19 23:35:00

## 当前阶段

- 当前项目处于 `Phase 1`
- 目标仍然是完成聊天主链路 MVP：`发送消息 -> 服务端调用 Gemini -> 返回 assistant 回复 -> 支持多轮对话`
- 当前判断：`Phase 1 主链路基本完成，但暂不建议正式验收关闭`

## 当前状态概览

### 已完成

- 已初始化 `Next.js App Router + TypeScript + Zod` 工程
- 已接入 `@google/genai` 服务端调用
- 已实现聊天 API route
- 已实现单页单会话的多轮对话
- 已实现输入框、发送按钮、assistant 占位气泡、错误气泡
- 已实现 Markdown 基础渲染
- 已增加代码块复制按钮
- 已支持自定义 Gemini 服务端 URL：`GEMINI_BASE_URL`
- 已完成基础工程校验：`npm run typecheck`、`npm run lint`、`npm run build`

### 当前不能视为 Phase 1 完全收尾的原因

- 代码块高亮存在功能性问题，当前自定义 Markdown 渲染会破坏 `rehype-highlight` 生成的节点
- 服务端环境变量错误会被错误归类成客户端请求格式错误
- 侧栏存在多处“看起来可用但实际上无行为”的入口，和当前 phase 的产品边界不一致

## 本轮评审确认的问题

### P1

- `src/components/chat/markdown-message.tsx`
- 当前 `code` 组件通过 `String(children)` 处理代码块内容，会把高亮节点转成 `[object Object]`
- 影响：
  - 代码块高亮实际失效
  - 复制按钮复制出的文本可能被污染
  - 不满足 Phase 1 中“代码高亮 + 代码复制”的完成要求

### P2

- `src/app/api/chat/route.ts`
- `src/lib/env/server.ts`
- 当前 API route 将所有 `ZodError` 都返回成 `400`
- `getServerEnv()` 的环境变量解析失败同样会抛出 `ZodError`
- 影响：
  - 缺失 `GEMINI_API_KEY`
  - `GEMINI_BASE_URL` 非法
  - 其他服务端配置错误
- 上述问题会被误报为“请求格式错误”，不利于联调和排查

### P2

- `src/components/chat/chat-shell.tsx`
- 当前侧栏包含：
  - `Search chats`
  - `Images`
  - `Apps`
  - `Projects`
  - `Recent`
- 这些入口现在都没有真实行为，但视觉上是可点击功能入口
- 影响：
  - 用户会误以为已支持搜索、多会话、图片或项目系统
  - 与 `Phase 1` 的“单页单会话、刷新丢失”边界冲突

## 建议的下一步优先级

1. 先修复 Markdown 代码块渲染问题，确保高亮和复制真实可用
2. 再修正服务端错误分类，将环境变量/服务端错误与请求参数错误分开处理
3. 最后收掉侧栏的伪功能入口，改成纯骨架样式或不可交互展示

## 接手建议

- 如果接手人要继续推进 `Phase 1`，不要直接进入体验微调或 `Phase 2`
- 当前最应该做的是先把上述 3 个问题收口，再决定是否正式关闭 `Phase 1`
- 若需要联调，请优先确认以下环境变量：
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`
  - `GEMINI_BASE_URL`（可选）

## 备注

- 当前仓库已经能构建通过，但“能构建”不等于“当前 phase 已完全可签收”
- 当前评估结论是：`可继续开发，但不建议宣告 Phase 1 完成`
