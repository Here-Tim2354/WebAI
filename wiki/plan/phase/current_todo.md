# Current Todo

更新时间：2026-04-27 21:50:54

## 当前阶段

- 当前主线：`Phase 4.3` 会话管理增强与组织能力扩展
- 已完成阶段：
  - `Phase 1`、`Phase 2`
  - `Phase 3.1` 至 `Phase 3.5`
  - `Phase 4.1` 生成体验与会话控制基础升级
  - `Phase 4.2` 消息侧增强与会话分支能力
- 并行补做：`Phase 3.6` 课程材料、RLS 与数据库说明验收

## 当前完成状态

- 数据库主线已稳定：
  - `profiles`
  - `conversations`
  - `messages`
  - `ai_models`
  - `gemini_models`
  - `openai_compatible_models`
- 聊天主链路已完成：
  - 流式输出
  - 中断生成
  - 消息状态细分
  - 消息持久化与历史恢复
  - 会话级模型、提示词、联网开关
  - Gemini URL Context 请求级输入与消息级 metadata 保存
- 消息侧能力已完成：
  - 复制
  - user 消息编辑并重新生成
  - assistant 最新消息重新生成
  - assistant 消息分支到新会话
  - 分支继承模型、提示词、联网开关与消息 metadata
- 会话管理增强已完成第一轮：
  - 收藏 / 取消收藏
  - 头像菜单中的收藏区
  - 收藏会话点击跳转
  - 归档 / 恢复
  - 头像菜单中的归档区
  - 会话列表二级菜单归档入口
  - 头像菜单承接收藏、归档区与退出登录
- 搜索功能已撤回：
  - 顶部搜索入口已移除
  - `/api/conversations/search` 已删除
  - `search_records` 与 `search_user_conversations` 已从远端 Supabase 清理

## 数据库与迁移

- 已推送远端 Supabase：
  - `20260427083000_phase4_conversation_organization.sql`
  - `20260427091000_remove_conversation_search.sql`
- 当前确认：
  - `favorites` 已落到远端
  - `conversations.archived_at` 已落到远端
  - `search_records` 不存在
  - `search_user_conversations(text, uuid, conversation_status)` 不存在
- 当前查询与 API：
  - `/api/conversations?status=active`
  - `/api/conversations?status=archived`
  - `/api/conversations?favorite=true`
  - `/api/conversations/[conversationId]/favorite`
  - `PATCH /api/conversations/[conversationId]` 支持 `status`

## 验证结果

- `npm run typecheck` 通过
- `npm run lint` 通过
  - 仅剩既有 `src/components/chat/model-icon.tsx` 的 `<img>` warning
- `npm run build` 通过
  - 沙箱内可能触发已知 `spawn EPERM`
  - 越权运行可通过
- browser-use 已验收：
  - 顶部搜索入口已消失
  - 收藏与提示词 tooltip 文案已更新
  - 提示词弹窗说明已改为更小字号与两行排版
  - 输入区联网 / URL 按钮 tooltip 已改为 `联网` / `添加URL`
  - 头像菜单含收藏、归档区、退出登录
  - 收藏区可打开并显示空态
  - 浏览器控制台无 error/warning

## 当前待办

- `Phase 4.3` 收尾：
  - 继续用真实页面观察收藏、归档、恢复在多会话数据下的交互稳定性
  - 检查移动端 Sheet 下收藏区、归档区和会话菜单弹层表现
  - 观察 CSS-only Tooltip 是否仍会在特殊容器里被裁切
- `Phase 4.4` 预备：
  - 图片输入首轮接入
  - 为文件、视频输入预留结构
  - 重新评估搜索是否真的需要回到产品主链路
- `Phase 3.6` 补做：
  - RLS 验证
  - 数据库说明补全
  - migration 与表设计说明整理
  - 页面功能与数据库操作映射关系整理
  - 答辩支撑材料整理

## 接手点

- 默认先读：
  - `wiki/plan/phase/phase_4.md`
  - `wiki/plan/phase/current_todo.md`
  - `src/components/chat/chat-shell.tsx`
  - `src/components/chat/conversation-sidebar.tsx`
  - `src/components/chat/use-chat-workspace.ts`
  - `src/lib/supabase/conversations.ts`
- 当前不要再恢复搜索入口，除非重新做产品判断。
- `.playwright-mcp/` 是浏览器验证工具生成的未跟踪目录，不属于功能代码。
- 空目录 `src/app/api/conversations/search` 若仍存在，可由用户手动删除；当前已无 `route.ts`，不会形成 Next API 路由。

## 一句话结论

`Phase 4.3` 第一轮实现已经完成并通过本地检查、远端迁移核对与浏览器验收；下一步主要是移动端与多数据场景观察，同时准备进入 `Phase 4.4` 的多模态输入方向。
