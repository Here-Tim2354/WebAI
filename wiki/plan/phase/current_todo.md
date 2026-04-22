# Current Todo

更新时间：2026-04-22 16:35:00

## 当前阶段

- 当前项目已正式进入 `Phase 4`
- `Phase 1`、`Phase 2` 已完成
- `Phase 3.1`、`Phase 3.2`、`Phase 3.3`、`Phase 3.4`、`Phase 3.5` 已完成
- 当前判断：
  - `Phase 3` 的数据库驱动聊天主链路已经稳定，可作为后续迭代基线
  - `Phase 3.6` 仍需继续完成验收与材料整理，但当前不再作为阶段主线
  - `Phase 4` 已成为当前阶段主线，并已按 `4.1` 至 `4.5+` 形成阶段拆分
  - 当前默认从 `Phase 4.1` 正式开工，优先推进“生成体验与会话控制基础升级”

## 已完成的关键节点

- 数据库主线已闭环：
  - `profiles`
  - `conversations`
  - `messages`
- 已完成真实用户下的会话 CRUD：
  - 新建
  - 查询列表
  - 打开历史会话
  - 重命名
  - 删除
- 已完成消息持久化主链路：
  - 首次发送自动创建会话
  - 用户消息入库
  - assistant 消息入库
  - 历史消息恢复
- 已完成前端迁移与视觉收口：
  - `Tailwind CSS v4`
  - `shadcn/ui`
  - `Lucide React`
  - `Motion`
  - `Geist Sans / Geist Mono`
  - 移动端侧栏改为 `Sheet`
  - 删除确认改为正式 `Dialog`
  - 侧栏、空状态、输入区、消息区已统一到当前浅色工作台视觉
- 已完成 `system_prompt` 的主链路贯通：
  - 会话 schema 已支持 `systemPrompt`
  - 会话 API 已支持读写 `systemPrompt`
  - AI 调用层已能接收会话级提示词
- 已完成模型注册表首轮落地：
  - `ai_models`
  - `openai_compatible_models`
  - `gemini_models`
  - Supabase migration 已落地
  - 模型能力字段已能服务前端展示
- 已完成模型注册表远端重建：
  - 远端 Supabase 已执行父表 + provider 子表最终态迁移
  - `ai_models` 已成为统一模型入口
  - `openai_compatible_models` / `gemini_models` 已改为 provider 专属子表
  - 首个 `Gemini 3 Flash Preview` seed 已落库
- 已完成 AI 层首轮拆分：
  - 统一 AI 入口已建立
  - `Gemini` 专属调用层已抽离
  - `OpenAI compatible` 调用层已抽离
  - 聊天接口已支持可选 `modelId`
- 已完成模型列表接口与前端初步接入：
  - `/api/models` 已可用
  - 空会话首页头部已接入模型选择条
  - 当前发送消息时已可带上所选模型
  - 当前 `modelId` 已切换为注册表主键语义
- 已完成 `Phase 4` 规划收口：
  - `phase_overview.md` 已改为 `Phase 4` 总述 + 子阶段路线
  - `phase_4.md` 已新增
  - 当前已明确 `4.1`、`4.2`、`4.3`、`4.4` 与 `4.5+` 的边界
  - 当前已明确会话级提示词、会话级模型选择、会话级联网开关、消息编辑、消息分支、多模态输入的产品语义
- 已完成 `Phase 4.1.1` 第一轮主链路收口：
  - 聊天接口已切换为纯流式返回
  - assistant 回复已支持增量渲染
  - 已支持显式中断生成
  - 消息状态已细化为 `pending / streaming / complete / cancelled / error`
  - 会话级 `system_prompt` 已形成正式编辑入口
  - 当前会话模型选择已支持持久化记忆
  - 会话头部控制区已形成第一轮统一入口
  - 联网入口已保留统一位置，并按当前能力置灰
- 已完成工作区编排层第一轮抽离：
  - `ChatShell` 已收口为页面壳组件
  - 会话列表、模型列表、草稿控制项与会话同步逻辑已抽到 `useChatWorkspace`
  - 当前聊天工作区的页面层 / 工作区编排层 / 消息交互层边界已更清楚
