# `src/app/page.tsx`

## 文件定位

`page.tsx` 是首页的 Server Component。它不直接处理浏览器交互，而是在服务端恢复用户、会话、模型和 profile，再把首屏数据交给 [[components/chat-shell|ChatShell]]。

调用关系很短：

- 读取 `createSupabaseServerClient()`。
- 通过 `supabase.auth.getUser()` 判断是否已登录。
- 已登录时读取 `listConversations`、`listEnabledModels`、`getUserProfile`。
- 最后渲染 `<ChatShell />`。

## 核心逻辑

`HomePage({ searchParams })` 是唯一导出。它先等待 `searchParams`，再创建 Supabase server client。这里选择 Server Component 是合理的，因为登录态和初始列表都应该在首屏前确定，避免客户端先闪一个空页面再补数据。

DEV 模式下有一段开发登录捷径：

```ts
if (!user && isDevLoginModeEnabled && resolvedSearchParams.auth !== "error") {
  redirect("/api/auth/dev-login");
}
```

它只在本地 DEV 模式启用，目的是让刷新页面时快速进入工作区。生产环境不会走这条分支。

## 数据输出

传给 `ChatShell` 的 props 是前端工作区的起点：

- `initialUser`：经过 `mapAuthUser(user, profile)` 的用户信息。
- `initialConversations`：侧栏会话列表。
- `initialModels`：顶部模型选择使用的已启用模型。
- `initialAuthMessage`：邮箱确认回跳后的提示。
- `initialAuthMessageType`：提示类型。

## 设计缘由

认证、会话列表和模型列表都和数据库有关，放在服务端更直接。客户端拿到的是已经校验过的初始状态，不需要自己猜测“当前用户是谁”。

## UI 规模

这个文件本身没有 UI 布局。它只决定渲染登录页还是工作区，实际屏幕结构在 `ChatShell` 里。

## 代码展开

### searchParams 为什么是 Promise

这个文件的 props 写成：

```ts
searchParams: Promise<{ auth?: string }>
```

所以函数开头先 `await searchParams`。后面的 `auth=success/error` 只用于邮箱确认回跳后的提示，不参与真正鉴权。真正判断用户是谁，仍然来自 Supabase 的 `auth.getUser()`。

### DEV 登录捷径的边界

`isDevLoginModeEnabled` 同时检查：

- `process.env.NODE_ENV === "development"`
- `process.env.MODE === "DEV"` 或 `process.env.npm_config_mode === "DEV"`

这意味着必须用项目约定的 DEV 模式启动，才会自动跳 `/api/auth/dev-login`。并且如果 URL 已经带了 `auth=error` 或 `auth=success`，不会再跳，避免刚从登录确认回来又被开发登录逻辑打断。

### 首屏数据读取顺序

用户不存在时，`conversations`、`models`、`profile` 都不会读取。用户存在时分别读取：

```ts
listConversations(supabase, user.id)
listEnabledModels(supabase, user.id)
getUserProfile(supabase, user.id)
```

这三类数据都服务于首屏：侧栏列表、顶部模型选择、头像/昵称。

### auth message

`initialAuthMessage` 是一次性的 UI 提示。比如 `auth=success` 时是“登录成功，正在进入你的会话工作区。”。这个提示被传给 `ChatShell`，如果用户其实已经登录，会进入工作区；如果未登录，则 `ChatShell` 会渲染 `AuthPanel` 并把提示展示出来。
