# Current Todo

更新时间：2026-03-29 00:00:00

## 当前阶段

- 当前项目处于 `Phase 3`
- `Phase 1` 已完成并通过验收
- `Phase 2` 的前端体验收口已基本完成
- 当前判断：`Phase 3.1`、`Phase 3.2`、`Phase 3.3` 已完成，`Phase 3.4` 的会话 CRUD 已基本落地
- 当前主线：`进入 Phase 3.5 的消息持久化闭环`

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
- 默认模型已调整为更稳妥的 `gemini-2.5-flash`
- 已补充自动验收脚本：`npm run check:phase1`
- 已完成本地 `Phase 1` 验收：`npm run check:phase1`
- 已完成基础工程校验：`npm run lint`、`npm run typecheck`
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
- 已完成 `Phase 3.3` 的 Supabase 接入层初始化：
  - 已安装 `@supabase/supabase-js` 与 `@supabase/ssr`
  - 已新增 Supabase 环境变量校验
  - 已建立浏览器端 `Supabase client`
  - 已建立服务端 `Supabase client`
  - 已更新 `.env.example`，补充 Supabase 配置项
- 已完成 `Phase 3.4` 的会话 CRUD 闭环：
  - 已接入最小可用的 `Supabase Auth` 邮箱 magic link 登录链路
  - 已实现 `auth confirm route` 与 `proxy.ts` 的 SSR session 刷新方案
  - 已实现当前用户获取与工作区鉴权分层
  - 已将首页切分为：未登录态 / 已登录工作区
  - 已将左侧侧栏替换为真实会话列表
  - 已实现会话列表查询
  - 已实现点击 `New` 后立即创建空会话并自动选中
  - 已实现会话重命名
  - 已实现会话真删除
  - 已完成会话级接口的基础错误处理修复
  - 已完成本轮实现后的 `npm run lint` 与 `npm run typecheck`
- 已确认当前 `Phase 3.4` 仍存在一个 `Auth` 相关 bug，尚待修复：
  - 当前问题不应被误判为“认证链路已稳定可交付”
  - 具体问题参考用户提供的排查线索与后续修复记录
  - 在 Auth 修稳之前，不应直接把 `Phase 3.4` 视为完全收口

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

- `Phase 3.5` 重点包括：
  - 当前未打开会话时，首次发送自动创建会话
  - 用户消息写入 `public.messages`
  - 服务端调用 Gemini 后写入 assistant 消息
  - 打开历史会话时恢复完整消息记录
  - 会话标题与消息流的边界整理，避免耦合失控
- 在 `Phase 3.5` 完成后，再进入：
  - `Phase 3.6`：RLS 验证、数据库说明补全与答辩支撑材料整理

## 当前限制与提醒

- 当前虽然已经完成真实用户下的会话 CRUD，但聊天消息仍未持久化
- 当前 `messages` 表尚未接入实际聊天主链路
- 当前打开历史会话时，还不能恢复数据库中的消息记录
- 当前右侧聊天面板仍然是“会话内前端状态聊天”，不是“数据库驱动聊天”
- 当前 Supabase 首批只落地了：
  - `profiles`
  - `conversations`
  - `messages`
- `favorites` 与 `search_records` 仍然只保留在整体设计中，尚未进入首批 schema
- `Supabase MCP` 当前可用，但不应假定其始终稳定；关键设计仍应和官方文档交叉确认
- 当前邮箱登录链路是否可完整跑通，还依赖 Supabase 控制台中的以下配置是否正确：
  - `Auth -> URL Configuration`
  - `Auth -> Email Templates` 中的 magic link / confirm signup 模板
- 若要接真实 Gemini，请优先确认以下环境变量：
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL`
  - `GEMINI_BASE_URL`（可选）

## 备注

- 当前阶段判断基于现有文档、仓库实现、Supabase 实际项目状态和 MCP/官方资料交叉确认，不是静态猜测
- `npm run build` 在当前环境中仍会遇到 `spawn EPERM`，属于运行环境限制，当前不能直接作为仓库缺陷判断依据
- 当前评估结论是：
  - `Phase 3.1` 已完成数据库口径收口
  - `Phase 3.2` 已完成核心数据库落地
  - `Phase 3.3` 已完成 Supabase 接入层初始化
  - `Phase 3.4` 已完成真实用户下的会话 CRUD 主体，但 Auth 尚未收口
  - 推进到 `Phase 3.5`
