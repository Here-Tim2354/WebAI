# `src/features/chat/components/auth-panel.tsx`

## 文件定位

`AuthPanel` 是未登录用户看到的整屏入口。`ChatShell` 在 `user === null` 时直接返回它。

## 核心职责

它负责三种登录入口：

- 邮箱密码登录：`POST /api/auth/password`。
- 邮箱验证码：`POST /api/auth/email-code/send` 和 `POST /api/auth/email-code/verify`。
- GitHub 登录：跳转到 `/api/auth/github`。

## 状态与函数

主要 `useState`：

- `authMode`：`password` 或 `email-code`。
- `email`、`password`、`emailCode`：表单输入。
- `isPasswordSubmitting`、`isEmailCodeSending`、`isEmailCodeVerifying`、`isGithubSubmitting`：分别锁住不同登录动作。
- `emailCodeCooldown`：验证码 60 秒冷却。
- `feedback` / `feedbackType`：统一提示区。

关键函数：

- `parseAuthFeedbackFromLocation()`：兼容 query string 和 hash 中的 Supabase 回调结果。
- `rememberLoginSuccessNotice()`：把登录成功提示放到 `sessionStorage`，进入工作区后由 `ChatShell` 展示。
- `handleSubmit()`：密码登录。
- `handleSendEmailCodeClick()`：发送邮箱验证码。
- `handleVerifyEmailCodeClick()`：验证邮箱验证码。

## `useEffect` 解析

首次挂载时读取 `localStorage` 里的上次邮箱，并解析 URL / hash 登录反馈。验证码冷却另有一个倒计时 effect，每秒递减一次。

## 设计缘由

登录页把多种认证方式收在一个面板中，但没有把 session 管理放在客户端。真正建立 session 的动作仍交给 API route 和 Supabase。

## 返回组件规模

这是一个居中的登录卡片，宽度约 `31rem`。卡片里有品牌标识、登录方式切换、邮箱输入、密码/验证码输入、GitHub 按钮和反馈提示。

## 代码展开

### 回跳解析

`parseAuthFeedbackFromLocation` 同时读 `window.location.search` 和 `window.location.hash`。Supabase 有些错误会放在 hash，比如 `error_code=otp_expired`。如果只读 query，用户点过期邮件链接时就看不到明确提示。

开发环境下会 `console.log("auth callback", ...)`，方便排查真实回跳 URL。生产环境不会输出。

### 邮箱记忆

首次挂载时读取 `webai:last-auth-email`，成功发送验证码或提交密码登录时都会写入这个 key。它不等于登录态，只是减少用户重复输入邮箱。

### 密码登录

`handleSubmit` 只在邮箱和密码都有值、且当前没有任何认证提交时运行。成功后：

1. 展示“登录成功”。
2. 写入 sessionStorage notice。
3. `window.location.assign("/")` 回首页。

这里不用 router，是因为登录后需要让浏览器重新请求首页，服务端组件才能拿到新的 Supabase session。

### 验证码登录

发送验证码会启动 60 秒冷却。即使发送失败，也会设置冷却，这样能减少用户连续点击撞到 Supabase 限流。

验证码输入会执行：

```ts
replace(/\D/g, "").slice(0, 10)
```

所以只能输入数字，最长 10 位。后端 schema 也会校验 6-10 位数字。

### UI 规模

登录页是全屏居中卡片，宽度约 `31rem`。它是未登录时唯一主界面，所以视觉上比普通弹窗更像入口页，但仍然保持浅色克制。
