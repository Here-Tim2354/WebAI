# 项目介绍

这是一个WebAI的用户-AI聊天对话系统。对话支持基本的多模态，附件上传，调整思考强度，Gemini独有的谷歌联网和URL上下文，聊天气泡支持Markdown渲染，Latex渲染，可展开思考过程，流式输出，一键滚动到底栏等视觉功能。而对话拥有修改对话，重新生成，复制，分支，收藏会话，调整会话级提示词，重命名会话，归档会话等功能。

由Supabase提供的用户登陆，根据账号识别对应数据，邮箱发送验证邮件等功能均有支持。也制作了比如浏览收藏区，归档区，用户个人资料，修改密码的基本用户体验功能。


本文件为粗略地过一遍具体代码。

# src

src存放源代码，其他的则是各种配置文件。只需要知道这是最外层的就行。

# app

存放了绝大多数功能的路由API，基于Supabase提供的auth路由，以及用于定义全局CSS的`global.css`，用于定义全局共享的HTML外壳层`layout.tsx`，以及真正的项目入口`page.tsx`。

绝大部分的请求和返回都有`zod`校验数据格式的流程。

### api

api下包含非常多router，负责根据前端发送请求，后端接受请求来执行对应的功能。

而且所有的router的文件开头都有SupabaseAuthContext的鉴权功能，对应功能为必须要求用户是登陆的。

这一文件夹的定位基本上是从前端获取Request，鉴权与校验后根据实际功能需要调用`lib`库的函数，然后返回对应的Response。并且有一套视具体错误返回不同错误码的机制。

#### attachments

包含object和upload文件，用来分别处理读取私有文件和上传附件的请求。这些请求都会涉及到Supabase的Storage。这是该它提供的一个简单存储对象，用于存档用户的图片，文件等信息。

首先是`object/route.ts`，鉴权后，读取请求。示例：
```http
GET /api/attachments/object?path=user-id%2Fdrafts%2Fattachment-id%2Fattachment.png
```
获取请求的URL，URL中的`path`部分，以及Auth信息。然后同时判断：
1. 存储路径是否有效
2. 存储的路径是否属于用户
若均不是，才能通过`supabase.storage.from(...BUCKET).download(storagePath)`来获取内容。然后通过`Response`返回HTTP请求。一个图片返回的示例：
```http
HTTP/1.1 200 OK
Content-Type: image/png
Cache-Control: private, max-age=60

<图片二进制内容>
```
他会根据文件类型来匹配。


然后是`upload/route.ts`，上传附件。鉴权后，读取请求：
```ts
const formData = new FormData();
formData.append("files", imageFile);
formData.append("files", pdfFile);

await fetch("/api/attachments/upload", {
  method: "POST",
  body: formData,
});
```
读取请求的`formData`之后，获取所有的文件，简单过滤，校验数量与大小后。上传到Supabase的Storage中并获取当前附件：
```ts
const attachments: MessageAttachment[] = [];

try {
  for (const file of files) {
    attachments.push(await uploadMessageAttachment(supabase, user.id, file));
  }...
```
并且也有对应的`uploadError`上传错误后的删除机制：
```ts
catch (uploadError) {
      const uploadedPaths = attachments.map((attachment) => attachment.storagePath);

      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from(MESSAGE_ATTACHMENTS_BUCKET)
          .remove(uploadedPaths);
      }
      throw uploadError;
    }
```
之后就把`attachments`作为`Response`返回。若上传文件本身发生错误，也有对应的处理机制。

### auth

包含了一系列的登陆鉴权的router。

#### dev-login
`dev-login/route.ts`。这是一个专门用于开发者环境的登陆路由。
在简单的鉴权后，会尝试直接读取Supabase的Secret和RoleKey，以及开发者环境下的Email。之后调用`lib/env/app-origin.ts`文件中的`createUrl`来组建回跳URL和`tokenHash,verification_type`:
```ts
const confirmUrl = createAppUrl("/auth/confirm", request.url);
confirmUrl.searchParams.set("token_hash", tokenHash);
confirmUrl.searchParams.set("type", verificationType);
```
然后URL会类似：
```http
http://localhost:4000/auth/confirm?token_hash=xxx&type=magiclink
```
并重定向回去：
```ts
return NextResponse.redirect(confirmUrl);
```

即本地开发者模式访问的时候，访问：
```http
GET http://localhost:4000/api/auth/dev-login
```
成功时重定向至：
```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:4000/auth/confirm?token_hash=...&type=magiclink
```
这个router的上层router会进一步处理。比如更上一层的router`/auth/confirm`会继续重定向到`/?auth=success`。

这一系列设计是为了便于开发环境调试。我就不必每次都登陆验证。而且也没有绕开Supabase Auth，也没有伪造cookie，只是在中间层直接获得了邮箱获得的MagicLink。

#### email-code

Supabase支持的邮箱验证码router。

`send/route.ts`中则是接受前端的请求，鉴权和校验后，先获取请求的IP地址，断言速率限制之后，使用`signInWithOtp`来发送邮件。邮件包含验证码。返回提示邮件已发送的Response。

`verify/route.ts`中则是在用户输入完验证码后，处理点击确认所发送的请求。继续断言速率限制后，将请求的token和邮箱放进`supabase.auth.verifyOtp`中。返回成功Response。


#### github

这是一个支持Github登陆请求的router。获取请求url之后传输到`signInWithOAuth`的Github选项来获得重定向链接。指向Github登陆的页面。

#### password

目前的项目实现并没有支持注册功能，用户是通过邮箱验证码或者Github登陆后自动注册的。该router负责在用户已经修改密码后登陆

鉴于修改密码是比较敏感的操作，项目有一定的安全措施：
1. 基本的鉴权和校验请求
2. 获取请求的IP
3. 断言邮箱和ip的限制

然后根据邮箱和密码登陆。

#### sign-out

处理登出请求。简单的`supabase.auth.signOut`即可。

### chat

一个是该文件夹的直接子router，用于负责处理发送消息并流式生成assistant回复。

定义了针对不同错误类型返回不同错误码的`handleChatError`之后，定义GET，简单鉴权和校验json后，获取：
```ts
const {
  conversationId,
  content,
  modelId,
  thinkingLevel,
  urls,
  attachments,
  geminiRuntimeConfig,
} = parsedRequest.data;
```
这一系列前端发送的数据。并进一步校验`geminiRuntimeConfig`中是否填写了apiKey。

接下来是一系列获取信息的操作：
1. `getConversationById`获取Supabase的表的对应行信息，即实际上网页选中那个会话
2. 获取请求中包含的模型的名称，如果没有就获取会话默认的模型。同理获取思考档位信息。如果前端请求的这两个信息与数据库的不一致，则更新数据库的。（说明用户修改了）

然后通过`asserAttachmentInputAllowed`断言输入附件是否被允许上传，若允许，则调用`createConversationMessage`来创建一条新消息，并调用`touchConversation`来更新云端数据库，最后创建流式输出返回内容。

#### cancel

这个下面的router处理前端发送取消生成的请求。

简单鉴权和校验后，获取当前会话的id，分别调用：
1. `cancelAssistantMessage`
2. `cancelConversationStream`
来处理中断和流式输出。

### conversations

该文件夹下有一个直接的router。用于处理一系列会话请求。

简单鉴权后。提供GET和POST两个方法。

其中GET就是获取用户的会话列表，调用：
1. `listFavoriteConversations`
2. `listConversations`
两个方法来分别获取添加了收藏的会话列表，和一般的会话列表。


POST方法则是允许用户创建一个对话，获取前端的信息后打包为请求返回。
```ts
const conversation = await createConversation(
  supabase,
  user.id,
  parsed.data.title,
  parsed.data.systemPrompt,
  parsed.data.modelId,
  parsed.data.webSearchEnabled,
  parsed.data.thinkingLevel,
);
```

#### \[conversationId\]

这个子文件夹下面也有一个子router，专门负责打开某一个会话（用conversationId表示）。

对于GET：
鉴权，并获取对应会话的id之后，router就会调用`getConversationById`来获得指定的会话，并且再通过`listConversationMessages`来获得会话消息。并最后返回包括对话和对话消息在内的对象。

对于PATCH：
承担的任务是对话的标题重命名，会话级别systemprompt更新和各种会话级控制项更新。
```ts
const conversation = await updateConversation(
  supabase,
  user.id,
  conversationId,
  {
    title: parsed.data.title,
    systemPrompt: parsed.data.systemPrompt,
    modelId: parsed.data.modelId,
    webSearchEnabled: parsed.data.webSearchEnabled,
    thinkingLevel: parsed.data.thinkingLevel,
    status: parsed.data.status,
  },
);
```
`updataConversation`会根据实际有的值来更新，忽略`undefined`。

对于DELETE：
顾名思义，删除指定的对话


这下面还两个服务于会话的功能router，分别是`branch/`分支和`favorite/`收藏会话。

`branch/route.ts`分支是用于保存之前的上下文，并继承到一个全新的会话中，用于用户中途想将对话引导至两个方向，便于管理。

简单鉴权和校验后，通过前端获取当前的`messageId`，再通过`listConversationMessageThrough`获取上文。并且要求这个消息是处于完毕`complete`的状态，而不是`pending/streaming`。之后创建会话。

特别的，对于`metadata`，采用的是引用，这些Storage对象仍然在原用户的目录下。而且方法`clonoeConversationMessages`在创建新的消息数组的时候，会显式写入递增`created_at`这个字段，这样确保新会话的消息与上一个会话一致。

而`favorite/route.ts`则简单许多，只需要`favoriteConversation`和`unfavoriteConversation`这两个方法和对应`Schema`来做功能即可。

### message\\\[messageId\]

处理消息相关。最复杂的一个。先讲直接的router：

鉴权与校验后，对于PATCH：
1. 编辑user消息
2. 移除后文
3. 创建新的assistant流式回复。

并从前端请求获取如下信息：
```ts
const {
  conversationId,
  content,
  modelId,
  thinkingLevel,
  urls,
  attachments,
  geminiRuntimeConfig,
} =
  parsed.data;
```

