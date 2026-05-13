# Current Todo

更新时间：2026-05-14

## 项目状态

- 阶段：公网部署后的产品化回归
- 主线：WebAI 已部署到 Vercel，并通过 Cloudflare 接入公网域名。
- 公网入口：`https://webai.tim2354.bytecola.cn`
- 状态：Vercel production build 通过，Cloudflare CNAME 已指向 Vercel，公网首页可访问；邮箱密码登录、邮箱验证码登录、个人账户入口、头像上传、修改密码和会话二级菜单进入上线回归范围。
- 当前重点：登录后完整产品回归、Supabase Custom SMTP 与纯验证码邮件模板验证、邮箱验证码发送与验证链路回归、个人资料与头像 Storage 验证、取消生成可靠性验证、侧栏会话管理细节回归、GitHub provider 配置和答辩展示路径。

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
- 用户展示资料继续由 `profiles` 承接，头像对象进入私有 Storage bucket `profile_avatars`。
- 邮箱密码登录和邮箱验证码登录均由 Supabase Auth 建立 session，新用户仍可通过验证码入口进入后设置密码。

## 上线前任务

### Vercel

- 生产项目：
  - `tim2354ishere-7987s-projects/webai`
  - fallback URL: `https://webai-pearl.vercel.app`
- 已配置生产环境变量：
  - Supabase URL / publishable key
  - Gemini 相关服务端配置
  - 应用公网 origin / redirect URL
- 生产环境未配置 Supabase service role key，避免扩大线上密钥面。
- 已确认 `npm run build` 和 Vercel production build 通过。
- 当前部署通过 Vercel CLI 上传完成；Vercel 账号尚未添加 GitHub Login Connection，后续如需 push 自动部署，需要在 Vercel 账号中连接 GitHub。
- 继续检查 Next.js API route 在生产环境下的动态路由、鉴权、文件上传和头像代理读取链路。

### Cloudflare

- 公网域名 DNS 已配置：
  - `webai.tim2354.bytecola.cn CNAME cname.vercel-dns.com`
  - Cloudflare Proxy 关闭，保持 DNS only
- Vercel 项目域名 `webai.tim2354.bytecola.cn` 已 verified。
- HTTPS 首页访问已返回 `200`。
- 确认 Cloudflare 代理模式不会影响 Vercel 域名校验、OAuth 回调和 Supabase 回调。

### Supabase

- 检查生产环境允许的 Site URL 与 Redirect URLs。
- 邮箱验证码发送与校验接口使用 Supabase Auth OTP 链路，验证码位数按 6-10 位数字兼容；邮件模板应保持纯 `{{ .Token }}` 验证码内容。
- 密码登录接口通过 `/api/auth/password` 建立 Supabase session，并按邮箱和 IP 做限流。
- `profile_avatars` bucket migration 已推送到 Supabase。
- GitHub OAuth 发起路由可跳到 Supabase authorize，但 Supabase 当前未启用 GitHub provider。
- 复查 RLS 策略、Storage bucket policy 与用户目录隔离。
- 准备用于演示的种子数据或测试账号。
- 保留 migration 与表设计说明，方便课程答辩引用。

## 上线回归范围

- 登录、退出、GitHub OAuth 回调。
- 邮箱密码登录、邮箱验证码发送与验证、设置密码后退出重登。
- 个人账户修改昵称、上传头像和修改密码。
- 新建会话、恢复历史会话、重命名、收藏、归档和恢复。
- 发送普通文本消息，确认流式输出、中断生成和历史持久化。
- 中断生成后退出重登，确认 cancelled assistant 消息不会被后续流式写回覆盖。
- 模型选择、Gemini 设置、默认模型保护和模型能力识别。
- 退出重登后 Gemini Key / Base URL 仍按用户本机配置恢复，并自动尝试拉取模型列表。
- 重命名或自动命名较长会话后，侧栏宽度和会话卡片宽度保持稳定，标题只在文本区域内截断。
- 空白会话发送首条文本消息后，会话标题取首条消息前 10 个字符左右；超出部分以 `...` 表示省略。
- 删除会话采用乐观移除和失败回滚，确认后不再用弹窗等待接口完成。
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

1. 做一次公网邮箱密码登录、邮箱验证码登录、退出重登和修改密码回归。
2. 在 Supabase Dashboard 配置 Custom SMTP，并保持登录邮件模板只展示 `{{ .Token }}`。
3. 上传头像并确认生产域名下 `/api/profile/avatar` 能读取私有对象。
4. 复测中断生成、退出重登和历史恢复，确认 cancelled 消息不会被后续流覆盖。
5. 如需 GitHub 登录，在 Supabase Dashboard 启用 GitHub provider 并配置 GitHub OAuth App。
6. 收口课程答辩演示路径与部署说明。

## 一句话结论

WebAI 已经具备公网访问入口和更完整的账户入口。接下来优先完成邮箱密码、邮箱验证码、个人资料、头像 Storage、取消生成和模型配置恢复的真实线上回归。
