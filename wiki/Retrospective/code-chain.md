# auth chain

Auth chain 只关心一件事：

**浏览器怎么证明“我是这个用户”，服务端怎么把这个身份继续传到数据库和 Storage 边界里。**

WebAI 没有自己保存密码，也没有把 token 放进前端状态。认证主身份交给 Supabase Auth，项目代码做的是把登录入口、SSR cookie、首屏恢复、业务 API 和 `user_id` 串起来。

```txt
AuthPanel
  -> /api/auth/*
  -> Supabase Auth
  -> session cookie
  -> proxy.ts / createSupabaseServerClient()
  -> page.tsx 读取 user
  -> ChatShell(initialUser)
  -> getSupabaseAuthContext()
  -> user.id / RLS / Storage path
```

这条链里最容易忘的一点是：**前端的 `user` 只适合展示，不适合当权限依据。真正可信的是服务端通过 Supabase session 重新拿到的 `user.id`。**

## 入口

未登录页面在 `src/features/chat/components/auth-panel.tsx`。它只做输入和反馈，不保存 token。

现在有三种登录入口：

- 邮箱密码：`POST /api/auth/password`
- 邮箱验证码：`POST /api/auth/email-code/send`，再 `POST /api/auth/email-code/verify`
- GitHub OAuth：跳到 `GET /api/auth/github`

这几条路最后都会归到 Supabase session cookie。后面的工作区不需要关心用户到底是用密码、验证码还是 GitHub 进来的。

密码登录里有两个小安全点：

```txt
password-login:email:<email>  15 分钟 8 次
password-login:ip:<ip>        15 分钟 20 次
```

登录失败统一返回“邮箱或密码不正确”。这样不会顺手泄露“这个邮箱是否存在”。

邮箱验证码发送也按邮箱和 IP 限流：

```txt
email-code-send:email:<email>  15 分钟 3 次
email-code-send:ip:<ip>        15 分钟 10 次
```

前端的 60 秒冷却只是体验层保护，真正挡请求的是服务端 `src/lib/rate-limit.ts`。不过这个限流现在是进程内 `Map`，在 Vercel / 多实例环境里不算硬边界，只能算一层轻保护。

## 回跳

GitHub OAuth 和邮件链接都会回到：

```txt
src/app/auth/confirm/route.ts
```

OAuth code 走 `exchangeCodeForSession()`，邮件 token hash 走 `verifyOtp()`。成功之后回首页，让 `page.tsx` 重新从服务端恢复登录态。

这一步的好处是入口可以很多，但会话建立只留一个出口。以后查登录问题，也优先看 `/auth/confirm` 和首页恢复。

## Cookie

根目录 `proxy.ts` 只做一件事：

```ts
export async function proxy(request: NextRequest) {
  return updateSession(request);
}
```

真正的刷新逻辑在 `src/lib/supabase/proxy.ts`。

`updateSession()` 会用请求 cookie 创建 Supabase SSR client，然后调用：

```ts
await supabase.auth.getUser();
```

这里看起来没有用到返回值，实际是在触发 Supabase 检查和刷新 session。Supabase 如果写了新 cookie，代码会同时更新 request 副本和 response：

```ts
request.cookies.set(name, value);
supabaseResponse.cookies.set(name, value, options);
```

前者让同一轮请求后面的 Server Component 能读到新 session，后者让浏览器保存新 session。少掉任何一边，都会出现“服务端和浏览器有一边还是旧登录态”的怪问题。

`src/lib/supabase/server.ts` 则负责给 Server Component 和 Route Handler 创建同一套 Supabase SSR client。它也有 cookie 写入逻辑，但 Server Component 里不一定能稳定写响应，所以真正稳定的刷新还是放在 proxy 层。

## 首屏

首页在 `src/app/page.tsx`，是 Server Component。

它先读：

```ts
const {
  data: { user },
} = await supabase.auth.getUser();
```

有用户时，再按 `user.id` 取会话、模型和资料：