之后获取：
1. 指定的会话`conversationId`
2. 指定会话的全部消息`listConversationMessage()`
3. 目标消息`getConversationMessage()`，和对应的Id
然后处理：
4. 本次请求修改的metadata（如果有）
5. modelId（如果前端修改了）并一同`updateConversation`
6. 断言模型是否允许上传附件消息
7. 截断指定消息之后的消息

接着尝试`editUserMessageAndDeleteFollowing()`，这是数据库RPC，确保原子化操作。如果失败才尝试分别`updateConversationMessage`和`deleteConversationMessageById`。

接着获取目标消息及其之后的所有附件，清除那些没有被引用的附件，清楚云端Storage。
```ts
void cleanupUnreferencedAttachments(...).catch(() => null);
```
这种写法是已知`Promise`，但故意不`await`，也不关心它的返回值，即清理失败也不要影响当前编辑消息主流程。

然后就是已经打包已经删除了指定消息下文的上下文，返回要给流式输出`createAssistantStreamResponse`

#### regenerate

然后是子文件夹`regenerate/route.ts`，即负责重新生成。类似的逻辑，获取原消息的内容后，根据前端发送的实际配置，打包发送给`createAssistantStreamResponse()`。有多种错误处理。

值得注意的是，重新生成的时候，如果实际上修改了附件和URL，那么除了重新生成Assistant的消息，也得修改User的消息。并且也得清除旧引用。

### models

有关获取模型的router。直接子路由为获取当前可用模型。

#### fetched

直接子路由为列出Fetched之后的模型，即调用`listFetchedModels`

另外也有一个`modelId/route.ts`。这个是管理某个用户私有模型列表的单个模型记录。支持

PATCH：更新模型的启用状态/默认状态
DELETE：删除某个已拉取模型

并返回更新过的FetchedModels列表。


#### gemini\fetch

这个是获取Gemini官方模型的router：

定义了一个通过正则表达式获取GeminiFetchError的函数用于返回不同的报错文本。

然后传入base_url和apiKey，通过GenAI的`client.model.list()`拉取模型列表，接着调用`replaceFetchedGeminiModels`去做去重，计数，最后返回一个模型列表和fetch总结。如果发生了错误，通过函数来返回错误的信息。

### profile

主要是个人信息相关的router。

对于直接子router：
PATCH：修改个人账户的显示名称
GET：获取个人账户的信息，具体为：
```ts
export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});
```

#### avatar

顾名思义，修改头像的
POST：上传头像到Supabase云端并更新引用。
GET：获取头像，返回一个带有图片的Response。

#### password

顾名思义，修改密码的
PATCH：修改密码，并通过`supabase.auth.updateUser()`来修改


## auth\confirm

这个文件也是一个router，但比较特殊。这不是给前端调用的API，而是处理 Supabase 登录确认回调，并把用户重定向回首页。

获取URL，以及可能的两种参数：
1. `/auth/confirm?code=xxx`
2. `/auth/confirm?token_hash=xxx&type=magiclink`
并通过`createAppUrl`准备登陆完成后的调回地址，即`https://webai.tim2354.bytecola.cn/?auth=success`。同时在`page.tsx`中配合校验Supabse用户来避免伪造登录态。


## globals.css

定义了一些全局css。以及全局依赖：
```css
@import "tailwindcss";
@import "overlayscrollbars/overlayscrollbars.css";
@import "highlight.js/styles/github.css";
@import "katex/dist/katex.min.css";
@import "tw-animate-css";
```

定义了许多variant，主体token，亮色/暗色主题决定了：
- 页面背景
- 主色
- 文本色
- 边框色
- destructive 红色
- sidebar 色
- 圆角半径
- 滚动条颜色
- 阴影

还有全局Reset和基础样式：
```css
* {
  box-sizing: border-box;
  scrollbar-width: thin;
}
html {
  font-size: 16px;
  height: 100%;
}
body {
  height: 100%;
  min-height: 100vh;
  margin: 0;
  overflow: hidden;
  background: ...;
  font-family: var(--font-sans);
}
```

以及针对滚动条写的主题，Markdown/代码块/数学公式样式。
还有无障碍设置：
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
用户系统设置了“减少动态效果”，项目会尽量关闭动画和过渡。

还有Tailwind base layer，Tailwind的基础层：
```css
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

## layout.tsx

这是Next.js的文件约定，即app目录下必须有一个`root layout`，负责约定最顶层layout，html和body，并包住所有页面。

作用为：
1. 引入全局CSS
2. 定义`Metadata`，这是Next的Metadata API写法，用于影响网页的内容。
3. 定义HTML壳层，比如`<html>`和`<body>`，还有主要语言
4. 包住所有页面，也就是`<children>`
以及挂在Geist字体。

## page.tsx

在Next框架中，`src/app/page.tsx`是项目的首页路由文件，对应的URL为`/`，即`https://webai.tim2354.bytecola.cn/`。

定义了一个`async Server Component`，表明这是服务端执行的函数，浏览器无权执行。

函数首先会：
1. searchParams，URL参数，是`/?auth=success`或`/?auth=error`
2. 获取supabase客户端
3. 获取客户端的User，因为浏览器在请求首页的时候会自动把当前域名下的Supabase登陆cookie一起带到服务端。所以Supabase知道身份（若此前登陆）

如果是开发者模式下（通过命令行参数`--mode=DEV`），那么会重定向至`/api/auth/dev-login`，将环境变量中的邮箱地址和Supabase Role Key打包进Supabase客户端，从而免登录页面直接进入指定账号。

然后获取User的对话，列出可用模型，获取用户个人信息。并且初始化登陆状态信息。最后通过`ChatShell`拼接上述各种信息。

# components\\ui

本项目的同样UI积木层。是业务中会反复使用的到的组件，采用Shadcn/ui的方式组织。配置：
- 风格：`base-nova`
- 框架：`Next.js App Router`，`rsc: true`
- UI 路径：`@/components/ui`
- 工具函数路径：`@/lib/utils`
- 图标库：`lucide`
- 全局主题 CSS：`src/app/globals.css`
- 底层 primitive：大量使用 `@base-ui/react`


项目大量使用了样式生成器的写法：
```ts
const alertVariants = cva("基础 class", { variants: ... })
```
可以根据不同的`variant`参数返回不同的`class`。

还有`cn(...)`这个`className`合并的工具，便于页面补充布局类。

## alert

定义了一系列用于醒目的消息弹出框的UI Primitives
```tsx
function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}
```
`React.ComponentProps<"div">` 表示它接受普通 `<div>` 能接受的所有属性，比如 `id`、`onClick`、`children`。

并且有以下具体UI：
1. AlertTitle
2. AlertDescription
3. AlertAction

## badge.tsx

负责小标签/状态标记的组件，用于展示状态，分类，数量，提示性短文本。比如：
- 消息旁边的小状态标识
- 会话侧栏里的数量或状态提示
- 模型、能力、附件这类短标签
- “已归档”“已收藏”“错误”等状态展示

`badgeVariants`也是样式生成器，定义了比如
1. default
2. secondary
3. destructive
4. outline
5. ghost
6. link

并且使用了Base UI的useRender写法，默认渲染为`<span>`，但如果外部传入了`<render>`，可以换成别的元素。


## button.tsx

文件开头声明了`use client`，表明这是在浏览器渲染的。

通过样式生成器，把按钮样式分为了两组
1. variant
2. size

`ButtonPrimitive.Props & VariantProps<typeof buttonVariants>`表明它接受Base UI Button支持的所有属性。还额外接受`variant`和`size`。
即Base UI帮我处理了Button的交互和逻辑行为，我只需要包装。
```tsx
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

## dialog.tsx

也利用了Base UI的Dialog Primitive
```tsx
return <DialogPrimitive.Root data-slot="dialog" {...props} />
```

主要服务于需要用户临时停下来处理的一类“弹窗任务”，主要是：
- 修改当前会话的系统提示词
- 管理消息附件
- 打开收藏会话列表
- 打开归档会话列表
- 打开个人账户设置
- 打开 Gemini 设置
- 展示需要用户集中处理的配置表单

实例组件：
1. `DialogTrigger`，打开弹窗的触发器
2. `DialogPortal`，意思是弹窗不会渲染在当前DOM层级中，而是挂到更外层，避免被父元素影响
3. `DialogClose`，关闭
4. `DialogOverlay`，背景遮罩层
5. `DialogContent`，弹窗主体。渲染上述的Portal和Overlay，居中的Popup。
   关闭按钮写法`<DialogPrimitive.Close render={<Button ... />}>`也采用了render的组合方式。实际为：关闭逻辑采用`DialogPrimitive.Close`，外观使用自己写的`Button`
6. `DialogHeader`，存放弹窗标题和描述的容器
7. `DialogFooter`，弹窗底部的按钮
8. `DialogTitle`，视觉的标题
9. `DialogDescription`，弹窗描述文本

## DropdownMenu.tsx

一些点击后展开的菜单，在项目中主要是：
- 顶部模型选择
- 输入区 thinking 档位选择
- 会话卡片的更多操作
- 用户头像菜单
- 收藏、归档、Gemini 设置、退出登录入口

通过`const dropdownContentClassName/dropdownSubContentClassName`定义样式。使用了Base UI的`MenuPrimitive`来定义根组件。

实例组件：
1. `DropdownMenuPortal`，渲染到外层
2. `DropdownMenuTrigger`，菜单触发器。同样触发逻辑采用了Base UI，外观使用自己的Button。
3. `DropdownMenuContent`，菜单浮层内容。并且内部使用了`MenuPrimitive.Positioner`，负责定位到按钮旁边。
4. `DropdownMenuGroup`，菜单分组。用于把一系列的菜单组合到一起。
5. `DropdownMenuLabel`，分组标题。表示说明
6. `DropdownMenuItem`，普通的菜单项。适合一次性的，比如重命名，收藏，归档等。
7. `DropdownMenuCheckboxItem`，复选菜单项，负责一些“开关”的菜单。可多选
8. `DropdownMenuRadioGroup`，单选菜单组
9. `DropdownMenuRadioItem`，单选项。放在单选菜单组里。
10. `DropdownMenuSeparator`，分隔线
11. `DropdownMenuSub`，子菜单。允许菜单之后可能会有子菜单。
12. `DropdownMenuSubTrigger`，子菜单的那个箭头
13. `DropdownMenuSubContent`，子菜单展开后的内容
14. `DropdownMenuShortcut`，一些快捷提示，比如复制的`Ctrl+C`。

## input.tsx

负责输入框。当然也使用了BaseUI的`InputPrimitive`。其中`React.ComponentProps<"input">`表示这个组件接受所有原生`<input>`能接受的属性。`React.forwardRed<>`表示外部可以拿到真实的`input DOM`，用于聚焦。

## scroll-area.tsx

此处引入了外部库[[overlayscrollbars-footprint]]，统一项目的滚动区域。比如：
1. 消息列表
2. 侧边栏
3. 菜单滚动区

```tsx
<OverlayScrollbarsComponent
  ref={scrollRef}
  element="div"
  options={scrollAreaOptionsByAxis[axis]}
  events={events}
  defer
  className={cn("min-h-0", className)}
  {...props}
