# Current Todo

更新时间：2026-03-25 23:35:00

## 当前阶段

- 当前项目处于 `Phase 3`
- `Phase 1` 已完成并通过验收
- `Phase 2` 的前端体验收口已基本完成
- 当前判断：`Phase 3.1` 已完成主要口径收口，`Phase 3.2` 已完成核心表与 migration 落地
- 当前主线：`继续推进 Supabase 接入层与会话级 CRUD，让聊天链路真正建立在数据库之上`

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
- 已完成本地 `Phase 1` 验收：`npm run check:phase1`
- 已完成基础工程校验：`npm run lint`、`npm run typecheck`、`npm run build`
- 已更新 `plan/phase/phase_overview.md`，明确新的项目定位与 phase 顺序
- 已确认课程作业主线将前置 `Supabase 持久化与会话 CRUD 系统`
- 已完成 `Phase 2` 的前端视觉与交互收口
- 已新增并完善 `plan/phase/phase_3.md`，明确 `Phase 3` 的目标、顺序、边界与 MCP/官方文档前置确认要求
- 已完成 `Phase 3.1` 的数据库口径收口：
  - 已按课程设计要求复查 `plan/database/`
  - 已明确当前阶段最小主线为：会话 CRUD + 消息持久化
  - 已将 Supabase 身份口径收口为：`auth.users + profiles`
  - 已将 `favorites / search_records` 明确为整体设计保留项，而非首批强制落地项
- 已更新数据库相关文档：
  - `plan/database/user_requirements.md`
  - `plan/database/user_data_dictionary.md`
  - `plan/database/entity_relationship_analysis.md`
  - `plan/database/relation_schema_design.md`
- 已将整体 E-R 图产物统一重命名为：
  - `plan/database/overall_er_graph.dbml`
  - `plan/database/overall_er_graph.sql`
  - `plan/database/overall_er_graph.png`
  - `plan/database/overall_er_graph.pdf`
- 已完成 `Phase 3.2` 的核心 schema 落地：
  - 已新增 migration：`supabase/migrations/20260325_phase3_core_schema.sql`
  - 已在 Supabase 项目中成功应用 migration
  - 已落地 `public.profiles`
  - 已落地 `public.conversations`
  - 已落地 `public.messages`
  - 已配置枚举、主外键、索引、更新时间触发器
  - 已配置 `auth.users -> public.profiles` 的新用户触发器
  - 已为三张核心表开启基础 `RLS`
  - 已修复 `set_updated_at` 的 `search_path` 安全提示

## 当前推进依据

- 阶段概要：`plan/phase/phase_3.md`
- 课程要求：`requirements/scau_database_course_design_ai_readable.md`
- Supabase 执行清单：`requirements/supabase_course_design_checklist.md`
- 数据库文档目录：`plan/database/`
- 当前阶段的推进应优先遵循：
  - 课程要求与数据库主线闭环
  - 项目内数据库文档
  - `Supabase MCP` 与官方文档交叉确认后的实现判断

## 下一阶段重点

- 当前应进入 `Phase 3.3`
- 下一步重点不是继续扩展表，而是先建立稳定的 `Supabase` 接入层
- `Phase 3.3` 重点包括：
  - 安装并接入 `@supabase/supabase-js` 与 `@supabase/ssr`
  - 增加 Supabase 环境变量与配置说明
  - 建立浏览器端 `Supabase client`
  - 建立服务端 `Supabase client`
  - 明确 `Next.js App Router` 下的身份获取方式
  - 为后续会话 CRUD 和聊天持久化提供统一数据库访问入口
- 在 `Phase 3.3` 完成后，应继续进入：
  - `Phase 3.4`：会话级 CRUD
  - `Phase 3.5`：聊天持久化闭环

## 当前限制与提醒

- 当前虽然已在 Supabase 中落地核心表，但项目代码尚未接入 Supabase
- 当前前端仍然是 `单页单会话、本地状态驱动、刷新丢失`
- 当前还不能误判为已完成会话系统或数据库驱动聊天
- 当前 Supabase 首批只落地了：
  - `profiles`
  - `conversations`
  - `messages`
- `favorites` 与 `search_records` 仍然只保留在整体设计中，尚未进入首批 schema
- `Supabase MCP` 当前可用，但不应假定其始终稳定；关键设计仍应和官方文档交叉确认
- 若要接真实 Gemini，请优先确认以下环境变量：
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`
  - `GEMINI_BASE_URL`（可选）

## 备注

- 当前阶段判断基于现有文档、仓库实现、Supabase 实际项目状态和 MCP/官方资料交叉确认，不是静态猜测
- `npm run build` 在沙盒内仍会遇到 `spawn EPERM`，但在沙盒外复跑可通过，这属于运行环境限制，不属于仓库缺陷
- 当前评估结论是：
  - `Phase 3.1` 已基本完成
  - `Phase 3.2` 已完成核心数据库落地
  - 项目可以把主线继续推进到 `Phase 3.3`
