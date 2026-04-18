# WebAI Quickstart

这是一份给“重新回到项目时”的快速入口文档。目标不是把所有内容讲完，而是用最短路径恢复你对项目的理解。

## 推荐阅读顺序

1. [phase_overview.md](</E:/Programming/WebAI/wiki/plan/phase/phase_overview.md>)
2. [current_todo.md](</E:/Programming/WebAI/wiki/plan/phase/current_todo.md>)
3. [page.tsx](</E:/Programming/WebAI/src/app/page.tsx>)
4. [chat-shell.tsx](</E:/Programming/WebAI/src/components/chat/chat-shell.tsx>)
5. [use-chat-session.ts](</E:/Programming/WebAI/src/components/chat/use-chat-session.ts>)
6. [chat route](</E:/Programming/WebAI/src/app/api/chat/route.ts>)
7. [supabase/server.ts](</E:/Programming/WebAI/src/lib/supabase/server.ts>)
8. [supabase/proxy.ts](</E:/Programming/WebAI/src/lib/supabase/proxy.ts>)
9. [supabase/auth.ts](</E:/Programming/WebAI/src/lib/supabase/auth.ts>)
10. [conversations.ts](</E:/Programming/WebAI/src/lib/supabase/conversations.ts>)
11. [messages.ts](</E:/Programming/WebAI/src/lib/supabase/messages.ts>)
12. [model-registry.ts](</E:/Programming/WebAI/src/lib/supabase/model-registry.ts>)
13. [ai/index.ts](</E:/Programming/WebAI/src/lib/ai/index.ts>)
14. [ai/gemini.ts](</E:/Programming/WebAI/src/lib/ai/gemini.ts>)
15. [ai/openai-compatible.ts](</E:/Programming/WebAI/src/lib/ai/openai-compatible.ts>)
16. [schemas/*.ts](</E:/Programming/WebAI/src/lib/schemas>)
17. [chat components](</E:/Programming/WebAI/src/components/chat>)
18. [ui components](</E:/Programming/WebAI/src/components/ui>)
19. [database docs](</E:/Programming/WebAI/wiki/plan/database>)
20. [requirements docs](</E:/Programming/WebAI/wiki/requirements>)

## 先看什么

如果你只想先恢复主线，不需要整仓库重读，建议按下面的优先级：

1. 先看项目当前阶段和待办，确认现在处于 `Phase 4`，并了解当前主线。
2. 再看 `page.tsx` 和 `chat-shell.tsx`，因为它们决定了页面入口、登录态、会话列表和聊天主工作区。
3. 接着看 `use-chat-session.ts` 和 `/api/chat`，把“发送消息到 AI 回复”这条链路串起来。
4. 然后看 Supabase 相关封装，理解“用户、会话、消息、模型列表”怎么从数据库读写。
5. 最后再看 UI 组件和 schema，补齐细节实现方式。

## 这几个核心概念

- `Props`：组件的输入参数，类似函数参数。
- `searchParams`：当前 URL 的查询参数，页面可以据此决定提示和跳转。
- `Supabase server client`：服务端读取用户 session、访问数据库的入口。
- `proxy.ts`：负责请求级 session 刷新和 cookie 同步。
- `AuthUser`：项目内部使用的轻量用户对象，不等同于 Supabase 原生 `User`。
- `AIModel`：前端选择器和聊天 API 之间的统一模型描述。

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

1. [user_requirements.md](</E:/Programming/WebAI/wiki/plan/database/user_requirements.md>)
2. [user_data_dictionary.md](</E:/Programming/WebAI/wiki/plan/database/user_data_dictionary.md>)
3. [relation_schema_design.md](</E:/Programming/WebAI/wiki/plan/database/relation_schema_design.md>)
4. [entity_relationship_analysis.md](</E:/Programming/WebAI/wiki/plan/database/entity_relationship_analysis.md>)
5. [supabase/migrations](</E:/Programming/WebAI/supabase/migrations>)

这条顺序的目的，是先理解“为什么要这些表”，再看“怎么设计字段”，最后再看“代码怎么落到数据库”。

## 你可以继续问我的内容

- 某个文件的作用是什么
- 某个 React / Next / Supabase 语法怎么理解
- 某条请求链路是怎么走的
- 某个数据库表为什么这样设计
- 某个 AI 调用层为什么要拆开

## 维护原则

- 这份文档面向快速回到项目，不追求详尽。
- 如果后续主线切到 `Phase 4` 的新能力，可以继续在这里补“入口文件”和“关键链路”。
- 如果你想让这份文档更像真正的导航页，可以继续加一节“常用文件地图”。
