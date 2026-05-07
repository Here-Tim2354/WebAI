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

- 邮箱输入
- 提交中状态
- 页面反馈文案
- 回跳错误码

同时它还在首次挂载时处理：

- 本地邮箱恢复
- URL / hash 中的认证回调结果

---

## 2. 本组件维护的状态

### `email`

作用：
- 保存当前邮箱输入框内容

### `isSubmitting`

作用：
- 当前是否正在发送魔法链接请求

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

## 4. 表单提交流程

链路：

1. 用户提交表单
2. `handleSubmit` 阻止默认提交
3. 如果邮箱为空或正在提交，则直接返回
4. 设置：
   - `isSubmitting = true`
   - 清空旧 `feedback`
   - 清空旧 `feedbackCode`
5. 把邮箱写进 `localStorage`
6. `POST /api/auth/magic-link`
7. 成功后：
   - 写入成功提示
   - `feedbackType = "info"`
8. 失败后：
   - 写入错误提示
   - `feedbackType = "error"`
9. 最终把 `isSubmitting` 还原为 `false`

---

## 5. 为什么要读 URL 和 hash

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

## 6. 一句话总结

`AuthPanel` 的状态流本质上是在管理一条登录漏斗：输入邮箱、发送链接、消费回跳结果，再把用户引导回工作区。