```ts
listConversations(supabase, user.id)
listEnabledModels(supabase, user.id)
getUserProfile(supabase, user.id)
```

最后传给 `ChatShell`：

```tsx
<ChatShell initialUser={user ? mapAuthUser(user, profile) : null} />
```

所以刷新页面时，浏览器不是先看到一个空工作区，再等 `useEffect` 判断登录态。服务端已经把用户和首屏数据准备好了。

`mapAuthUser()` 也做了一次收口，只把前端需要的字段交出去：

```ts
{
  id,
  email,
  displayName,
  avatarUrl,
}
```

Supabase 原始 `User` 不直接塞进前端组件。

## 业务 API

需要登录的业务 route 基本都从这里开始：

```ts
const { supabase, user } = await getSupabaseAuthContext();
```

没有 `user` 就返回 401。典型位置包括：

- `src/app/api/chat/route.ts`
- `src/app/api/conversations/route.ts`
- `src/app/api/messages/[messageId]/route.ts`
- `src/app/api/models/route.ts`
- `src/app/api/profile/route.ts`
- `src/app/api/attachments/upload/route.ts`

但恢复身份只回答“你是谁”。资源能不能动，还要继续看 `user.id` 和资源归属。

例如发送消息时，`/api/chat` 会先查会话归属：

```ts
getConversationById(supabase, user.id, conversationId)
```

模型也按当前用户启用的模型查：

```ts
getEnabledModelById(supabase, user.id, effectiveModelId)
```

附件进入模型之前，还要确认 Storage 路径属于当前用户：

```ts
assertAttachmentInputAllowed({ userId: user.id, attachments, model })
```

这里不能只相信前端传回来的 `conversationId`、`modelId` 和 `storagePath`。它们都来自浏览器，只能当请求参数，不能当权限证明。

## 用户资料

`auth.users` 是 Supabase 管的认证身份。项目自己的展示资料放在 `profiles`。

```sql
profiles.user_id -> auth.users.id on delete cascade
```

这个分层很舒服：

- 登录、密码、OAuth identity、session 归 Supabase Auth。
- 昵称和头像路径归 `profiles`。
- 会话、消息、收藏、私有模型继续围绕 `user_id` 做归属。

头像对象不直接公开。`profiles.avatar_url` 保存的是 Storage path：

```txt
<user_id>/avatar-<timestamp>.<ext>
```

浏览器读头像走代理：

```txt
GET /api/profile/avatar?path=...
```

路由先检查 `storagePath.startsWith(`${user.id}/`)`，再去私有 bucket 下载。这样 `<img>` 可以正常显示，Storage bucket 仍然不用公开。

## 注销账户

注销账户在：

```txt
src/app/api/profile/account/route.ts
```

流程是：

```txt
getSupabaseAuthContext()
  -> createSupabaseAdminClient()
  -> 删除 profile_avatars/<user.id>/*
  -> 删除 message_attachments/<user.id>/*
  -> admin.auth.admin.deleteUser(user.id)
  -> supabase.auth.signOut()
```

这条链比退出登录危险得多。退出只是清 session，注销会删除 Auth 用户，并通过外键级联带走 `profiles`、`conversations`、`messages`、`favorites` 等业务数据。

先删 Storage 是为了避免 Auth 用户删除时被用户名下对象卡住。数据库记录靠外键级联，Storage 对象要主动清。

## 记忆点

看 auth 代码时，先抓这几个点就够了：

1. `AuthPanel` 不保存 token。
2. `/api/auth/*` 只负责让 Supabase Auth 建 session。
3. `proxy.ts` 负责 session 刷新和 cookie 写回。
4. `page.tsx` 负责服务端首屏恢复。
5. `getSupabaseAuthContext()` 是业务 API 的身份入口。
6. 授权继续靠 `user.id`、RLS、Storage 路径和服务端查询条件。
7. `profiles` 是展示资料，不是认证主表。
8. 注销账户要同时处理 Auth、业务表和 Storage。

# security chain

Security chain 不是一条单独的功能链，它更像散在系统里的几道闸。

