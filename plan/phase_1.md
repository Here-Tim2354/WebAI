# Phase 1

## 目标
- 从零搭建可运行的 WebAI 聊天主链路 MVP
- 优先完成“发送消息 -> 服务端调用 Gemini -> 返回 assistant 回复 -> 可继续对话”
- 保持边界清晰，为 Phase 2 流式输出、Phase 3 持久化留接口

## 本阶段结论
- 技术栈：Next.js App Router + TypeScript + Zod
- Gemini 接入：服务端使用 `@google/genai`
- 模型：`gemini-3-flash-preview`
- 会话策略：应用侧维护完整消息历史；服务端每次整理历史后调用模型
- `Interactions API`：仅预留适配空间，不作为本阶段主实现
- system instruction：保留代码入口，默认返回空字符串

## 产品边界
- 仅桌面 Web，不做移动端
- 单页单会话，多轮对话，刷新丢失
- 空态参考 ChatGPT：左侧保留侧栏骨架，主区大留白，底部圆角输入框
- 聊天态包含消息流、输入框、发送按钮、assistant 占位气泡
- `Enter` 发送，生成中允许继续编辑输入框，但不支持排队发送
- 错误以消息气泡形式插入，先用占位文案，不做复杂分类

## 内容体验
- 支持 Markdown
- 支持代码块高亮
- 支持代码复制按钮
- 不支持 HTML 透传

## 数据与接口
- 定义统一消息 schema：`user` / `assistant` / `system` / `error`
- 每条消息具备稳定 id、role、parts/content、状态字段
- 统一前后端请求/响应 schema
- API Key 仅存在服务端

## 推荐实现顺序
1. 初始化 Next.js 基础工程与依赖
2. 建立基础目录、类型、schema、环境变量校验
3. 实现 Gemini 服务端调用层与 system instruction 占位
4. 实现聊天 API route
5. 实现页面壳、侧栏骨架、空态布局、输入区
6. 实现消息流、assistant 占位、发送态、错误气泡
7. 接入 Markdown、代码高亮、复制按钮
8. 联调主链路并补基础异常处理

## 完成标志
- 用户可以发送消息并收到 Gemini 回复
- 可以连续进行多轮对话
- API Key 不暴露给客户端
- 页面基础视觉完整，主链路稳定

## 约束
- 不为未来功能提前引入复杂状态机
- 不在本阶段实现流式输出、会话持久化、多会话管理
- 优先保证主链路完成度，再做工程补齐