>
  {children}
</OverlayScrollbarsComponent>
```
这将滚动行为交给`OverlayScrollbarsComponent`管理。

文件中的函数大部分都在处理外部ref的绑定关系。

其中有一层转发，即外部的ref，最终会指向OverlayScrollbars的viewport。
```tsx
assignForwardedRef(forwardedRef, element ?? resolveScrollElement());
```


## scroll-options.ts

关于滚动的配置中心。共享配置为：
```ts
const sharedScrollOptions = {
  scrollbars: {
    theme: "os-theme-webai",
    autoHide: "move",
    autoHideDelay: 480,
    clickScroll: true,
  },
  update: {
    debounce: {
      mutation: 40,
      resize: 40,
      event: 80,
      env: 120,
    },
  },
} satisfies PartialOptions;

```
1. `theme: "os-theme-webai"` 使用项目自己的滚动条主题。
2. `autoHide: "move"` 鼠标移动时显示，平时隐藏。
3. `clickScroll: true` 允许点击滚动条轨道滚动。
4. `debounce` 是性能控制

## sheet.tsx

从屏幕边缘滑出来的面板。比如项目的侧边栏。使用了BaseUI的`dialog`作为交互底层。

导出的子组件包括：
1. `Sheet`，根组件，对应`SheetPrimitive.Root`，即`Base UI Dialog`的根节点
2. `SheetTrigger`，触发器，搭配按钮
3. `SheetClose`，触发器，关闭
4. `SheetContent`，具体的内容
5. `SheetHeader`，面板顶部区域
6. `SheetFooter`，面板底部区域
7. `SheetTitle`，面板标题
8. `SheetDescription`，描述

一个该组件的示例：
```tsx
<Sheet>
  <SheetTrigger>打开面板</SheetTrigger>

  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>标题</SheetTitle>
      <SheetDescription>说明文字</SheetDescription>
    </SheetHeader>

    <div>主体内容</div>

    <SheetFooter>
      <button>保存</button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

## textarea.tsx

```tsx
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
> 
```
与`input.tsx`不同的是，这对应多行输入。接受所有`textarea`的属性，并且允许外部获得ref。

## tooltip.tsx

项目自定义实现的一个轻量化提示气泡组件。用于鼠标悬停的时候，或者聚焦在某个元素时，浮现的一小段文字。

# features\\chat

根据开源社区的常见规范，鉴于本项目集中在聊天功能上，于是把一系列的UI组件放在`features\chat`里。

由于我写的是code-walkthrough，先按照文件顺序来。并且与wiki不同，是基于代码的。

## components

所有的组件。
### auth-panel.tsx

负责登录页面。职责：
- 展示登录页视觉
- 接收邮箱输入
- 在密码与邮箱验证码两种主登录方式之间切换
- 接收密码输入并发起邮箱密码登录
- 发送邮箱验证码并校验验证码登录
- 发起 GitHub OAuth 登录
- 展示登录反馈

文件开头定义了许多Props，Type。以及：
1. 用于获取失败信息的`getErrorMessage()`和
2. 用于从URL中解析登陆回调结果的`parseAuthFeedbackFromLocation`。通过`window.location.search`浏览器内置API来获取参数，并且`get`到对应的状态字符串。

然后是主函数，使用了React常见的`useRef,useState,useEffect`来管理一系列的前端状态。按顺序：
1. 第一个`useEffect`，页面挂载时初始化，恢复上次使用过的邮箱，解析回调链接的URL。如果链接过期，那么焦点将重新放回邮箱输入框
2. 第二个`useEffect`，60秒的邮件发送限制
3. `handleSubmit`，表单提交处理函数。主要是提交密码，通过发送请求到`/api/auth/password`中来获取Response。若成功，则提示可以进入会话工作区。
4. `handleSendEmailCodeClick`，发送验证码。发送请求到`/api/auth/email-code/send`来获取Response。
5. `handleVerifyEmailCodeClick`，处理邮箱验证码登陆。同样发送请求到`/api/auth/email-code/verify`来获取Response。

最后返回的组件将是一个未登录页的完整登陆面板，将大致为：
```tsx
<motion.main>
  背景装饰层

  <section>
    <div>
      品牌标识 WebAI

      标题区
      登录方式切换 tab

      邮箱输入框

      根据 authMode 二选一：
        密码登录表单
        邮箱验证码登录表单

      GitHub 登录按钮

      反馈提示 Alert
    </div>
  </section>
</motion.main>
```
外观将是：
![[Pasted image 20260515220739.png]]


### chat-header.tsx

聊天工作区的头部控制栏。负责移动端侧栏入口，模型选择，收藏当前会话，编辑会话级提示词。

返回的结构大致是
```tsx
<header>
  <div className="grid grid-cols-[auto_1fr_auto]">
    <div>
      移动端侧栏按钮
    </div>

    <div>
      模型 DropdownMenu
    </div>

    <div>
      收藏按钮
      提示词按钮
    </div>
  </div>
</header>

```
移动端按钮是针对手机适配的，如红框处：
![[Pasted image 20260515221906.png|258]]
电脑端则会隐藏这个侧边栏：
![[Pasted image 20260515221956.png]]

其中：
1. 左侧的移动端侧栏按钮，行为是点击后调用`onOpenMobileSidebar`，即打开移动端侧边栏。大屏隐藏，小屏显示。
2. 中间的模型选择菜单，是`DropdownMenu`。并且可以根据模型的能力展示其类型：![[Pasted image 20260515222325.png|379]]
3. 右侧的收藏和会话级提示词修改内容顾名思义。

### chat-input.tsx

即聊天页面的底部聊天区。

文件开头定义了许多`useState`的内容后，定义了许多函数来实现很多功能：
1. `showUrlLimitWarning`，若用户输入的URL达到上限后，展示1.5秒的警告。
2. `handleAddUrlContext`，处理添加的URL
3. `handleSubmitDraft`，保存当前的发送消息为草稿，准备发送。如果URL输入框中有一个还没有正式添加的URL，也会发送时一起带上。并且也有状态检查，至少`对话|URL|附件`存在其一时才发送
4. `handleUploadFiles`，处理添加的附件。
5. `handleInlineUploadFiels`，附件处理核心函数。比如说粘贴，拖拽，文件选择时，文件时校验并处理。成功后，新上传的附件追加到当前附件数组。
6. `useLayoutEffect`，自定义Hook，自动测量textarea的高度。
7. 第一个`useEffect`，发送后，重新聚焦到文本输入框
8. 第二个`useEffect`，设置Thinking档位
9. 第三个`useEffect`，自动cleanup。

最后返回大概是：
```tsx
<motion.div>                 // 整个输入面板容器
  URL Context 展开面板          
  // 只有 isUrlContextPanelOpen 为 true 时显示

  <div>                      // 主输入区
    <MotionTextarea />        // 正文输入框

    附件预览列表               // 有附件时显示
    附件错误提示               // 有错误时显示

    <div>                    // 底部工具栏
      <div>                  // 左侧工具按钮组
        添加文件按钮
        隐藏的 file input
        联网按钮
        thinking 档位菜单
        URL Context 按钮
      </div>

      发送/停止按钮
    </div>
  </div>
</motion.div>
```
红框所示：
![[Pasted image 20260515224105.png]]

### chat-shell.tsx

真正的核心。用于拼接整个网页绝大部分元素。用户在登陆之后，该文件负责将各种组件拼接在一起。并且从：
1. `useChatSession`，管理当前聊天消息层面的。
2. `useChatWorkspace`，管理聊天工作区的聊天状态
3. `useMessageScroll`，管理UI滚动层
这是三个大自定义Hook。以及用于获取模型信息和运行时模型配置的：
4. `useFetchedModels`
5. `useGeminiRuntimeConfig`

然后是逐个函数：
1. `getErrorMessage`，规范错误信息
2. `showWorkspaceNotice`，展示通知，比如“正在创建分支”，“模型同步失败”等
3. `handlePromptDialogOpenChange`，控制会话级提示词的开关，关闭的时候会清空编辑草稿。并清除工作区错误。
4. `handleSaveSystemPrompt`，保存会话级提示词
5. `handleSaveGeminiRuntimeConfig`，保存Gemini运行配置
6. `handleFetchGeminiModels`，拉取Gemini模型列表
7. `handleUpdateFetchedModel`，根据拉取的模型列表更新某个模型的启用状态和默认状态
8. `handleDeleteFetchedModel`，删除某个已经拉取的模型。
9. `handleSignOut`，登出。调用`/api/auth/sign-out`API。
10. `handleSendMessage`，发送消息。首先它会接受`content,attachments,urls`，清除旧的错误。自动命名标题和校验当前会话ID，并调用来自`useChatSession`的`handleSubmit`真正发送
11. `handleCopyMessage`，复制消息。
12. `handleEditMessage`，编辑消息后重新生成，调用多个hook提供的函数来处理。
13. `handleBranchFromMessage`，处理分支。首先会创建一个工作区的提示，然后调用`handleBranchConversation`来执行世纪的操作。
14. `handleRegenerateMessage`，重新生成消息。
15. `handleJumpToLatest`，提供了一个按钮来“回到底部”，内部执行`scrollToLatest()`
16. 第一个`useEffect`，首次登陆时自动拉取模型。
17. `updateCurrentUser`，更新用户个人信息时，处理刷新前端用农户信息。
18. `handleUpdateProfile`，更新个人名称时，调用`/api/profile`，来实际保存。
19. `handleUploadAvatar`，上传头像。调用`/api/profile/avatar`。成功后刷新
20. `handleUpdatePassword`，修改密码。调用`/api/profile/password`的`PATCH`。