- 已完成 Markdown / 代码块体验细修：
  - Markdown 已恢复浅色主题并重新对齐当前浅色工作台视觉
  - 代码块复制按钮已改为图标按钮
  - 复制逻辑已补 `Clipboard API + execCommand` 双通道兜底
  - user 消息已增加 `markdown--compact` 紧凑文本约束，用于和 assistant 长文排版分离
- 已完成 `Phase 4.1.1` 数据层配套：
  - `conversations.model_id` 已落库
  - `messages.status` 已落库
  - 流式链路相关 migration 已应用到远端 Supabase
  - assistant 中断后的数据库状态已验收到 `cancelled`
- 已完成联网搜索与 `URL Context` 的后端第一轮接入：
  - `conversations.web_search_enabled` 已落库，默认值为 `true`
  - 远端 Supabase 已执行 `20260421120000_phase4_web_search_and_url_context.sql`
  - `/api/conversations` 与 `/api/conversations/[conversationId]` 已支持读写 `webSearchEnabled`
  - `/api/chat` 已支持可选 `urls`
  - `Gemini` 调用层已能按条件注入 `googleSearch` 与 `urlContext`
  - `OpenAI compatible` 当前未接入 `URL Context` 相关逻辑
- 已完成 `Phase 4.1.2` 第一轮前端接线与控制区细修：
  - 会话级联网搜索已接到前端真实开关，并支持草稿态默认值沿用到首条消息建会话
  - `Gemini URL Context` 已形成前端常驻输入入口，支持输入、确认、删除、发送时传参
  - URL 输入区已支持发送后自动清空并收起
  - URL 上限反馈已改为输入区内联警示，而不再依赖浏览器原生弹窗
  - 输入区、弹层、消息气泡、侧栏与认证面板已进一步统一到较小圆角约束
- 已完成本地与远端 migration 历史修复：
  - 旧 migration 文件已统一重命名为完整时间戳格式
  - 已补 `20260325144640_phase3_history_placeholder.sql` 用于对齐远端已存在的历史版本

## 当前代码状态

- 工作区已经形成统一的浅色 AI 工作台方向
- 左侧栏、主聊天区、输入区、弹层已基本统一到同一套视觉语言
- 数据库主线、会话管理和消息持久化已经进入稳定态
- AI 能力层不再直接硬绑定 Gemini，后续接模型选择和多模型扩展的摩擦已经明显降低
- 模型选择的后端接口与前端入口都已具备，但仍处于第一版可用状态
- 当前远端模型注册表已经切到父子表最终态
- 当前前端头部已经存在模型选择入口与提示词图标入口，但仍属于第一版控制区
- 当前聊天接口已完成流式化，生成链路已进入 `Phase 4.1` 的第一轮稳定态
- 当前会话级控制语义已经落成第一版：
  - 当前会话模型选择记忆已完成
  - 会话级 `system_prompt` 的正式编辑交互已完成
  - 会话级联网搜索已完成前后端贯通，并具备真实交互入口
- 当前子表能力字段已进入前端模型对象，并已用于模型能力标签展示与控制区置灰，但尚未全面驱动更深的交互差异
- 当前 `Gemini URL Context` 已完成前后端第一轮贯通：
  - 当前 `sendMessage` 请求已具备 `urls` 参数契约
  - 当前前端已提供 URL 输入、删除、上限提示与发送后重置交互
  - 当前 UI 仍在持续细修排版、提示文案与桌面端/移动端的一致性
- 当前本地 migration 历史已与远端 Supabase 对齐，可继续沿用 `supabase db push`
- 当前流式展示链路已可用，但仍存在后续可继续优化的体验项：
  - reveal 节奏与过渡动画仍可继续细修
  - 提示词弹窗尺寸与通用弹层约束曾发生冲突，当前已在调用点覆盖
  - `reduced motion` 分支的流式显示问题已修复，但仍建议后续补最小回归验证
- 当前 `ChatShell` 的页面装配职责已经收窄：
  - 工作区编排逻辑已不再全部堆在 `chat-shell.tsx`
  - `useChatWorkspace` 已成为后续承接会话级控制项的第一落点
- 当前 Markdown / 代码块链路已完成一轮可用性修正：
  - 浅色主题已恢复
  - 代码复制按钮在当前浏览器环境已具备真实复制能力
  - 图标按钮已替代原文字按钮

