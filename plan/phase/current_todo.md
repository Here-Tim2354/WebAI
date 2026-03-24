# Current Todo

更新时间：2026-03-23 22:27:00

## 当前阶段

- 当前项目处于 `Phase 2`
- `Phase 1` 已完成并通过验收
- 当前判断：`Phase 2` 的前端体验收口已基本完成，可以开始把主线转向 `Phase 3`
- 当前主线：`在保持当前聊天体验成果的基础上，尽快推进 Supabase 持久化与会话 CRUD 系统`

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
- 已完成本地 Phase 1 验收：`npm run check:phase1`
- 已完成基础工程校验：`npm run lint`、`npm run typecheck`、`npm run build`
- 已更新 `plan/phase/phase_overview.md`，明确新的项目定位与 phase 顺序
- 已确认课程作业主线将前置 `Supabase 持久化与会话 CRUD 系统`
- 已补充 `plan/phase/phase_2.md`，确认 `Phase 2` 的阶段目标、边界与流式取舍
- 已引入并评估 `frontend-skill`，用于指导 `Phase 2` 的前端体验和视觉优化
- 已整理 `plan/phase/phase_2_frontend_checklist.md`，作为 `Phase 2` 的前端专项执行清单
- 已完成聊天页第一屏和输入区的 `Phase 2` 视觉收口
- 已减少页面说明性文字，保留轻量问候语与标签式占位
- 已实现消息区自动滚动优化与回到底部入口
- 已将聊天状态与滚动逻辑从页面壳中抽离为独立 hooks
- 已将网页配色切换为白色主基调与浅蓝强调色
- 已修正桌面端侧栏跟随页面滚动的问题
- 已更新验收脚本，使其匹配当前首页和输入区表现
- 已完成前端校验：`npm run lint`、`npm run typecheck`、`npm run build`
- 已新增 `plan/database/user_requirements_draft.md`，作为数据库课程设计的用户需求起稿

## 当前推进依据

- 阶段概要：`plan/phase/phase_2.md`
- 前端专项清单：`plan/phase/phase_2_frontend_checklist.md`
- 布局设计规划：`plan/frontend/chat_workspace_layout.md`
- 数据库需求起稿：`plan/database/user_requirements_draft.md`
- `phase_2.md` 负责阶段摘要
- `phase_2_frontend_checklist.md` 负责前端执行项
- `chat_workspace_layout.md` 负责整体布局与扩展窗口
- `user_requirements_draft.md` 负责数据库课程设计中的用户需求起稿
- 当前阶段的讨论与实施，应优先以对应文档的职责为准

## 下一阶段重点

- `Phase 2` 的前端主目标已基本完成
- 当前验收口径已开始同步到新页面状态
- 当前不追求一次性做完整流式输出
- 下一步应尽快推进 `Phase 3`
- `Phase 3` 将成为课程设计主战场，重点包括：
  - 接入 Supabase
  - 设计 `users / conversations / messages` 核心模型
  - 实现会话级 CRUD
  - 让聊天链路真正建立在数据库之上

## 当前限制与提醒

- 当前仍然是 `单页单会话、刷新丢失`，不要误判为已完成会话系统
- 当前尚未接入 Supabase，也未形成课程设计所需的数据库 CRUD 主线
- `Phase 2` 的详细前端目标已拆出独立清单，应避免在 `current_todo` 中重复堆叠
- 若要接真实 Gemini，请优先确认以下环境变量：
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`
  - `GEMINI_BASE_URL`（可选）

## 备注

- 当前阶段判断基于现有文档、代码结构和前端方案讨论，不是静态想象
- `npm run build` 在沙盒内仍会遇到 `spawn EPERM`，但在沙盒外复跑可通过，这属于运行环境限制，不属于仓库缺陷
- 当前评估结论是：`Phase 2` 的前端收口已达到可签收状态，项目可以把主线转向 `Phase 3`