最后的return大概是：
没有登陆的时候，就是简单的`AuthPanel`面板
登陆的时候，就是：
```tsx
// 1. 未登录状态：只返回登录页
if (!user) {
  return (
    <AuthPanel />
  );
}

// 2. 已登录状态：返回完整聊天工作区
return (
  <>
    <全局工作区通知 />

    <整页聊天布局>
      <左侧会话侧边栏 />

      <右侧聊天主区域>
        <背景渐变层 />

        <顶部聊天控制栏 />

        <工作区错误提示 />

        <消息与输入区域>
          <消息列表 />

          <底部聊天输入框 />
        </消息与输入区域>
      </右侧聊天主区域>
    </整页聊天布局>

    <会话级提示词弹窗>
      <弹窗标题和说明 />

      <提示词编辑框 />

      <弹窗底部操作区>
        <取消按钮 />
        <保存按钮 />
      </弹窗底部操作区>
    </会话级提示词弹窗>
  </>
);
```

### code-block

负责代码块的渲染。采用了`highlight.js`的渲染。如果传入的`language`无法识别，就使用`highlightAuto`来自动高亮。

代码框右上角支持复制按钮，复制走的是`Clipboard API`，如果失败，则采用`fallbackCopyText`函数，走`execCommand`的方式。

最后返回的结构如图：

### conversation-sidebar.tsx

负责左侧的会话sidebar。包括了一系列的会话导航和管理。

先有一系列的工具函数：
1. `formatUpdatedAt`：负责将会话列表展示时间格式化为`5/17 23:05`这种格式
2. `formatFetchedModelCapabilities`：将Fetched的模型，根据其`capabilities`，给其添加上`联网，视觉...`等标签
3. `getAvatarFallback`：用户刚注册时，使用`UserRoundIcon`这种`Fallback`，即未设置头像时的采用的默认图
4. `getAvatarImageSrc`：获取用户头像URL的实际地址，返回一个URL，这个URL就是`/api/profile/avatar?path-...`，便于发送请求到API端
5. `UserAvatar`：利用上述有关用户头像的函数，负责返回用户头像的组件
6. `WebAILogo`：获取本项目的LOGO，返回组件
7. `getUserDisplayName`：简单的一个解析函数，返回`user.displayName/email.trim()`。若都不存在，返回`WebAI 用户`

解读`ConversationSidebar`这个超大的函数：
1. `useState`定义一系列可能需要前端反馈的状态
2. 一系列的`handle...`，绝大部分都是设置状态后，简单中转一层函数，调用由`ConversationSidebarProps`解包得来的一系列自定义`Hook`提供的函数，处理各种各样的前端事件。可能会有错误处理。
3. `const sidebarContent`，定义了一个组件，这个组件是共享侧栏内容的，避免移动端和桌面端出现不一致的情况。结构大致为：
```tsx
const sidebarContent = (
  <div>
    顶部品牌区 / 折叠按钮

    新对话按钮

    最近对话列表区域
      ScrollArea
        如果没有会话：显示空状态
        如果有会话：map(conversations)
          每个会话项
            如果正在编辑：显示重命名 Input 表单
            否则：显示会话按钮 + 操作菜单

    底部用户区域
      用户头像 / 昵称 / 邮箱
      用户菜单：账户、收藏、归档、Gemini、退出
  </div>
);
```


最后返回的组件大致结构如下：
```tsx
<>
  桌面端侧栏 aside
  移动端侧栏 Sheet
  收藏会话 Dialog
  归档会话 Dialog
  个人账户 Dialog
  Gemini 设置 Dialog
  删除确认 Dialog
</>
```
### markdown-message.tsx

用于渲染AI返回的Markdown信息。专门适配了`cjk`和`Latex`行间行级公式的处理。

函数解读：
1. `isSingleDollarDelimiter`和`isEscaped`都是判断一个美元符号`$`到底是不是一个单独的美元符号，避免被识别为公式
2. `containsCjkNaturalLanguage`：判断一段字符串里是否存在中日韩文字，采用正则。避免被识别为公式。配合下方的`escapeCjkContaminatedSingleDollarMath`来去掉`$中文$`的样子。后者会自动添加转义。
3. `normalizeSingleLineDisplayMath`，处理单行块级公式
4. `extractTextContent`：从React节点中递归提取纯文本
5. `MarkdownMessage`，最后返回的组件。真正负责把聊天消息正文渲染为富文本。

### message-attachments.tsx

负责消息附件的前端展示与编辑弹窗。会在`chat-input.tsx`和`message-bubble.tsx`中用到。

定义了一系列的工具函数：
1. `getAttachmentLabel`：返回附件显示名称
2. `isConvertedXlsxAttachment`：判断附件是否为`xlsx`文件。
3. `ImagePreviewPortal`：渲染图片的放大预览层
4. `AttachmentPreviewList`：展示一组附件预览
5. `AttachmentEditorDialog`：渲染“修改附加项”的弹窗


### message-bubble.tsx

负责渲染聊天气泡。定义了外部传入的`MessageBubbleProps`，用于提供一系列的配置，包括：
1. 是否中断？
2. 允许重新生成？
3. 支持图片/文件
4. 正在上传附件？
5. 一系列的`on...`的外部Hooks

工具函数：
1. `isCjkCharacter`：判断一个字符是否为CJK字符。对于中日韩文字，它们应当逐字流式输出，而非一个基于空格的一个单词。
2. `isWordCharacter`：判断一个字符是否为英文或者数字。
3. `splitStreamingUnits`：将文本拆分成逐个显示的小单元，便于流式输出。拆分规则为
	-   \r` 直接忽略
	- `\n` 单独保留
	- 空格和 tab 会合并成一个块
	- CJK 字符按单字拆
	- 英文/数字按短片段拆，不超过三个字符
	- 其他符号按单字符拆
4. `getQueuedContent`：将当前已经显示的内容`baseContent`和还在队列中等待揭示的内容拼接。
5. `getRevealBatchSize`：动态调整揭示的单位。如果队列挤压的词很多，则一次吐出更多的字符数量。
6. `getRevealDelay`：动态调整揭示的延迟。如果队列挤压的词很多，则延迟越短

流式消息组件`StreamingMarkdown`：
1. 维护一系列的`useState`和`useRef`指向。比如`displayContent`，`isFreshReveal`，`queuedUnitsRef`，`revealGlowTimerRef`，`displayContentRef`
2. 第一个`useEffect`：同步最新的`displayContent`到ref中
3. 第二个`useEffect`：维护组件卸载时的清理定时器
4. 第三个`useEffect`：流式逻辑的主控制器。如果似乎`reduced motion`模式，则取消流式。若内容不是单调增长，则重置显示的内容。如果是单调增长，则把新增的部分拆分成单元发送到`queuedUnitsRef.current`中。然后启动`flushQueue`，从待揭示队列中去一批内容放到`displayContent`，然后递归安排下一次更新。
5. 最后返回一个能实时展示Markdown，又能表达生成状态的消息正文UI。

思考摘要组件`ThinkingSummary`，把`assistant`的`thinking metadata`渲染成一个可以折叠的摘要卡片。根据状态显示：
- `思考中`
- `已思考`
- `已停止`
- `思考失败`
并且默认折叠，点击后展开内容。

然后是主消息的气泡组件`MessageBubble`，处理一系列比如：
- 角色识别：`assistant / user / system / error`
- 状态展示：`pending / streaming / cancelled / error`
- 普通文本渲染
- assistant 流式渲染
- 思考摘要展示
- user 消息编辑
- 消息复制
- 分支
- 重新生成
- URL 上下文展示
- 附件展示
- 编辑附加项弹窗

定义一系列表示状态的词后：
1. 第一个`useEffect`：若消息内容或者metadata发生变化，同步到最新消息数据
2. 定义一系列的`handle...`函数。
最后返回的组件大致是：
```tsx
<MessageBubble>
  <motion.article>
    <头部信息区>
      <角色图标 />
      <角色标签 />
      <状态徽标 />
    </头部信息区>

    <消息主体区>
      <编辑态>
        <文本输入框 />
        <修改附加项按钮 />
        <URL预览 />
        <附件预览列表 />
        <取消按钮 />
        <保存按钮 />
      </编辑态>

      <等待占位态>
        <加载图标 />
        <状态文本 />
      </等待占位态>

      <已取消空态 />

      <流式Markdown消息 />

      <普通Markdown消息 />
    </消息主体区>

    <附加信息区>
      <已停止标记 />
      <URL上下文摘要 />
      <附件预览列表 />
    </附加信息区>

    <附件编辑弹窗 />

    <操作栏>
      <复制按钮 />
      <编辑按钮 />
      <分支按钮 />
      <重新生成按钮 />
    </操作栏>
  </motion.article>
</MessageBubble>
```

### message-list.tsx

承载滚动消息流的消息列表，如果是空的，显示欢迎页面。

其中的两个Ref
1. `scrollContainerRef`：指向整个消息容器，获取滚动区域。挂在到`ScrollArea`中
2. `messageEndRef`：指向消息列表最底部的空`div`的ref。用于滚动到消息底部。
用来提升用户体验。

返回的组件大致为
```tsx
<MessageList>
  <外层容器>
    <ScrollArea ref={scrollContainerRef}>
      <内容区域>
        <空会话欢迎页 />
        或
        <消息列表>
          <MessageBubble />
          <MessageBubble />
          <MessageBubble />
          ...
          <底部锚点 ref={messageEndRef} />
        </消息列表>
      </内容区域>
    </ScrollArea>

    <跳转到底部按钮>
      <ArrowDownIcon />
    </跳转到底部按钮>
  </外层容器>
</MessageList>
```

### message-url-content.tsx

处理用户发送消息附带的一组网页链接，将其添加进metadata中。

`MessageUrlContextSummary`返回一个横向换行的摘要调：
```tsx
<MessageUrlContextSummary>
  <容器>
    <标题>
      <链接图标 />
      <文本>URL Context · 数量</文本>
    </标题>

    <可见URL链接 />
    <可见URL链接 />
    <可见URL链接 />

    <隐藏数量标记 />
  </容器>