## 当前待办

- 当前进入 `Phase 4.1.1` 收尾阶段：
  - 同步阶段文档与真实代码状态
  - 视需要补最小回归验证
  - 收口当前控制区与提示词弹窗的残余视觉细节
- `Phase 4.1.2` 第一顺位任务：
  - 继续优化流式展示体验与状态反馈文案
  - 为当前流式链路补更稳定的验收用例
  - 继续收口桌面端与移动端一致性
  - 继续验证 user bubble 紧凑排版是否达到预期，而不是把 assistant 长文排版一起压坏
- `Phase 4.1.2` 第二顺位任务：
  - 继续细修联网搜索开关与 `Gemini URL Context` 的前端排版、反馈与动效
  - 继续让模型能力字段驱动更明确的 UI 差异
  - 视需要继续拆分控制区与代码块相关展示组件，避免体验细修再次回流到 `ChatShell`
- `Phase 4.2` 预备项：
  - 消息复制
  - 消息编辑
  - 从消息发起分支到新会话
  - 分支后沿用原会话的模型、提示词与相关会话级设置
- `Phase 4.3` 预备项：
  - 会话归档
  - 归档恢复
  - 收藏
  - 会话搜索
  - 扩展对象逐步落库
- `Phase 4.4` 预备项：
  - 会话级联网开关
  - 显式搜索能力接入
  - 图片输入首轮接入
  - 为文件、视频输入预留结构
- 补做 `Phase 3.6` 需要的验收内容：
  - `RLS` 验证
  - 数据库说明补全
  - migration 与表设计说明整理
  - 页面功能与数据库操作映射关系整理
  - 答辩支撑材料整理

## 切换会话前建议保留的接手点

- 下个会话默认直接从 `Phase 4.1.2` 开始，不再重复讨论 `4.1.1` 是否具备开工条件
- 第一站建议优先阅读：
  - `wiki/plan/phase/phase_4.md`
  - `wiki/plan/phase/current_todo.md`
  - `src/components/chat/chat-shell.tsx`
  - `src/components/chat/use-chat-workspace.ts`
  - `src/components/chat/use-chat-session.ts`
  - `src/app/api/chat/route.ts`
  - `src/lib/ai/gemini.ts`
  - `src/lib/supabase/conversations.ts`
- 下个会话默认先做“流式体验细修 + 联网开关前端接线 + URL 输入入口”，再决定是否切入 `4.2`
- 当前不把“补 seed”当作阶段主线，它只作为后续配套工作存在

## 当前提醒

- 当前数据库主线稳定，但 `favorites` 与 `search_records` 仍只保留在整体设计中
- `profiles` 相关用户侧增强暂未作为当前主线推进
- 模型注册表最终态已在远端 Supabase 落库，但当前 provider 覆盖和 seed 规模都还不是主线优先级
- 前端模型选择仍处于第一版，尚未完成会话级记忆策略
- 深色模式还未正式进入实现
- `npm run build` 在当前环境里仍可能遇到 `spawn EPERM`，暂不作为仓库缺陷判断依据
- 当前邮箱登录链路是否完整跑通，仍依赖 Supabase 控制台配置
- 当前 `Phase 4.1.1` 的主链路已经成立，但阶段文档仍需要继续保持与实现同步
- 当前 `Phase 4.1.2` 的真正重点不再是“有没有流式能力”，而是“如何把流式体验、控制区语义和会话级能力开关继续收口”
- 当前联网搜索已经不是“后端已通、前端待接”的状态，而是“前后端已通、前端仍需继续细修”
- 当前 `URL Context` 已完成 Gemini 专属前后端第一轮接入，当前重点已转为排版、反馈和一致性收口
- 当前 Markdown / 代码块视觉与复制体验已经过一轮细修，但 user 气泡的最终纵向节奏仍应继续用真实页面观察，而不是只看代码猜测

## 一句话结论

- 当前项目已经完成 `Phase 4.1.1` 主链路，并在 `Phase 4.1.2` 补上了联网搜索前端真实开关、`Gemini URL Context` 前端入口与控制区一轮细修；下个会话应继续从 `Phase 4.1.2` 推进，优先收口真实页面排版与交互一致性，并继续把 `Phase 3.6` 验收整理作为并行补做项。
