# Current Todo

更新时间：2026-03-20 12:12:00

## 当前阶段

- 当前项目处于 `Phase 1`
- 目标是完成聊天主链路 MVP：`发送消息 -> 服务端调用 Gemini -> 返回 assistant 回复 -> 支持多轮对话`
- 当前判断：`Phase 1 已通过正式验收，可关闭并准备进入下一阶段`

## 当前状态概览

### 已完成

- 已初始化 `Next.js App Router + TypeScript + Zod` 工程
- 已接入 `@google/genai` 服务端调用
- 已实现聊天 API route
- 已实现单页单会话的多轮对话
- 已实现输入框、发送按钮、assistant 占位气泡、错误气泡
- 已实现 Markdown 渲染、代码块高亮、代码复制
- 已支持自定义 Gemini 服务端 URL：`GEMINI_BASE_URL`
- 已修正服务端环境变量错误分类
- 已收掉侧栏伪功能入口，使产品边界与 `Phase 1` 一致
- 默认模型已调整为更稳妥的 `gemini-2.5-flash`
- 已补充自动验收脚本：`npm run check:phase1`
- 已完成基础工程校验：`npm run lint`、`npm run typecheck`、`npm run build`
- 已完成本地 Phase 1 验收：`npm run check:phase1`

## 本轮验收覆盖

- 首页空态与主布局可正常渲染
- 侧栏不再暴露超出 `Phase 1` 的伪功能入口
- 合法聊天请求可返回 `assistant` 消息
- 非法 JSON 请求返回 `400`
- 非法消息结构返回 `400`
- 缺失 `GEMINI_API_KEY` 返回清晰的 `500`
- 非法 `GEMINI_BASE_URL` 返回清晰的 `500`
- 本地 mock 链路已覆盖 `/api/chat` 到服务端 Gemini 调用适配

## 进入下一阶段前的提醒

- 若要进入 `Phase 2`，重点应转向流式输出、增量渲染和中断生成
- 当前仍然是 `单页单会话、刷新丢失`，不要误判为已完成会话系统
- 若要接真实 Gemini，请优先确认以下环境变量：
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`
  - `GEMINI_BASE_URL`（可选）

## 备注

- 本轮验收结论基于真实命令执行，不是静态推断
- `npm run build` 在沙盒内会遇到 `spawn EPERM`，在沙盒外复跑可通过，这属于运行环境限制，不属于仓库缺陷
- 当前评估结论是：`Phase 1 可签收，建议开始准备 Phase 2 规划`