</MessageUrlContextSummary>
```

`EditableMessageUrlContent`：用于展示并编辑一组`URL Context`。由聊天发送框的URL按钮触发：
```tsx
<EditableMessageUrlContext>
  <外层卡片>
    <顶部行>
      <URL列表摘要>
        <标题>
          <链接图标 />
          <文本>URL Context · 数量</文本>
        </标题>

        <URL标签>
          <URL展示文本 />
          <删除按钮 />
        </URL标签>

        <隐藏数量标记 />
      </URL列表摘要>

      <编辑按钮 />
    </顶部行>

    <展开编辑区>
      <输入行>
        <URL输入框 />
        <添加按钮 />
      </输入行>

      <错误提示 />
    </展开编辑区>
  </外层卡片>
</EditableMessageUrlContext>
```

### model-icon.tsx

获取模型的图标。图标放在Supabase的Storage中。


### workspace-notice.tsx

在聊天页面的顶部显示一个轻量的，不打算操作的通知条。有三个样式：
1. `loading`样式
2. `success`样式
3. `error`样式

返回组件的结构为：
```tsx
<WorkspaceNotice>
  <固定定位容器>
    <AnimatePresence>
      <通知卡片>
        <图标区域>
          <NoticeIcon />
        </图标区域>

        <文字区域>
          <标题 />
          <描述 />
        </文字区域>
      </通知卡片>
    </AnimatePresence>
  </固定定位容器>
</WorkspaceNotice>
```

## hooks

`features/chat/hooks` 是聊天页面的状态编排层。它不直接渲染 UI，也不直接写数据库，而是把组件事件、API 请求、本地乐观状态和服务端返回结果接起来。

这一层可以粗略分成四块：

1. `use-chat-session.ts`：消息交互层，负责发送、编辑、重新生成、停止生成、附件上传和 URL Context。
2. `use-chat-workspace.ts`：会话工作区层，负责会话列表、激活会话、会话级控制项和二级管理入口。
3. `use-fetched-models.ts`：模型设置层，负责 Gemini 模型拉取、启用、默认项和删除。
4. `use-message-scroll.ts`：消息列表滚动层，负责自动吸底、用户上滑暂停和跳到底部按钮。

这样拆的原因是很直观的：`ChatShell` 本身已经承担页面拼装，如果继续把所有状态都写在一个组件里，后面会变成一个巨大组件。Hooks 把“可见组件”和“业务状态机”分开，组件只管展示，Hook 负责告诉组件现在是什么状态、点击后该做什么。

### use-chat-session.ts

这是消息交互层。它管的是“某个会话里的消息怎么变化”，而不是整个工作区怎么切换。

它承接的功能比较多：

- 普通发送消息：`POST /api/chat`
- 编辑 user 消息并重新生成：`PATCH /api/messages/[messageId]`
- 重新生成最新 assistant 消息：`POST /api/messages/[messageId]/regenerate`
- 停止当前会话的流式生成：`POST /api/chat/cancel`
- 上传附件：`POST /api/attachments/upload`
- 管理 URL Context 输入和当前草稿附件

它内部最重要的状态有几组：

1. `conversationMessages`：按 `conversationId` 分组保存消息缓存。
2. `urlContextInputValue` / `urlContextUrls`：当前输入区的 URL Context 草稿。
3. `draftAttachments`：当前输入区还没发送的附件草稿。
4. `isUploadingAttachments`：附件上传状态。
5. `streamingTasks`：当前哪些会话正在生成。
6. `streamingTasksRef`：保存真实的 `AbortController`，用于取消生成。

这里同时用 `streamingTasks` 和 `streamingTasksRef` 是有必要的。`streamingTasks` 是给 UI 看，比如按钮是否 loading；`streamingTasksRef` 是给事件函数拿最新的中断控制器。前者需要触发渲染，后者不能因为每次流状态变化都让组件重渲染。

主要函数：

1. `getErrorMessage`：把未知错误转成可展示文案。
2. `isConversationSubmitting`：判断某个会话是否正在生成。
3. `beginStreamingTask`：开始一轮生成。若同一个会话已经有生成任务，就直接拒绝，避免并发写同一个会话。
4. `updateStreamingAssistantMessageId`：服务端创建真实 assistant 消息后，更新当前流式任务的消息 ID。
5. `endStreamingTask`：清理一轮生成任务。
6. `syncConversationMessages`：用服务端快照同步某个会话的消息。
7. `removeConversationMessages`：删除某个会话在前端缓存里的消息。
8. `getMessages`：按当前会话 ID 读取消息列表。
9. `updateConversationMessages`：以函数式方式修改某个会话消息，避免直接改原数组。
10. `replaceMessage`：把一条占位消息替换成服务端返回的新消息。
11. `markAssistantMessageCancelled`：把正在生成的 assistant 消息改成 `cancelled`。
12. `addUrlContextUrl` / `removeUrlContextUrl` / `toggleUrlContextPanel`：管理 URL Context 输入。
13. `uploadAttachments`：上传文件并返回 `MessageAttachment[]`。
14. `stopStreaming`：中断当前会话生成，同时通知服务端把 assistant 消息改成 cancelled。
15. `submitMessage`：发送普通消息的主流程。
16. `editMessageAndRegenerate`：编辑 user 消息后，截断后文并重新生成 assistant。
17. `regenerateAssistantMessage`：重新生成某条 assistant 消息。

`submitMessage` 的流程比较能代表这个 Hook 的设计：

```txt
构造 user 消息和 assistant 占位消息
  -> 本地先乐观追加到 conversationMessages
  -> 请求 /api/chat
  -> consumeAssistantStream 消费服务端 NDJSON 流
  -> 不断 replaceMessage 更新 assistant 气泡
  -> 流结束后清理 streaming task
```

这里的重点是“前端先有占位气泡”。否则用户点击发送后要等服务端创建消息成功才看到反馈，流式体验会慢一拍。

编辑和重新生成则多了一层回滚逻辑：如果服务端还没接受请求就失败，会恢复 `previousMessages`，避免页面停在一个数据库没有承认的乐观状态。当然如果服务端已经开始返回流了，后续错误就会落到 assistant 消息本身的 `error` 状态里。

### use-chat-workspace.ts

这是会话工作区层。它管的是“当前打开哪个会话、会话列表怎么维护、会话级控制项是什么”，比 `use-chat-session` 更外层。

它管理的状态主要有：

1. `conversations`：普通 active 会话列表。
2. `archivedConversations`：归档区会话列表。
3. `favoriteConversations`：收藏区会话列表。
4. `activeConversationId`：当前激活会话。
5. `availableModels`：当前聊天可用模型。
6. `draftModelId` / `draftSystemPrompt` / `draftWebSearchEnabled` / `draftThinkingLevel`：空白首页还没创建会话时的草稿控制项。
7. 各种 loading 状态：创建、删除、归档、恢复、加载收藏、加载归档等。

这里最值得注意的是“草稿态控制项”。空白首页还没有 `conversationId`，但用户仍然可以先选模型、改 system prompt、开关联网、调整 thinking level。真正发送第一条消息时，`ensureConversationId` 才创建会话，并把这些草稿控制项一起写进数据库。

这就是它的设计重点：**会话存在前，控制项是本地草稿；会话存在后，控制项是数据库里的会话配置。**

主要函数：

1. `getErrorMessage`：错误文案兜底。
2. `getDefaultModelId`：从模型列表里找默认模型，找不到就取第一个。
3. `sortConversations`：按 `updatedAt` 倒序排序，让最近活动会话靠前。
4. `resetDraftConversationControls`：把空白会话草稿控制项重置回默认值。
5. `syncAvailableModels`：同步可用模型列表，并校正草稿模型 ID。
6. `upsertConversation`：有则更新，无则插入，然后重新排序。
7. `syncFavoriteConversation`：维护收藏区列表，收藏就插入，取消收藏就移除。
8. `createConversation`：调用 `/api/conversations` 创建会话，并同步空消息数组。
9. `patchConversationControls`：统一 PATCH 会话级控制项，比如标题、模型、system prompt、联网、thinking。
10. `saveSystemPrompt`：保存当前会话或草稿态的 system prompt。
11. `toggleWebSearchEnabled`：切换联网。已有会话走 PATCH，空白态只改草稿。
12. `handleDeleteConversation`：乐观删除会话，失败时恢复三份列表和激活会话。
13. `loadArchivedConversations` / `loadFavoriteConversations`：加载归档区和收藏区。
14. `handleToggleFavoriteConversation`：收藏 / 取消收藏，先乐观更新，失败再回滚。
15. `handleSelectThinkingLevel`：切换思考档位。
16. `handleArchiveConversation` / `handleRestoreConversation`：归档和恢复。
17. `handleBranchConversation`：从某条消息创建分支会话，并同步返回的完整消息快照。
18. `ensureConversationId`：如果当前没有会话，就用草稿配置创建一个。
19. `resetAfterSignOut`：退出登录后清理工作区状态。

它有两个比较关键的 `useEffect`：

1. 进入工作区后重新拉取 `/api/models`，用服务端最新启用模型校正前端模型列表。
2. `activeConversationId` 变化时拉取 `/api/conversations/[conversationId]`，同步会话和完整消息快照。

这两个 effect 里都有 `cancelled` 标记。原因是切换会话可能很快，旧请求如果后返回，不应该把旧会话消息覆盖到新会话上。

### use-fetched-models.ts

这是 Gemini 模型设置层。它服务的不是普通聊天发送，而是“用户自己的模型列表怎么管理”。

它对应四类 API：

1. 读取当前用户已拉取的模型：`GET /api/models/fetched`
2. 用用户填写的 API Key / Base URL 拉取 Gemini 模型：`POST /api/models/gemini/fetch`
3. 启用、停用、设为默认模型：`PATCH /api/models/fetched/[modelId]`
4. 删除某个已拉取模型：`DELETE /api/models/fetched/[modelId]`

内部状态很少，但边界很重要：

1. `fetchedModels`：完整模型列表，给 Gemini 设置弹窗看。
2. `isLoadingFetchedModels`：正在读取已保存模型。
3. `isFetchingGeminiModels`：正在请求 Gemini 远端模型列表。
4. `updatingFetchedModelId`：当前正在操作哪一条模型记录。

核心函数是 `syncFetchedModelState`：

```ts
setFetchedModels(models);
onAvailableModelsSynced(models.filter((model) => model.isEnabled));
```

这段说明了它的真正作用：同一份服务端模型列表，被拆成两种前端状态。

- Gemini 设置弹窗需要完整列表，包括未启用、不支持、默认项等信息。
- 聊天顶部模型选择只应该看到 `isEnabled` 的模型。

主要函数：

1. `getErrorMessage`：错误文案兜底。
2. `syncFetchedModelState`：同步完整 fetched 列表，同时把已启用模型推给聊天运行时。
3. `loadFetchedModels`：读取数据库中当前用户的 fetched models。
4. `fetchGeminiModels`：保存本机 Gemini 运行时配置，并调用服务端拉取远端模型列表。
5. `updateFetchedModel`：启用 / 停用模型，或者设置默认模型。
6. `deleteFetchedModel`：删除用户列表里的某个 fetched model。

这里更新和删除都不做前端局部猜测，而是等待服务端返回完整列表。因为默认模型唯一性、不支持模型不能启用、删除默认模型后的处理，这些都属于服务端和数据库规则。前端只发意图，最终状态以服务端返回为准。

### use-message-scroll.ts

这是消息列表滚动层。它只管用户读消息时的滚动体验。

它解决的问题很具体：AI 正在流式输出时，页面通常应该自动滚到底部；但用户一旦主动向上滚去看历史消息，就不能继续把他拉回底部。

主要状态：

1. `messageEndRef`：消息列表末尾的空 `div`，用于 `scrollIntoView`。
2. `scrollContainerRef`：滚动容器。
3. `showJumpToLatest`：是否显示“跳转到底部”按钮。
4. `shouldStickToBottomRef`：是否应该自动吸底。
5. `isAutoScrollPausedByUserRef`：是否因为用户上滑而暂停自动滚动。
6. `scrollIntentRef`：用户滚动意图，`up` 或 `down`。
7. `lastScrollTopRef` / `lastTouchYRef`：记录上一次滚动位置，用于判断方向。

这里大量使用 `useRef`，原因是滚动事件非常高频。像 `scrollTop`、触摸坐标、是否暂停吸底这些行为状态，不应该每变化一次就触发 React 重新渲染。只有 `showJumpToLatest` 这种真正影响 UI 可见性的值才用 `useState`。

主要函数：

1. `isNearBottom`：判断当前滚动位置距离底部是否小于阈值。这里留了 80px 缓冲，避免轻微滚动就打断吸底。
2. `getOverlayViewport`：从 DOM 根节点里找到 OverlayScrollbars 真正的滚动 viewport。
3. `getScrollElement`：从滚动事件中找到应该读取 `scrollTop` 的元素。
4. `pauseAutoScroll`：用户上滑时暂停自动吸底，并显示跳到底部按钮。
5. `resumeAutoScrollIfAtBottom`：用户重新滚回底部附近时恢复自动吸底。
6. `scrollToLatest`：给跳到底部按钮用，滚到底部并恢复自动吸底。
7. `handleScroll`：核心滚动处理函数，判断用户是在上滑、下滑还是已经回到底部。
8. `handleWheelCapture`：桌面端滚轮方向判断，向上滚时立即暂停自动吸底。
9. `handleTouchStartCapture` / `handleTouchMoveCapture`：移动端用手指 Y 坐标差值判断滚动意图。

这些函数基本都用 `useCallback` 包起来，不只是为了性能。更重要的是这些函数会被传给 `ScrollArea` 和 `MessageList`，而且滚动事件非常频繁。函数引用稳定，事件绑定和 memo 组件就更稳定。

还有一个 `useEffect` 监听 `messages`：

```txt
messages 变化
  -> 如果 shouldStickToBottom 为 true，就滚到 messageEndRef
  -> 如果用户已经暂停自动吸底，就只显示跳到底部按钮
  -> 如果消息为空，就重置滚动状态