WebAI 当前做得比较清楚的地方是：**不把浏览器传来的东西直接当真。** 身份、会话归属、模型能力、附件路径、Storage 对象和数据库修改，都尽量在服务端或数据库再确认一次。

## 身份边界

第一层还是 Supabase Auth。

前端没有保存访问 token，也没有自己构造用户身份。每个需要登录的 API 都从 `getSupabaseAuthContext()` 拿服务端用户；拿不到就返回 401。

这层挡的是匿名访问和伪造前端状态。用户可以改浏览器里的 React state 或请求体，但服务端还是只认 cookie 里的 Supabase session。

## 数据边界

数据库里最重要的安全线是 RLS。

核心表在 migration 里启用了 row level security：

```txt
profiles
conversations
messages
favorites
search_records
model_fetched
```

策略基本围绕同一个判断展开：

```sql
auth.uid() = user_id
```

`messages` 稍微绕一点，因为消息自己没有直接挂 `user_id`，它要通过 `conversation_id` 找到所属会话，再确认：

```sql
conversations.user_id = auth.uid()
```

这层很关键。应用代码里当然也会写 `.eq("user_id", user.id)`，但 RLS 是数据库最后一道闸。哪怕某个 route 少写了一层条件，也不应该轻易读到别人的行。

## API 授权

业务 API 不只检查“有没有登录”，还会检查“这个资源是不是你的”。

几个比较典型的地方：

- `/api/chat` 发送消息前先 `getConversationById(supabase, user.id, conversationId)`。
- `/api/conversations/[conversationId]` 这类会话操作都带当前 `user.id`。
- `/api/messages/[messageId]` 编辑和重新生成时，会同时校验会话、消息和当前用户。
- `/api/models` 只读写当前用户启用的 `model_fetched`。
- `/api/attachments/object` 下载前检查 `storagePath` 是否落在当前用户目录。

这里的安全思路很朴素：浏览器可以提交一个别人的 UUID，但服务端必须把这个 UUID 放回当前用户边界里查一遍。

## 请求校验

跨端请求基本都先进 Zod schema。

认证相关在 `src/lib/schemas/auth.ts`：

- 邮箱必须是合法邮箱。
- 邮箱验证码只能是 6-10 位数字。
- 前端用户对象只暴露 `id / email / displayName / avatarUrl`。

聊天相关在 `src/lib/schemas/chat.ts`：

- `conversationId` 必须是 UUID。
- URL Context 最多 4 个 URL。
- 附件 metadata 最多 5 个。
- 消息正文、URL、附件至少要有一个。
- `geminiRuntimeConfig.baseUrl` 必须是合法 URL。

这层不是为了“防黑客”这么夸张，更多是防止坏数据一路流进数据库、模型调用和 UI 渲染。请求边界越早收紧，后面代码越少被奇怪输入拖着跑。

## 限流

`src/lib/rate-limit.ts` 是轻量限流。

现在用在登录和邮箱验证码入口：

```txt
password-login:email:<email>
password-login:ip:<ip>
email-code-send:email:<email>
email-code-send:ip:<ip>
```

按邮箱和 IP 两层做，比只按一个维度好一点。只按 IP 会误伤同网段，只按邮箱又挡不住批量扫。

但它仍然只是进程内 `Map`。本地开发和单实例够用，公网长期运行应该再接 Cloudflare / Supabase Auth / Redis 或 Vercel KV 这种跨实例限流。

## 上传边界

头像和消息附件是两条不同的上传链。

头像在 `src/app/api/profile/avatar/route.ts`：

- 只允许 PNG / JPG / WebP。
- 最大 2 MB。
- Storage path 固定为 `<user.id>/avatar-<timestamp>.<ext>`。
- 读取时走 `/api/profile/avatar` 代理，不公开 bucket。

消息附件在 `src/app/api/attachments/upload/route.ts` 和 `src/lib/attachments.ts`：

