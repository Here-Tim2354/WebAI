# WebAI Quickstart

这是一份给“重新回到项目时”的快速入口文档。目标不是把所有内容讲完，而是用最短路径恢复你对项目的理解。

## 推荐阅读顺序

1. [[plan/phase/phase_overview|phase_overview]]
2. [[plan/phase/current_todo|current_todo]]
3. `src/app/page.tsx`
4. `src/components/chat/chat-shell.tsx`
5. `src/components/chat/use-chat-workspace.ts`
6. `src/components/chat/use-chat-session.ts`
7. `src/app/api/chat/route.ts`
8. `src/lib/supabase/server.ts`
9. `src/lib/supabase/proxy.ts`
10. `src/lib/supabase/auth.ts`
11. `src/lib/supabase/conversations.ts`
12. `src/lib/supabase/messages.ts`
13. `src/lib/supabase/model-registry.ts`
14. `src/lib/ai/index.ts`
15. `src/lib/ai/gemini.ts`
16. `src/lib/ai/openai-compatible.ts`
17. `src/lib/schemas/*.ts`
18. `src/components/chat`
19. `src/components/ui`
20. [[doc/database/GUIDE|database docs]]
21. [[requirements/scau_database_course_design_ai_readable|requirements docs]]

## 先看什么

如果你只想先恢复主线，不需要整仓库重读，建议按下面的优先级：

1. 先看项目当前阶段和待办，确认现在处于 `Phase 4`，并了解当前主线。
2. 再看 `page.tsx`、`chat-shell.tsx` 和 `use-chat-workspace.ts`，因为它们共同决定页面入口、登录态、会话列表、模型控制项和聊天主工作区。
3. 接着看 `use-chat-session.ts` 和 `/api/chat`，把“发送消息到 AI 回复”这条链路串起来。
4. 然后看 Supabase 相关封装，理解“用户、会话、消息、模型列表”怎么从数据库读写。
5. 最后再看消息展示链路：`message-list.tsx -> message-bubble.tsx -> markdown-message.tsx -> code-block.tsx`，补齐细节实现方式。

## 这几个核心概念

- `Props`：组件的输入参数，类似函数参数。
- `searchParams`：当前 URL 的查询参数，页面可以据此决定提示和跳转。
- `Supabase server client`：服务端读取用户 session、访问数据库的入口。
- `proxy.ts`：负责请求级 session 刷新和 cookie 同步。
- `AuthUser`：项目内部使用的轻量用户对象，不等同于 Supabase 原生 `User`。
- `AIModel`：前端选择器和聊天 API 之间的统一模型描述。
- `modelId`：当前传递的是模型注册表主键，不直接等于上游模型名。

## 主链路

当前项目最重要的链路可以概括成：

1. 页面先读登录态。
2. 登录后加载会话列表和模型列表。
3. 用户发送消息。
4. `/api/chat` 调 AI 并写入消息。
5. 数据库返回最新会话和消息。
6. 前端刷新界面并继续下一轮对话。

## 认证链路

如果你在看登录相关代码，优先顺序是：

1. 首页 `page.tsx`
2. 登录面板 `auth-panel.tsx`
3. `/api/auth/magic-link`
4. `/auth/confirm`
5. `src/lib/supabase/server.ts`
6. `src/lib/supabase/proxy.ts`

如果你是在本地开发时遇到 IAB 登录问题，优先检查：

- 是否启用了 `DEV` 模式
- `.env` 是否包含 `DEV_AUTH_EMAIL`
- `SUPABASE_SECRET_KEY` 是否已配置
- Supabase Dashboard 的 `Site URL` 和 `Redirect URLs` 是否允许本地回调

## 数据库主线

数据库相关阅读建议按下面的顺序：

1. [[doc/database/GUIDE|database/GUIDE]]
2. [[doc/database/00_contract/user_requirements|00_contract/user_requirements]]
3. [[doc/database/00_contract/user_data_dictionary|00_contract/user_data_dictionary]]
4. [[doc/database/10_verified/relation_schema_design|10_verified/relation_schema_design]]
5. [[doc/database/00_contract/entity_relationship_analysis|00_contract/entity_relationship_analysis]]
6. [[doc/database/40_verification/migration_checklist|40_verification/migration_checklist]]
7. `supabase/migrations`

这条顺序的目的，是先理解“为什么要这些表”，再看“怎么设计字段”，最后再看“代码怎么落到数据库”。