```

所以这个 Hook 的本质不是“每次有消息就滚到底”，而是维护一个更像聊天产品的阅读规则：用户在底部，就跟随新回复；用户在看历史，就不要打扰他。

## lib

features\chat的内部专用工具层。提供给`component,hook`的可复用工具。

### attachment-client.ts

聊天附件输入的客户端预校验工具。主要在`ChatInput`和`MessageAttachments`中使用。拦截明显不合法的文件。

1. `getAttachmentAcceptMimeTypes`：获取支持的附件类型
2. `isSupportedByCurrentModel`：看文件拓展名和浏览器给的`MIME`是否被模型所支持。
3. `getAttachmentFileValidationError`：校验函数。
4. `getFileSizeLimit`：根据文件类型决定返回大小上限

### chat-stream.ts

服务于`useChatSession`。服务端的`/api/chat`或消息重新生成接口会持续返回一行一行的JSON事件，将读取，拆解，校验事件，更新`Assistant`消息和同步`conversation`集中到一个文件中。

1. `mergeAssistantMessageParts`：将服务端返回的`assistant`消息快照，合并为更适合本地展示的消息结构。若内容是旧内容的延长，只把新增的文本追加到part。如果不是，说明服务端出了问题，用完整文本重建parts。
2. `createCancelledAssistantMessege`：把一个assistant消息转换为`cancelled`状态。
3. `consumeAssistantStream`：主函数，负责消费服务端数据流。根据事件类型，更新本地消息或者会话。

### clipboard.ts

给复制消息操作使用的工具。

1. `copyTextWithFallback`：一旦浏览器提供的复制接口不可用，则创建一个不可见的`textarea`，然后调用`document.execCommand("copy")`来复制。无论成功与否，都会移出这个临时`textarea`
2. `copyTextToClipboard`：走现代的`Clipboard API`

### gemini-runtime-config.ts

对Gemini本机运行时配置管理，管理用户填写的
1. Gemini API Key
2. Gemini Base URL
这些保存在浏览器的`localStorage`，不会进入数据库。

一些函数：
1. `getGeminiRuntimeConfigStorageKey`：根据用户id生成`localStorage key`
2. `normalizeGeminiRuntimeConfig`：规范化
3. `loadStoredGeminiRuntimeConfig`：加载
4. `removeStoredGeminiRuntimeConfig`：清除
5. `useGeminiRuntimeConfig`，主要的Hook，返回三个工具函数`geminiRuntimeConfig,saveGeminiRuntimeConfig,clearGeminiRuntimeConfig`。

### motion-presets.ts

聊天的动画参数集合。便于组件复用。

### url-context.ts

聊天URL Context输入的前端工具，负责URL数量上限，展示文本和输入标准化。

1. `getUrlDisplayText`：展示的URL短文本
2. `normalizedUrlCandidate`：规范化
3. `areUrlListEqual`：按顺序比较两个URL列表是否完全相同，用语编辑URL后的判断


# lib

全局业务层，负责真正的后端业务逻辑。服务于整个应用的数据契约，AI调用，环境配置，安全限制。

```
src/lib
├─ ai/
│  ├─ assistant-stream-response.ts
│  ├─ gemini-base-url.ts
│  ├─ gemini-model-catalog.ts
│  ├─ gemini-model-normalizer.ts
│  ├─ gemini.ts
│  ├─ index.ts
│  ├─ stream-control.ts
│  ├─ system-instruction.ts
│  └─ types.ts
│
├─ env/
│  ├─ app-origin.ts
│  ├─ server.ts
│  └─ supabase.ts
│
├─ schemas/
│  ├─ auth.ts
│  ├─ chat.ts
│  ├─ conversation.ts
│  ├─ model.ts
│  └─ thinking.ts
│
├─ supabase/
│  ├─ admin.ts
│  ├─ auth.ts
│  ├─ conversations.ts
│  ├─ messages.ts
│  ├─ model-registry.ts
│  ├─ profiles.ts
│  ├─ proxy.ts
│  └─ server.ts
│
├─ attachment-capabilities.ts
├─ attachment-config.ts
├─ attachments.ts
├─ conversation-title.ts
├─ network-errors.ts
├─ rate-limit.ts
├─ release-notes.ts
└─ utils.ts
```

## ai

AI的服务于流式生成层。负责Gemini相关的服务端逻辑。
- index.ts：AI 统一入口。
- gemini.ts：Gemini SDK adapter。
- assistant-stream-response.ts：生成 + 落库 + NDJSON 响应编排。
- stream-control.ts：当前进程内的取消生成控制。
- gemini-base-url.ts：自定义 endpoint 安全边界。
- gemini-model-catalog.ts：产品认可的模型能力目录。
- gemini-model-normalizer.ts：远端模型列表标准化。
- system-instruction.ts：system prompt 合并。
- types.ts：AI 层共享流式类型。
### index.ts

AI层的统一入口。接受项目统一的`ChatMessage[]`和生成选项，然后转发给`streamWithGemini`

### gemini.ts

利用Gemini的原生SDK调用层，负责把WebAI的统一消息转换为`Content[]`，然后调用`generateContentStream`

主要函数：
1. `normalizeUrls`：规范化URL
2. `withUrlContextPrompt`把URL Context临时拼接到最后一条user消息里
3. `toGeminiAttachmentParts`：把消息附件转成Gemini能够理解的parts
4. `toGeminiContents`：把`ChatMessage[]`转换成`Gemini SDK`的`content[]`。首先过滤空消息，把`user,assistant`映射为`user,model`。从设计上只会给最新的user消息附加二进制文件，历史消息保留正文。
5. `streamWithGemini`：调用主函数，返回`AsyncGenerator<AssistantStreamDelta>`。
	1. 读取 API Key 和 Base URL。
	 2. 标准化 Gemini Base URL。
	 3. 合并 URL Context。
	 4. 生成 system instruction。
	 5. 转换 messages 为 Gemini contents。
	 6. 创建 GoogleGenAI client。
	 7. 调用 client.models.generateContentStream。
	 8. 把 Gemini chunk 统一转成 `{ type, delta }`。

### assistant-stream-response.ts

AI生成与数据库之间的编排层。负责创建 assistant 占位消息、消费 AI delta、节流写库、推送 NDJSON 事件、处理取消和错误。

1. `createStreamEventChunk`：把一个流事件转换为NDJSON行
2. `isAbortError`：判断是否是取消请求导致的错误
3. `createStreamResponse`：把`ReadableStream<Uint8Array>`类型的`stream`转换为`HTTP Response`。
4. `getAssistantFailureContent`：获取失败信息
5. `createAssistantStreamResponse`：主函数。核心流程是：
	1. 先创建一条空 assistant 消息，状态 pending。
	2. 注册当前 conversation 的 AbortController，供 /api/chat/cancel 中断。
	3. 创建 ReadableStream。
	4. 立即推送 assistant-message-created。
	5. 调用 streamAssistantReply 获取 Gemini delta。
	6. 每个 delta 更新本地 assistant 快照，并推送 assistant-message-updated。
	7. 每 120ms 节流写入数据库一次。
	8. 完成后写入最终 complete 状态。
	9. touchConversation 更新时间。
	10. 推送 conversation-updated 和 done。

### stream-control.ts

服务端进程内的生成中断注册表。它让 `/api/chat/cancel` 可以通过 `conversationId` 找到正在生成的流并 `abort`。

1. `registerConversationStream`：注册当前会话的`AbortController`
2. `unregisterConversationStream`：移除注册
3. `cancelConversationStream`：通过`conversationId`找到`controller`并`abort`
4. `mergeAbortSignals`：把多个`abort signal`合成一个。

### gemini-base-url.ts

自定义 Gemini Base URL 的标准化和安全校验模块。

1. `normalizeIpLiteral`：去掉`IPv6`地址的外层`[]`
2. `parselpv4Parts`：把`IPv4`字符串拆成四个数字。并校验是否合法
3. `isBlockedIpAddress`：判断IP是否属于禁止访问的本机/内网/link-local网段
4. `assertGeminiBaseUrlResolvesPublicly`：如果传入的是域名，则会先DNS解析一次
5. `normalizeGeminiBaseUrl`：主函数：
	1. 空值使用默认 Gemini URL。
	2. 要求协议必须是 https。
	3. 禁止 username / password / query / hash。
	4. 禁止 localhost 和内网地址。
	5. DNS 解析后再次阻止内网解析。
	6. 返回去掉尾部 / 的 URL。

### gemini-model-catalog.ts

WebAI 注册的 Gemini 模型目录。允许哪些Gemini模型在本项目中可用。并且补全一些模型能力。

支持的模型目录：
- gemini-3-flash-preview
- gemini-3-pro-preview
- gemini-3.1-pro-preview
- gemini-2.5-pro
- gemini-2.5-flash

### gemini-model-normalizer.ts

Gemini `models.list` 结果的标准化模块。它把 `Google SDK` 返回的 `Model` 转成 WebAI 的 `NormalizedFetchedGeminiModel`。

1. `normalizeModelId`：把Gemini返回的模型名转成项目使用的`model id`
2. `getModelActions`：兼容读取不同端点返回的动作字段
3. `supportGenerateContent`：判断模型是否支持`generateContent`，保守认为可用。
4. `shouldIncludeFetchedGeminiModel`：判断拉取的模型是否应当进入聊天列表，会排除：
	- image / imagen
	- veo
	- live
	- tts
	- embedding
	- deep-research
	- computer-use 等
5. `normalizeFetchedGeminiModel`：主要的标准化函数。如果模型命中`catalog`，则使用允许使用。否则不允许。

### system-instruction.ts

获取提示词

### types.ts

AI层的共享类型文件。只定义流式delta。

## env

环境变量层。把“运行这个项目必须有哪些配置”集中校验掉。

这个文件夹的意义是：不要让各个 router 到处直接读 `process.env`，否则一旦配置缺失，错误会分散在不同链路里，很难判断到底是业务失败还是环境没配好。

### app-origin.ts

应用来源地址工具。主要服务于登录、OAuth、Magic Link、开发环境免登录这些需要回跳 URL 的地方。

核心函数：

1. `normalizeOrigin`：把传入的地址规整成 `origin`，并且只允许 `http` 或 `https`。
2. `getAppOrigin`：获取当前应用的可信来源。
3. `createAppUrl`：基于应用来源拼出完整 URL。

这里比较重要的是优先级：

```txt
APP_ORIGIN
  -> NEXT_PUBLIC_APP_URL
  -> VERCEL_URL
  -> 开发环境下从 requestUrl 推断
