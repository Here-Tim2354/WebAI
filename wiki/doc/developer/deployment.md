# WebAI Deployment

本文记录公网部署入口、关键配置和上线验证口径。

## 公网入口

- Production URL: `https://webai.tim2354.bytecola.cn`
- Vercel fallback URL: `https://webai-pearl.vercel.app`
- Vercel project: `tim2354ishere-7987s-projects/webai`
- Vercel project id: `prj_Ki2ixKoRiIpcY79wq7SwyQIbaJi3`

## Vercel 配置

项目使用 Vercel CLI 创建并部署。

生产环境变量：

- `APP_ORIGIN=https://webai.tim2354.bytecola.cn`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_MODEL=gemini-3-flash-preview`
- `GEMINI_BASE_URL`

生产部署命令：

```powershell
vercel deploy --prod
```

当前 GitHub 仓库是 `Here-Tim2354/WebAI`。Vercel 账号尚未添加 GitHub Login Connection，因此当前部署走 CLI 上传；若后续希望 push 后自动触发部署，需要先在 Vercel 账号中连接 GitHub。

## Cloudflare DNS

Cloudflare zone: `bytecola.cn`

DNS 记录：

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| CNAME | `webai.tim2354.bytecola.cn` | `cname.vercel-dns.com` | DNS only |

Vercel 项目域名状态：

- `webai.tim2354.bytecola.cn`: verified
- `webai-pearl.vercel.app`: verified

## Supabase Auth

登录入口包含邮箱密码登录、邮箱验证码、邮箱链接和 GitHub OAuth。

邮箱密码登录走 `/api/auth/password`，由 Supabase Auth 建立 session。新用户可先通过 Magic Link 登录，再在个人账户中设置密码。

邮箱验证码和邮箱链接都基于 Supabase Auth 的 `signInWithOtp`。Supabase 会复用同一个 Magic Link 邮件模板，因此需要在 Dashboard 的 `Authentication -> Email Templates -> Magic Link` 中按入口区分邮件内容：

```html
{{ if eq .Data.auth_mode "email-code" }}
<h2>WebAI 邮箱验证码</h2>
<p>请输入以下验证码完成登录：</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 0.18em;">{{ .Token }}</p>
<p>验证码会在 Supabase Auth 配置的有效期后失效。</p>
{{ else }}
<h2>WebAI 邮箱链接登录</h2>
<p>点击下面的链接完成登录：</p>
<p><a href="{{ .ConfirmationURL }}">登录 WebAI</a></p>
{{ end }}
```

对应代码入口：

- `/api/auth/email-code/send` 发送 `auth_mode=email-code`，模板应展示 `{{ .Token }}`。
- `/api/auth/magic-link` 发送 `auth_mode=magic-link`，模板应展示 `{{ .ConfirmationURL }}`。

如果 Supabase 仍使用默认 Magic Link 模板，前端点击“发送验证码”也会收到链接邮件；这不是前端按钮路由错误，而是模板没有按验证码入口渲染。

Supabase Auth 建议保持以下 URL：

- Site URL: `https://webai.tim2354.bytecola.cn`
- Redirect URL: `https://webai.tim2354.bytecola.cn/auth/confirm`
- 本地开发 Redirect URL: `http://localhost:4000/auth/confirm`

GitHub OAuth 发起路由可以跳转到 Supabase authorize，但 Supabase 当前返回 `Unsupported provider: provider is not enabled`。如果需要启用 GitHub 登录，需要在 Supabase Dashboard 中启用 GitHub provider，并配置对应 GitHub OAuth App。

## Supabase Storage

当前使用两个私有 Storage bucket：

- `message_attachments`：聊天图片和文件附件
- `profile_avatars`：用户头像

头像 bucket 限制为 PNG、JPEG、WebP，最大 2 MB。对象路径以用户 ID 作为第一层目录，并通过 Storage policy 做用户隔离。

## 上线验证

已完成的最小验证：

- `npm run build` 本地通过
- Vercel production build 通过
- `https://webai.tim2354.bytecola.cn` 返回 `200`
- `/api/models` 未登录返回 `401`
- `/api/conversations` 未登录返回 `401`
- `/api/auth/magic-link` 对测试邮箱返回发送成功
- `/api/auth/email-code/send` 需要配合 Magic Link 邮件模板中的 `auth_mode=email-code` 分支验证
- `/api/auth/github` 能跳转到 Supabase authorize
- `20260511193000_phase5_profile_avatars.sql` 已推送到 Supabase
- Vercel production error logs 未发现错误

后续完整回归应继续覆盖：

- 邮箱密码登录、邮箱验证码、Magic Link 回调和退出后重新登录
- 个人账户修改昵称、上传头像和修改密码
- 登录后新建会话、发送消息、流式输出和历史持久化
- 中断生成后重新登录，确认 cancelled 消息不会被后续流式写回覆盖
- 附件上传与私有 Storage 代理读取
- 模型设置、拉取 Gemini 模型和默认模型保护
- 移动端侧栏、输入区和附件预览
