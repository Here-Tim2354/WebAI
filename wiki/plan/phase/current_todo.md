# Current Todo

更新时间：2026-05-19

## 项目状态

- 阶段：公网部署后的产品持续优化
- 主线：WebAI 已部署到 Vercel，并通过 Cloudflare 接入公网域名。
- 公网入口：`https://webai.tim2354.bytecola.cn`
- 状态：Vercel production build 通过，Cloudflare CNAME 已指向 Vercel，公网首页可访问；邮箱密码登录、邮箱验证码登录、个人账户入口、头像上传、修改密码、注销账户、更新日志和会话二级菜单进入上线回归范围。
- 当前重点：登录后完整产品回归、Supabase Custom SMTP 与纯验证码邮件模板验证、邮箱验证码发送与验证链路回归、个人资料与头像 Storage 验证、账户注销链路验证、更新日志弹窗验证、取消生成可靠性验证、侧栏会话管理细节回归、GitHub provider 配置和答辩展示路径。

## 项目架构

```
WebAI/
|-- src/
|   |-- app/
|   |   |-- page.tsx
|   |   |-- layout.tsx
|   |   |-- auth/
|   |   |-- api/
|   |       |-- auth/
|   |       |-- chat/
|   |       |-- conversations/
|   |       |-- messages/
|   |       |-- models/
|   |       |-- profile/
|   |       |-- attachments/
|   |
|   |-- features/
|   |   |-- chat/
|   |       |-- components/
|   |       |-- hooks/
|   |       |-- lib/
|   |
|   |-- components/
|   |   |-- ui/
|   |
|   |-- lib/
|       |-- ai/
|       |-- env/
|       |-- schemas/
|       |-- supabase/
|       |-- attachments.ts
|       |-- rate-limit.ts
|
|-- supabase/
|   |-- migrations/
|
|-- public/
|
|-- asset/
|
|-- scripts/
|
|-- wiki/
|   |-- plan/
|   |-- doc/
|   |   |-- database/
|   |   |-- frontend/
|   |   |-- developer/
|   |   |-- library/
|
|-- output/
|   |-- doc/
|
|-- package.json
|-- next.config.ts
|-- tsconfig.json
|-- README.md
|-- AGENTS.md
```

## 上线前任务

### Vercel

- 生产项目：
  - `tim2354ishere-7987s-projects/webai`
  - fallback URL: `https://webai-pearl.vercel.app`
- 已配置生产环境变量：
  - Supabase URL / publishable key
  - Gemini 相关服务端配置
  - 应用公网 origin / redirect URL
- 如果生产环境开放注销账户功能，需要配置 Supabase service role key；该密钥只允许服务端读取，不能进入浏览器环境。
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
- 账户注销需要验证 `profiles`、`conversations`、`messages`、`favorites` 等用户数据随 Auth 用户删除级联清理，并验证 `profile_avatars` / `message_attachments` 用户目录对象清理。
- GitHub OAuth 发起路由可跳到 Supabase authorize，但 Supabase 当前未启用 GitHub provider。
- 复查 RLS 策略、Storage bucket policy 与用户目录隔离。
- 准备用于演示的种子数据或测试账号。
- 保留 migration 与表设计说明，方便课程答辩引用。
- 已于 `2026-05-20` 通过 Supabase CLI 核对云端 `public` / `storage` schema：确认 `profiles`、`conversations`、`messages`、`favorites`、`model_catalog`、`model_fetched`、`message_attachments`、`profile_avatars` 与 RLS / Storage policy 现状，并同步 `wiki/doc/database`。

## 上线回归范围

- 登录、退出、GitHub OAuth 回调。
- 邮箱密码登录、邮箱验证码发送与验证、设置密码后退出重登。
- 个人账户修改昵称、上传头像、修改密码和注销账户。
- 新建会话乐观更新、恢复历史会话、重命名、收藏、归档和恢复。
- 发送普通文本消息，确认流式输出、中断生成和历史持久化。
- 中断生成后退出重登，确认 cancelled assistant 消息不会被后续流式写回覆盖。
- 模型选择、Gemini 设置、默认模型保护和模型能力识别。
- 退出重登后 Gemini Key / Base URL 仍按用户本机配置恢复，并自动尝试拉取模型列表。
- 重命名或自动命名较长会话后，侧栏宽度和会话卡片宽度保持稳定，标题只在文本区域内截断。
- 空白会话发送首条文本消息后，会话标题取首条消息前 10 个字符左右；超出部分以 `...` 表示省略。
- 删除会话采用乐观移除和失败回滚，确认后不再用弹窗等待接口完成。
- 更新日志入口与登录后更新提示；确认“不再弹出本次更新内容”和每天最多自动提示一次。
- 图片、PDF、文本文件、Excel 上传与发送。
- Word / PPT 选择时给出支持范围提示。
- 编辑带附件 user 消息，确认后续消息截断和重新生成语义。
- assistant 重新生成与分支会话。
- LaTeX / 化学式混排与长回复滚动体验。
- 移动端侧栏、输入区、附件预览和会话菜单。

## 文档与答辩材料

- 保持 `wiki/doc/frontend/GUIDE.md` 与 feature-first 结构一致。
- 整理部署说明：Vercel、Cloudflare、Supabase 回调 URL、环境变量。
- 整理数据库说明：核心表、关系、RLS、Storage policy、migration 对应关系。`wiki/doc/database` 已完成一轮云端 schema 核对同步，后续重点转为 advisor 遗留项与答辩叙事整理。
- 整理演示路径：登录、发起对话、附件输入、会话管理、模型选择、历史恢复。

## 下一步

1. 做一次公网邮箱密码登录、邮箱验证码登录、退出重登、修改密码和注销账户回归。
2. 在 Supabase Dashboard 配置 Custom SMTP，并保持登录邮件模板只展示 `{{ .Token }}`。
3. 上传头像并确认生产域名下 `/api/profile/avatar` 能读取私有对象；注销账户时确认头像和消息附件对象被清理。
4. 复测中断生成、退出重登和历史恢复，确认 cancelled 消息不会被后续流覆盖。
5. 如需 GitHub 登录，在 Supabase Dashboard 启用 GitHub provider 并配置 GitHub OAuth App。
6. 回归更新日志入口、登录后更新提示和“不再弹出本次更新内容”本地记忆。
7. 收口课程答辩演示路径与部署说明。

## 一句话结论

WebAI 已经具备公网访问入口和更完整的账户入口。接下来优先完成邮箱密码、邮箱验证码、个人资料、头像 Storage、账户注销、更新日志提示、取消生成和模型配置恢复的真实线上回归。