```

生产环境不直接相信请求头里的 `Host`。因为登录回跳地址如果被代理头污染，轻则跳错域名，重则出现安全问题。所以生产环境必须显式配置来源。

### server.ts

服务端 Gemini 运行环境配置。

它校验：

1. `GEMINI_MODEL`：默认是 `gemini-2.5-flash`。
2. `GEMINI_BASE_URL`：可选，但如果写了就必须是合法 URL。

核心函数：

1. `getServerEnv`：第一次读取时用 Zod 校验，之后缓存结果。
2. `requireServerEnvValue`：真正需要某个值时再强制要求存在。

这里有个细节：Gemini API Key 没有在这里强制校验。因为当前项目允许用户在浏览器本机填写 API Key，并通过请求带到服务端使用。也就是说，服务端环境变量和用户本机运行时配置是两条来源，不能在启动阶段就把 API Key 写死为必填。

### supabase.ts

Supabase 公开环境变量校验。

它校验：

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

这两个变量既会被服务端用，也会被浏览器侧用，所以单独放在一个轻量文件里。和 `server.ts` 一样，它也会缓存校验后的结果，避免每次创建 Supabase client 都重复 parse。

## schemas

schemas 是整个项目的跨端数据契约层。

这里的重点不是“为了类型好看”，而是让前端请求、后端 router、数据库映射、流式事件都尽量按同一份结构说话。这样 API route 收到请求以后，第一步就能把不符合预期的数据挡掉。

### auth.ts

用户认证相关 schema。

主要内容：

1. `authUserSchema`：前端真正需要的用户信息，只有 `id/email/displayName/avatarUrl`。
2. `sendEmailCodeRequestSchema`：发送邮箱验证码请求。
3. `verifyEmailCodeRequestSchema`：验证邮箱验证码请求，验证码要求是 6-10 位数字。
4. `signInWithPasswordRequestSchema`：邮箱密码登录请求。

这里没有把 Supabase 的完整 `User` 对象暴露给前端。前端只需要展示和识别用户，不需要知道 Supabase Auth 内部那一大堆字段。

### chat.ts

聊天消息、附件、流式事件和发送请求的核心 schema。

它定义了几组重要对象：

1. 消息角色：`user / assistant / system / error`
2. 消息状态：`pending / streaming / complete / cancelled / error`
3. 消息正文 parts：当前主要是文本 part
4. URL Context：最多 4 个 URL
5. 消息附件：最多 5 个附件
6. Gemini 本机运行时配置：`apiKey/baseUrl`
7. 消息 metadata：`urls / attachments / thinking`

发送消息的请求 `sendMessageRequestSchema` 有一个很重要的规则：

```txt
正文、URL、附件，三者至少存在一个
```

所以用户可以只发附件，也可以只发 URL Context，不一定必须有正文。这和多模态输入的产品语义是一致的。

取消生成的请求要求同时带：

1. `conversationId`
2. `assistantMessageId`

这样取消不是只按会话粗暴处理，而是能绑定到正在生成的 assistant 消息，避免同一会话后续新回复被旧取消请求误伤。

最后的 `createChatMessage` 是前端本地构造消息对象的统一入口。哪怕消息还没有落库，也先长成和 schema 一样的结构，UI 就不需要处理一堆半成品对象。

### conversation.ts

会话对象 schema。

会话里包含：

1. 标题
2. 会话级 system prompt
3. 会话级模型
4. 会话级联网开关
5. thinking level
6. active / archived 状态
7. 收藏状态
8. 创建和更新时间

`createConversationRequestSchema` 支持传入可选的 `id`。这个设计服务于前端乐观创建会话：浏览器先生成 UUID，侧栏先出现一个新会话，然后服务端用同一个 ID 落库。这样成功后不需要再把前端临时 ID 替换成服务端 ID。

`updateConversationRequestSchema` 则要求至少提供一个可更新字段。否则一个空 PATCH 请求没有业务意义，应该直接被 schema 拦掉。

### model.ts

模型注册表的前后端契约。

一个模型不只是 `modelId`，还包含：

1. 展示信息：`label/description/icon`
2. provider：目前固定是 `gemini`
3. 调用信息：`apiStyle/upstreamModelId/baseUrl`
4. 默认项和排序
5. 能力声明：文本、图片、文件、联网、URL Context、thinking、流式输出等

`fetchedModelSchema` 在 `aiModelSchema` 基础上补了管理字段：
1. `isEnabled`
2. `source`
3. `fetchedAt`
4. `catalogMatched`

这对应 Gemini 设置弹窗里的用户私有模型列表。聊天运行时只应该看到已经启用、并且能力边界可信的模型。

### thinking.ts

thinking 档位定义。

当前支持：

1. `minimal`
2. `low`
3. `medium`
4. `high`

默认是 `minimal`。这里叫档位而不是开关，是因为 Gemini 3 Flash 不能完全关闭 thinking，最低档就是 minimal。

## supabase

Supabase 文件夹是数据库访问层，也是后端业务边界最重的一层。

它主要做三件事：

1. 把数据库的 `snake_case` 字段映射成前端使用的 `camelCase`。
2. 把常见数据库操作封装成业务函数，避免 route 里堆 SQL 查询细节。
3. 把访问控制、数据一致性、默认值和一些错误语义集中起来。

### auth.ts

认证上下文工具。

主要函数：

1. `getSupabaseAuthContext`：创建服务端 Supabase client，并读取当前用户。
2. `mapAuthUser`：把 Supabase 的完整 `User` 压缩成前端需要的用户对象。

大部分需要登录的 API route 都会先调用 `getSupabaseAuthContext`。它不直接抛“未登录”，而是返回 `user`，由具体 route 决定怎么返回 `401` 或继续处理。

### server.ts

服务端 Supabase SSR client。

它的重点不是创建 client 本身，而是接入 Next.js 的 cookie 上下文。Supabase Auth 的 session 就在 cookie 里，服务端组件和 route handler 需要通过这些 cookie 知道当前是谁。

`setAll` 里有一个 `try/catch`。因为 Server Component 里不一定能写响应 cookie，所以这里做兼容：能写就写，不能写时交给 `proxy.ts` 的 session 刷新链路处理。

### proxy.ts

Supabase 登录态刷新层。

`updateSession` 会在请求经过 proxy 时创建 Supabase SSR client，然后调用：

```ts
await supabase.auth.getUser();
```

这句看起来像是只读用户，但它的真实作用还包括触发 Supabase 检查和刷新 session cookie。

它还统一补了几个安全响应头：

1. `X-Content-Type-Options`
2. `X-Frame-Options`
3. `Referrer-Policy`
4. `Permissions-Policy`

所以很多 route 里能直接 `auth.getUser()`，是因为 proxy 层已经帮忙维护了 cookie 状态。

### admin.ts

Supabase admin client。

它读取：

1. `SUPABASE_SECRET_KEY`
2. 或 `SUPABASE_SERVICE_ROLE_KEY`

然后用 service role 创建不持久化 session 的 Supabase client。这个 client 只适合服务端敏感操作，比如注销账户时删除 Auth 用户和清理用户对象，不能进入浏览器。

### profiles.ts

用户展示资料访问层。

主要函数：

1. `getUserProfile`：读取 `profiles` 表。如果没有记录，就返回一个空资料对象。
2. `updateUserProfile`：用 `upsert` 写入昵称或头像 URL。

这里的设计是：Auth 用户负责登录身份，`profiles` 负责产品里的展示资料。二者不要混在一起。

### conversations.ts

会话数据访问层。

它负责把数据库里的 `conversations` 行转成前端使用的 `Conversation`。

主要函数：

1. `listConversations`：列出 active 或 archived 会话。
2. `listFavoriteConversations`：列出收藏会话。
3. `createConversation`：创建会话。
4. `getConversationById`：读取指定会话，并检查是否属于当前用户。
5. `updateConversation`：局部更新标题、system prompt、模型、联网、thinking、归档状态。
6. `favoriteConversation` / `unfavoriteConversation`：收藏与取消收藏。
7. `deleteConversation`：删除会话，并尝试清理不再引用的附件。
8. `touchConversation`：只更新 `updated_at`，用于最近会话排序。

这里有几个细节比较关键。

第一，数据库字段集中在 `mapConversation` 里转成前端字段。这样 UI 不需要知道 `system_prompt`、`web_search_enabled` 这些数据库命名。

第二，`updateConversation` 只写入显式传入的字段。这样同一个 PATCH 函数既能只改标题，也能只改 system prompt。

第三，归档不是删会话，而是改：

```txt
status = archived
archived_at = 当前时间
```

恢复时再把 `archived_at` 置空。

第四，删除会话之前会先读取消息 metadata 里的附件引用，删除会话后再 fire-and-forget 清理不再被引用的 Storage 对象。清理失败不阻断主流程，因为删除会话的体验优先，不应该因为 Storage 清理慢而卡住用户。

### messages.ts

消息数据访问层。

数据库里消息来源字段叫 `sender_type`，前端统一叫 `role`。`mapMessageRow` 负责把数据库行转成 `ChatMessage`。

主要函数：

1. `listConversationMessages`：按时间正序读取一个会话的全部消息。
2. `listConversationMessagesThrough`：读取到指定消息为止，用于创建分支会话。
3. `getConversationMessage`：读取指定消息。
4. `createConversationMessage`：插入 user 或 assistant 消息。
5. `cloneConversationMessages`：复制消息到新会话，用于分支。
6. `updateConversationMessage`：局部更新消息内容、状态或 metadata。
7. `cancelAssistantMessage`：把正在生成的 assistant 消息标记为 cancelled。
8. `deleteConversationMessagesById`：删除指定消息集合。
9. `editUserMessageAndDeleteFollowing`：调用数据库 RPC，原子化编辑 user 消息并删除后续消息。

这里有两处非常能体现项目边界。

第一，历史消息必须按 `created_at` 正序读取，再按 `id` 补充排序。因为模型上下文和聊天展示都依赖顺序，一旦顺序乱了，模型看到的对话就会错。

第二，`updateConversationMessage` 带了：

```ts
.neq("status", "cancelled")
```

这条是为了避免取消生成后，迟到的流式写库又把 cancelled 消息写活。也就是说，取消一旦赢了，后续旧流就不能再改这条消息。

编辑消息那条 RPC 也很关键。编辑 user 消息和删除它后面的 assistant 回复，必须是一个整体。否则会出现“用户消息已经改了，但旧回复还挂在后面”的半更新状态。

### model-registry.ts

模型注册表访问层。

这层连接了三个东西：

1. 项目内置 Gemini catalog
2. 用户从 Gemini 端点拉回来的模型列表
3. 聊天运行时真正可调用的模型集合

主要函数：

1. `ensureDefaultFetchedModels`：给每个用户补默认 catalog 模型。
2. `listFetchedModels`：读取用户完整模型列表，给设置弹窗用。
3. `listEnabledModels`：读取已启用模型，给聊天运行时用。
4. `getEnabledModelById`：根据数据库 ID 读取某个已启用模型。
5. `upsertFetchedGeminiModels`：增量写入拉取到的 Gemini 模型。
6. `replaceFetchedGeminiModels`：用最新远端列表覆盖用户模型列表。
7. `updateFetchedModel`：启用、停用、设为默认模型。
8. `deleteFetchedModel`：删除某个用户拉取模型。

它的核心原则是：模型能不能进入聊天链路，不只看用户是否勾选，还要看它是否命中项目 catalog。未命中 catalog 的模型可以展示，但不能启用，因为项目不知道它到底是否稳定支持图片、文件、联网、thinking 等能力。

默认模型也有保护：

1. 每个用户至少会得到默认 catalog 模型。
2. 默认模型不能通过用户菜单删除。
3. 删除当前默认项后，会尝试从剩余启用的 catalog 模型里补一个默认项。

这样聊天顶部永远尽量有一个可用模型，不会因为用户设置把自己完全锁死。

## others

被多个 route、组件或服务端链路共享。

### attachment-config.ts

附件能力配置中心。

这里集中定义：

1. Storage bucket：`message_attachments`
2. 单条消息最多附件数：5
3. 图片大小上限：5MB
4. 文件大小上限：10MB
5. 单条消息附件总大小上限：20MB
6. 支持的 MIME 类型和文件扩展名
7. 支持范围提示文案

它同时导出数组、Set 和 Map。数组适合生成 `input accept` 或展示文案，Set/Map 适合运行时快速判断。

`buildAttachmentObjectUrl` 会生成：

```txt
/api/attachments/object?path=...
```

因为附件存在私有 Storage 里，前端不能直接拿公开 URL，必须通过鉴权代理路由读取。

### attachments.ts

附件上传、转换、校验和清理的服务端工具。

主要能力：

1. 判断 MIME 是否支持。
2. 根据类型决定大小上限。
3. 清洗展示文件名。
4. 生成安全 Storage 路径。
5. 把 `.xlsx` 转换成 CSV。
6. 上传附件到 Supabase Storage。
7. 校验附件是否属于当前用户。
8. 清理不再被任何消息引用的附件。
9. 下载附件 Buffer，供 Gemini 调用层组装输入。

这里最重要的是 Storage 路径：

```txt
userId/drafts/attachmentId/attachment.ext
```

真正的对象 key 不直接拼原始文件名。中文、空格、特殊符号都只留在 metadata 里展示，Storage 路径本身保持稳定安全。

Excel 处理也在这里完成。`.xlsx` 会先转成 CSV 再上传和传给模型，因为 CSV 更接近文本模型可以稳定理解的格式。多 sheet 文件会保留 sheet 名，避免模型看不出不同表之间的边界。

### attachment-capabilities.ts

附件与模型能力的后端校验。

`assertAttachmentInputAllowed` 会做两件事：

1. 校验附件 storagePath 是否属于当前用户。
2. 根据模型能力判断是否允许图片或文件输入。

这个判断放在 API 边界，而不是只放前端，是因为浏览器传回来的 metadata 不可信。发送、编辑、重新生成三条链路都要守同一条规则，所以集中在这里。

### conversation-title.ts

会话标题工具。

包含：

1. `DEFAULT_CONVERSATION_TITLE`：默认是“新会话”。
2. `createAutoConversationTitle`：从用户第一条消息生成自动标题。

自动标题会先压缩空白，再用 `Array.from` 按字符截断前 10 个字符，超出就加 `...`。用 `Array.from` 是为了更稳地处理中文和 emoji 这类字符。

### network-errors.ts

网络错误识别工具。

`isFetchNetworkError` 会识别：

1. `fetch failed`
2. `ECONNRESET`
3. `UND_ERR_CONNECT_TIMEOUT`
4. `ETIMEDOUT`

`getNetworkErrorMessage` 则把网络类错误转换成更友好的 fallback 文案。它不会吞掉所有错误，只处理确实像网络失败的情况。

### rate-limit.ts

轻量限流工具。

它用进程内 `Map` 维护计数桶，适合保护邮箱验证码、密码登录这类低频匿名入口。

主要函数：

1. `getClientIp`：从 `x-forwarded-for` 或 `x-real-ip` 里取客户端 IP。
2. `assertRateLimit`：根据 key、次数和时间窗口做限制。

这个限流只在当前服务进程内有效。真正的生产级全局限流仍然应该交给 Cloudflare、Supabase Auth 或其他网关层。

### release-notes.ts

当前版本日志的元信息。

现在指向：

```txt
wiki/Optimization/version/V1.1.md
```

前端更新日志弹窗和登录后版本提示可以通过这个文件知道当前展示哪一份版本说明。

### utils.ts

通用样式工具。

`cn(...)` 把 `clsx` 和 `tailwind-merge` 包在一起：

1. `clsx` 负责条件 class 拼接。
2. `tailwind-merge` 负责合并冲突的 Tailwind class。

所以项目里大量组件都可以写：

```tsx
className={cn("基础样式", 条件 && "条件样式", className)}
```

这也是 shadcn/ui 常见的写法。
