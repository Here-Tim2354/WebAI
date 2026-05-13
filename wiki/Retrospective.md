# 复盘

本项目是Tim针对本次项目的手写复盘，旨在让Tim总结这次的开发经验，提升日后的开发效率。

## 最大的问题

这次项目开发的是一个完成度较高的基础AI聊天对话网页。实际开发中却并没有按照一个良好的软件工程指导去开发，而是简单起草`plan/`之后就直接跟Codex对话。经常出现中途改变云端数据库的情况。若不是GPT5.4,5.5本身具备极强的后端能力，这个项目早就会因为中途发现方向需要修正，需要大刀阔斧地修改，导致陷入进退两难的境地。

忽视的地方：
1. 并没有采用先有Figma设计稿，再有前端开发的标准流程。产品的品牌化采用了自然语言去描述，导致实际观感并不统一。事后才了解到组件库的存在。而我本人的审美也有待加强。
2. 并没有事先了解Tailwind CSS和Shadcn/ui的原理，导致前端改UI的时候，gpt5.4经常改不对的同时，我也不具备排查的能力
3. 忽略了尽管国模都支持OpenAI Compatible格式，但实际上各个提供商提供的API存在各种细枝末节的，需要调节的地方。故一开始打算网页支持Gemini格式和OpenAI格式，但最后鉴于庞大的工作量砍掉了OpenAI格式，导致已经migration的云端数据库需要重大修正。这是最严重的。
4. 忽略了用户登陆，页面配置持久化的功能需求，导致云端需要相应的migration，好在影响不算大。


## 工作流搭建

工作流搭建是发现了部分重复性的工作后，慢慢摸索出来的。

目前采用`wiki`的方式配合Obsidian统一组织文档。作为项目知识库，通过`plan/`同步上下文，具体为[[current_todo]]和[[phase_overview]]。也通过各种文件来一一描述具体的功能。

并且定义了一个Skills来同步文档。
```Markdown
---
name: sync-doc
description: 用于会话收尾时同步项目文档。用户要求整理或同步 wiki/doc/*、更新 wiki/plan/phase/current_todo.md、重建索引页、清理旧双链、或在阶段切换后输出具体交接内容时使用。
---

# 文档同步

## 目标

保持项目文档与当前代码、阶段状态一致。
以 `wiki/plan/phase/phase_overview.md` 作为需求基线，以 `wiki/plan/phase/current_todo.md` 作为实时进度面，以 `wiki/doc/*` 作为需要持续同步的项目文档集。

## 工作流

1. 先读当前阶段文档。
2. 通常是通过`git diff`判断本轮修改过的文件，并检查受影响的 `wiki/doc/*` 笔记和相关索引页。
3. 判断项目里哪些内容已经变化，哪些内容已经过时。
4. 更新相关文档与索引页。
5. 把旧链接改到新的笔记名和新的 `GUIDE.md` 索引页。
6. 如果旧文件已经被替代，把它改成简短的迁移跳转页，并明确提醒用户手动删除旧文件。
7. 更新 `current_todo.md`，写入最新阶段进度、待办和下一步。
8. 在最终回复里给出具体结果：改了什么、怎么重组的、清掉了哪些旧链接、哪些文件还需要手动删除。

## Obsidian 约定

- 保证 vault 内部笔记优先使用双链语法 `[[wikilink]]`。
- 索引页统一使用 `GUIDE.md`。
- 一个笔记被替代后，旧文件名不应继续出现在 backlinks 或 outgoing links 里。
- 笔记改名后，要同步更新周边索引页和所有提到旧名称的文档。
- 保持文风与周围项目笔记一致，不要突然换成另一套语气。

## 安全边界

- 不要自己删除文件。
- 不要让旧笔记继续被活跃文档引用。
- 允许重构分层结构。如果结构调整很大，要明确说清楚哪些文件被移动、拆分或弃用。
- 一般不修改指定目录以外的文件。除非用户显式提出要求。

## 输出要求

每次完成后都要给出简洁但具体的总结，至少包括：

- 更新了哪些文档
- 改了哪些索引页
- 清掉了哪些旧链接
- 哪些文件需要用户手动删除
- 还有哪些未解决的空缺
```

工作流搭建是收获最大的地方，它让我专注复用已有经验，总结打包为Skills，从而节省大量的时间。而我只需要专注于确认需求和开发。

## 不了解的技术

我很信任GPT5.4和5.5，感谢Codex让我勇于尝试全新的技术栈。本次项目用到了非常非常多我安全不熟悉的技术栈：

开发语言：
1. Typescript，HTML，CSS
核心全栈：
2. Next.js APP Router
数据库支持
3. Supabase（PostgreSQL）
前端开发：
4. React
5. Tailwind CSS v4
6. Shadcn/ui
7. lucide-react
8. motion
9. geist
10. variant
11. clsx/tailwind-merge
核心API：
12. genai（Gemini API）
辅助外部库：
13. overlayscrollbars-react
14. zod
15. read-excel-file
工程工具：
16. eslint
17. knip
18. postcss
公网部署：
19. Vercel
20. Cloudflare
开发支持：
21. Visual Studio Code
22. Zed
23. Codex + GPT5.3 codex/5.4/5.5
24. Github
25. Obsidian

除了Obsidian是比较熟悉的以外，剩下的大多数都不是很熟悉。并且很多外部库是在开发中途引入的。
# 项目介绍

这是一个WebAI的用户-AI聊天对话系统。对话支持基本的多模态，附件上传，调整思考强度，Gemini独有的谷歌联网和URL上下文，聊天气泡支持Markdown渲染，Latex渲染，可展开思考过程，流式输出，一键滚动到底栏等视觉功能。而对话拥有修改对话，重新生成，复制，分支，收藏会话，调整会话级提示词，重命名会话，归档会话等功能。

由Supabase提供的用户登陆，根据账号识别对应数据，邮箱发送验证邮件等功能均有支持。也制作了比如浏览收藏区，归档区，用户个人资料，修改密码的基本用户体验功能。


接下来按照实际代码架构来分析拆解这个项目

# src

src存放源代码，其他的则是各种配置文件。

## app

存放了绝大多数功能的路由API，基于Supabase提供的auth路由，以及用于定义全局CSS的`global.css`，用于定义全局共享的HTML外壳层`layout.tsx`，以及真正的项目入口`page.tsx`。

绝大部分的请求和返回都有`zod`校验数据格式的流程。
### api

api下包含非常多router，负责根据前端发送请求，后端接受请求来执行对应的功能。而且所有的router的文件开头都有SupabaseAuthContext的鉴权功能，对应功能为必须要求用户是登陆的。

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


