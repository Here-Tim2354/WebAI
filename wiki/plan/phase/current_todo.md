# Current Todo

更新时间：2026-05-07 22:46:43

## 项目状态

- 阶段：公网部署准备
- 主线：将 WebAI 部署到 Vercel，并通过 Cloudflare 接入公网域名。
- 状态：核心产品流程、数据库主线、聊天生成、会话管理、附件输入、模型注册表和前端结构整理已经基本完成。
- 当前重点：部署配置、环境变量、域名解析、线上回归与答辩展示路径。

## 当前架构边界

- 前端采用 Next.js App Router。
- 聊天能力按 feature-first 组织在 `src/features/chat`：
  - `components/`：聊天可见组件
  - `hooks/`：聊天状态与业务流程
  - `lib/`：聊天局部工具、流消费、附件客户端与 URL 上下文
- `src/components` 保留通用 UI primitive。
- `src/lib` 保留跨功能共享的 schema、Supabase、AI、附件规则、环境与安全边界工具。
- Supabase 继续作为核心数据库与私有 Storage。
- Gemini Key / Base URL 仍由服务端接口和浏览器运行时配置共同约束，不进入数据库。

## 上线前任务

### Vercel

- 检查生产环境变量是否齐全：
  - Supabase URL / anon key / service role key
  - Gemini 相关服务端配置
  - GitHub OAuth / Magic Link 所需配置
  - 应用公网 origin / redirect URL
- 确认 `npm run build` 在部署环境通过。
- 检查 Next.js API route 在生产环境下的动态路由、鉴权和文件上传链路。
- 确认私有 Storage 文件读取接口在生产域名下可正常返回。

### Cloudflare

- 配置公网域名 DNS。
- 将域名指向 Vercel 项目。
- 检查 SSL / HTTPS 状态。
- 确认 Cloudflare 代理模式不会影响 Vercel 域名校验、OAuth 回调和 Supabase 回调。

### Supabase

- 检查生产环境允许的 Site URL 与 Redirect URLs。
- 复查 RLS 策略、Storage bucket policy 与用户目录隔离。
- 准备用于演示的种子数据或测试账号。
- 保留 migration 与表设计说明，方便课程答辩引用。

## 上线回归范围

- 登录、退出、Magic Link / GitHub OAuth 回调。
- 新建会话、恢复历史会话、重命名、收藏、归档和恢复。
- 发送普通文本消息，确认流式输出、中断生成和历史持久化。
- 模型选择、Gemini 设置、默认模型保护和模型能力识别。
- 图片、PDF、文本文件、Excel 上传与发送。
- Word / PPT 选择时给出支持范围提示。
- 编辑带附件 user 消息，确认后续消息截断和重新生成语义。
- assistant 重新生成与分支会话。
- LaTeX / 化学式混排与长回复滚动体验。
- 移动端侧栏、输入区、附件预览和会话菜单。

## 文档与答辩材料

- 保持 `wiki/doc/frontend/GUIDE.md` 与 feature-first 结构一致。
- 整理部署说明：Vercel、Cloudflare、Supabase 回调 URL、环境变量。
- 整理数据库说明：核心表、关系、RLS、Storage policy、migration 对应关系。
- 整理演示路径：登录、发起对话、附件输入、会话管理、模型选择、历史恢复。

## 下一步

1. 准备 Vercel 生产环境变量。
2. 部署 Vercel 预览环境并完成线上 smoke test。
3. 接入 Cloudflare 域名并确认 HTTPS / 回调链路。
4. 做一轮完整线上回归。
5. 收口部署文档与课程答辩材料。

## 一句话结论

WebAI 已经从功能扩展段进入公网部署准备段。接下来优先保证 Vercel + Cloudflare 上线链路稳定，再围绕线上环境完成最后一轮产品回归和课程答辩材料整理。