- 单条消息最多 5 个附件。
- 图片和文件有各自大小限制。
- 只接收项目允许的 MIME type。
- Excel 会先转成 CSV，再交给模型。
- Storage key 不使用原始文件名，而是生成：

```txt
<user_id>/drafts/<attachment_uuid>/attachment.<ext>
```

原始文件名只留在 metadata 里展示。这个细节挺重要，中文、空格、特殊符号都不应该直接进入 Storage key。

读取附件也不直接公开 Storage URL，而是走：

```txt
GET /api/attachments/object?path=...
```

路由会检查：

```ts
storagePath.startsWith(`${userId}/drafts/`)
!storagePath.split("/").includes("..")
```

所以用户不能拿一个别人的 path 让代理下载。

## 模型和外部请求

Gemini API Key 没放进公开环境变量。发送消息时，`/api/chat` 要求请求里带 `geminiRuntimeConfig.apiKey`，真正调用模型发生在服务端。

模型能力也不只靠前端禁用按钮。附件进入模型前会跑：

```ts
assertAttachmentInputAllowed()
```

它会同时看两件事：

1. 附件路径是不是当前用户的。
2. 当前模型是否支持 image / files。

所以即使前端 UI 漏了一个禁用态，服务端也会挡住“不支持文件的模型却被塞了文件”这种请求。

`APP_ORIGIN` 也有单独处理。生产环境下，登录回跳地址优先来自显式配置，不信任请求头里的 Host。这个点主要是为了避免 OAuth / 邮件回跳被代理头污染。

## RPC 和数据库函数

消息编辑有数据库 RPC，因为它要做“修改当前 user 消息，并删除后续消息”这个原子操作。

这类函数是 `security definer`，所以更要小心。后面的 hardening migration 把它改成：

```sql
set search_path = ''
```

函数内部也会检查：

```sql
auth.uid() is not null
conversation.user_id = auth.uid()
```

这解决的是两件事：

- 防止 RPC 在更高权限下被拿去改别人的消息。
- 防止 `search_path` 被劫持后解析到不该用的对象。

`20260506103000_phase4_prelaunch_security_hardening.sql` 还顺手撤掉了旧编辑函数权限，删除了已经不用的旧函数，并移除了过时的匿名 SVG 写入 policy。这个迁移更像上线前把旧门关上。

## 响应头

`src/lib/supabase/proxy.ts` 给普通请求补了几条基础安全头：

```txt
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

它们不解决业务授权问题，但能减少一些浏览器层面的默认暴露面：不要 MIME sniff，不允许被 iframe 套住，少带 referrer，禁掉当前产品不用的敏感能力。

## 还不够硬的地方

这些地方没有到“已经坏了”的程度，但公网产品继续打磨时要记住。

1. 进程内限流不适合长期当生产边界。

   `Map` 在 serverless / 多实例里不能共享，冷启动也会丢。登录和发验证码最好再接一层真正的边缘或共享存储限流。

2. 邮箱验证码发送入口可以加 Turnstile。

   发邮件能力一旦公网暴露，很容易被当成资源消耗入口。现在有邮箱 + IP 限流，但还不是完整防滥用方案。

3. 修改密码只要求已登录。

   `src/app/api/profile/password/route.ts` 现在没有要求当前密码或近期重新认证。个人电脑场景问题不大，真实产品里偏弱。

4. 敏感 mutation 还可以补 Origin / CSRF 检查。

   Cookie 认证下，像退出登录、改密码、注销账户、头像上传这类接口，都值得检查 `Origin` 是否等于 `APP_ORIGIN`，或者补 CSRF token。

5. 头像路径校验还可以更严格。

   头像读取现在只做 `<user.id>/` 前缀检查。消息附件已经额外禁止 `..`，头像也可以对齐成固定形态校验。

6. 安全审计还比较轻。

   登录失败、限流、改密、注销这类事件现在没有单独审计表。后续如果要产品化，可以记录必要事件，但不要记录密码、验证码、token 或完整 API Key。

# model schema chain

待补。

# stream chain

待补。

# Optimistic update

待补。
