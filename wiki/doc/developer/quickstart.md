# WebAI Quickstart

这是一份给“重新回到项目时”的快速入口文档。目标不是把所有内容讲完，而是用最短路径恢复你对项目的理解。

## 推荐阅读顺序

1. [[plan/phase/phase_overview|phase_overview]]
2. [[plan/phase/current_todo|current_todo]]
3. `src/app/page.tsx`
4. `src/features/chat/components/chat-shell.tsx`
5. `src/features/chat/components/chat-header.tsx`
6. `src/features/chat/hooks/use-chat-workspace.ts`
7. `src/features/chat/hooks/use-chat-session.ts`
8. `src/features/chat/lib/chat-stream.ts`
9. `src/app/api/chat/route.ts`
10. `src/lib/supabase/server.ts`
11. `src/lib/supabase/proxy.ts`
12. `src/lib/supabase/auth.ts`
13. `src/lib/supabase/profiles.ts`
14. `src/lib/supabase/conversations.ts`
15. `src/lib/supabase/messages.ts`
16. `src/lib/supabase/model-registry.ts`
17. `src/lib/ai/gemini-model-catalog.ts`
18. `src/lib/ai/gemini-model-normalizer.ts`
19. `src/lib/ai/gemini-base-url.ts`
20. `src/lib/ai/index.ts`
21. `src/lib/ai/gemini.ts`
22. `src/lib/schemas/*.ts`
23. `src/features/chat`
24. `src/components/ui`
25. [[doc/database/GUIDE|database docs]]
26. [[doc/developer/deployment|deployment docs]]
27. [[requirements/scau_database_course_design_ai_readable|requirements docs]]

## 先看什么

如果你只想先恢复主线，不需要整仓库重读，建议按下面的优先级：

1. 先看项目当前阶段和待办，确认现在处于 `Phase 4`，并了解当前主线。
2. 再看 `page.tsx`、`chat-shell.tsx`、`chat-header.tsx` 和 `hooks/use-chat-workspace.ts`，因为它们共同决定页面入口、登录态、会话列表、模型控制项和聊天主工作区。
3. 接着看 `hooks/use-chat-session.ts`、`lib/chat-stream.ts` 和 `/api/chat`，把“发送消息到 AI 回复”这条链路串起来。
4. 然后看 Supabase 相关封装，理解“用户、会话、消息、模型列表”怎么从数据库读写。
5. 最后再看消息展示链路：`message-list.tsx -> message-bubble.tsx -> markdown-message.tsx -> code-block.tsx`，补齐细节实现方式。

## 这几个核心概念

- `Props`：组件的输入参数，类似函数参数。
- `searchParams`：当前 URL 的查询参数，页面可以据此决定提示和跳转。
- `Supabase server client`：服务端读取用户 session、访问数据库的入口。
- `proxy.ts`：负责请求级 session 刷新和 cookie 同步。
- `AuthUser`：项目内部使用的轻量用户对象，不等同于 Supabase 原生 `User`。
- `profiles`：用户展示资料扩展表，用于昵称和头像路径。
- `AIModel`：前端选择器和聊天 API 之间的统一模型描述。
- `modelId`：当前传递的是模型注册表主键，不直接等于上游模型名。
- `model_catalog`：系统内部维护的 Gemini 能力参照表，不直接作为用户模型列表展示。
- `model_fetched`：用户通过 Gemini 设置拉取并管理的私有模型列表，聊天顶部只读取其中已启用的条目。
- `Gemini Runtime Config`：本机浏览器保存的 API Key / Base URL，请求时临时传给服务端，不写入数据库。

## 主链路

当前项目最重要的链路可以概括成：

1. 页面先读登录态。
2. 登录后加载会话列表和模型列表。
3. 用户发送消息。
4. `/api/chat` 校验模型、附件、URL 与 Gemini Key。
5. 服务端调用 Gemini 并写入 user / assistant 消息。
6. 前端消费 NDJSON 流，刷新界面并继续下一轮对话。

## 认证链路

如果你在看登录相关代码，优先顺序是：

1. 首页 `page.tsx`
2. 登录面板 `auth-panel.tsx`
3. `/api/auth/password`
4. `/api/auth/magic-link`
5. `/auth/confirm`
6. `/api/profile`
7. `/api/profile/avatar`
8. `/api/profile/password`
9. `src/lib/supabase/server.ts`
10. `src/lib/supabase/proxy.ts`

如果你是在本地开发时遇到 IAB 登录问题，优先检查：

- 是否启用了 `DEV` 模式
- `.env` 是否包含 `DEV_AUTH_EMAIL`
- `SUPABASE_SECRET_KEY` 是否已配置
- Supabase Dashboard 的 `Site URL` 和 `Redirect URLs` 是否允许本地回调

## 公网部署

当前公网入口是 `https://webai.tim2354.bytecola.cn`。

部署与域名配置记录集中在 [[doc/developer/deployment|deployment]]。如果你在排查线上问题，先确认：

- Vercel production 部署是否为 Ready
- Cloudflare DNS 是否仍指向 `cname.vercel-dns.com`
- `APP_ORIGIN` 是否等于当前公网域名
- Supabase Auth 是否允许 `https://webai.tim2354.bytecola.cn/auth/confirm`
- GitHub provider 是否已在 Supabase Dashboard 启用
- `profile_avatars` bucket 与 policy 是否存在

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
