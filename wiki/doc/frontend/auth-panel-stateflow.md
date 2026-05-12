---
aliases:
  - AuthPanel 状态流
---

# AuthPanel 前端状态流说明

这篇笔记帮助我们理解 `AuthPanel` 的前端运行机制，而不是页面展示结构。

代码入口：
- `src/features/chat/components/auth-panel.tsx`

关联笔记：
- [[auth-panel]]
- [[chatshell-stateflow]]

## 1. 组件定位

`AuthPanel` 是未登录态页面的状态中枢。

它自己管理：

- 当前登录方式
- 邮箱输入
- 密码输入
- 邮箱验证码输入
- 提交中状态
- 页面反馈文案
- 回跳错误码

同时它还在首次挂载时处理：

- 本地邮箱恢复
- URL / hash 中的认证回调结果

---

## 2. 本组件维护的状态

### `authMode`

作用：
- 保存当前选中的主登录方式
- 可选值为 `password` 和 `email-code`
- 决定页面展示密码表单还是邮箱验证码表单

### `email`

作用：
- 保存当前邮箱输入框内容

### `password`

作用：
- 保存当前密码输入框内容

### `emailCode`

作用：
- 保存当前邮箱验证码输入框内容
- 输入时只保留数字，并限制最多 10 位

### `isPasswordSubmitting`

作用：
- 当前是否正在进行邮箱密码登录

### `isEmailCodeSending`

作用：
- 当前是否正在发送邮箱验证码

### `isEmailCodeVerifying`

作用：
- 当前是否正在校验邮箱验证码并登录

### `isMagicLinkSubmitting`

作用：
- 当前是否正在发送邮箱链接

### `isGithubSubmitting`

作用：
- 当前是否正在跳转 GitHub OAuth

### `isAuthSubmitting`

作用：
- 合并密码、邮箱验证码、邮箱链接和 GitHub 登录状态，避免重复提交

### `feedback`

作用：
- 当前页面要展示的反馈文案

### `feedbackType`

作用：
- 当前反馈是 `info` 还是 `error`

### `feedbackCode`

作用：
- 保存额外的错误码，比如 `otp_expired`

---

## 3. useEffect 在管理什么

`AuthPanel` 有一个 `useEffect`，只在首次挂载时执行一次。

它管理的内容：

- 登录页初始化恢复

运行方式：

1. 从 `localStorage` 读取上次输入过的邮箱
2. 调用 `parseAuthFeedbackFromLocation()`
3. 如果 URL 或 hash 中存在回跳结果：
   - 设置 `feedback`
   - 设置 `feedbackType`
   - 设置 `feedbackCode`
4. 如果错误码是 `otp_expired`
   - 自动聚焦输入框
   - 自动选中邮箱内容

这个 effect 的目标是：

- 让登录页具备“回到页面后仍保留上下文”的体验

---

## 4. 密码登录流程

链路：

1. 用户提交表单
2. `handleSubmit` 阻止默认提交
3. 如果邮箱、密码为空或正在提交，则直接返回
4. 设置：
   - `isPasswordSubmitting = true`
   - 清空旧 `feedback`
   - 清空旧 `feedbackCode`
5. 把邮箱写进 `localStorage`
6. `POST /api/auth/password`
7. 成功后：
   - 写入成功提示
   - `feedbackType = "info"`
   - 跳转回 `/`
8. 失败后：
   - 写入错误提示
   - `feedbackType = "error"`
9. 最终把 `isPasswordSubmitting` 还原为 `false`

---

## 5. 邮箱链接备用流程

链路：

1. 用户点击使用邮箱链接登录
2. `handleSendMagicLinkClick()`
3. 如果邮箱为空或正在提交，则直接返回
4. 设置：
   - `isMagicLinkSubmitting = true`
   - 清空旧反馈
5. `POST /api/auth/magic-link`
6. 成功后提示用户查看邮箱
7. 失败后展示错误提示
8. 最终把 `isMagicLinkSubmitting` 还原为 `false`

---

## 6. 邮箱验证码流程

发送验证码链路：

1. 用户切换到 `邮箱验证码` 选项卡
2. 输入邮箱
3. 点击发送验证码
4. `handleSendEmailCodeClick()` 检查邮箱和提交状态
5. 设置：
   - `isEmailCodeSending = true`
   - 清空旧反馈
6. `POST /api/auth/email-code/send`
7. 成功后提示用户查看邮箱
8. 失败后展示错误提示
9. 最终把 `isEmailCodeSending` 还原为 `false`

验证码登录链路：

1. 用户输入邮箱验证码
2. 提交验证码表单
3. `handleVerifyEmailCodeClick()` 检查邮箱、验证码和提交状态
4. 设置：
   - `isEmailCodeVerifying = true`
   - 清空旧反馈
5. `POST /api/auth/email-code/verify`
6. 成功后：
   - 写入成功提示
   - `feedbackType = "info"`
   - 跳转回 `/`
7. 失败后：
   - 写入错误提示
   - `feedbackType = "error"`
8. 最终把 `isEmailCodeVerifying` 还原为 `false`

---

## 7. 为什么要读 URL 和 hash

因为 Supabase 的登录回跳结果不一定只放在 query string。

可能出现在：

- `window.location.search`
- `window.location.hash`

所以 `AuthPanel` 在首次挂载时会统一解析两边。

这样才能覆盖：

- 成功登录回跳
- 普通错误回跳
- `otp_expired` 这种过期场景

---

## 8. 一句话总结

`AuthPanel` 的状态流本质上是在管理未登录态入口：密码和邮箱验证码作为主登录方式互斥切换，邮箱链接与 GitHub OAuth 作为备用入口，把用户引导回工作区。
