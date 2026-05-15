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

#### attachements

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
之后就把`attachements`作为`Response`返回。若上传文件本身发生错误，也有对应的处理机制。

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

Supabased支持的邮箱验证码router。

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

简单鉴权和校验后，通过前端获取当前的`messaegeId`，再通过`listConversationMessageThrough`获取上文。并且要求这个消息是处于完毕`complete`的状态，而不是`pending/streaming`。之后创建会话。

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

