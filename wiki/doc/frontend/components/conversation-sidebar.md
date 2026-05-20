# `src/features/chat/components/conversation-sidebar.tsx`

## 文件定位

`ConversationSidebar` 是左侧会话导航和账户设置中心。它由 [[components/chat-shell|ChatShell]] 调用，拿到会话列表、归档列表、收藏列表、模型列表、当前用户和一组操作回调。

## 核心职责

这个文件很大，因为侧栏承接了多条产品链路：

- 会话新建、切换、重命名、删除。
- 会话归档、恢复、收藏区。
- 侧栏折叠和移动端 Sheet。
- 左下角用户菜单。
- Gemini Key / URL 与 fetched models 设置。
- 个人账户：昵称、头像、密码、注销。
- 更新日志入口。

## 局部状态

主要 `useState` 可以按弹窗和表单分组：

- 侧栏：`isCollapsed`。
- 重命名：`editingConversationId`、`titleDraft`。
- 删除确认：`pendingDeleteConversation`。
- 列表弹窗：`isArchiveDialogOpen`、`isFavoriteDialogOpen`。
- Gemini 设置：`isGeminiSettingsDialogOpen`、`geminiApiKeyDraft`、`geminiBaseUrlDraft`、`geminiSettingsError`。
- 个人账户：`isAccountDialogOpen`、`displayNameDraft`、`passwordDraft`、`passwordConfirmDraft`、`accountMessage`、`accountError`。
- 账户动作锁：`isSavingProfile`、`isUploadingAvatar`、`isUpdatingPassword`、`isDeleteAccountDialogOpen`。

这些状态都是局部 UI 状态。真正的会话数组、模型数组和用户对象由上层传入。

## 关键函数

- `handleRenameSubmit()`：提交局部标题草稿，调用 `onRenameConversation`。
- `handleConfirmDeleteConversation()`：先关闭确认弹窗，再调用删除。这样不会用弹窗硬控用户等待接口。
- `handleOpenArchiveDialog()` / `handleOpenFavoriteDialog()`：打开弹窗并刷新对应列表。
- `handleOpenGeminiSettingsDialog()`：把当前运行时配置写入草稿，并加载 fetched models。
- `handleFetchGeminiModelsClick()`：用草稿 Key / URL 拉取 Gemini 模型。
- `handleToggleFetchedModel()` / `handleSetDefaultFetchedModel()` / `handleDeleteFetchedModel()`：把模型启停、默认、删除交给上层 Hook。
- `handleSaveProfile()` / `handleAvatarFileChange()` / `handleSavePassword()`：账户资料相关动作。
- `handleConfirmDeleteAccount()`：注销账户，成功后关闭账户弹窗和移动端侧栏。

## 设计缘由

侧栏里确实有很多 UI，但它的边界还算清楚：侧栏管“用户怎么点”，不管“数据怎么写”。会话写入在 `useChatWorkspace`，模型写入在 `useFetchedModels`，账户接口在 `ChatShell` 封装。

桌面端 aside 和移动端 Sheet 复用同一个 `sidebarContent`，避免维护两套列表 DOM。这是这个文件里最值得注意的结构选择。

## 返回组件规模

返回两个形态：桌面端固定侧栏和移动端 Sheet。桌面侧栏可折叠，展开时宽度约 `18rem`，折叠时只保留图标轨道。文件后半部分还渲染归档、收藏、账户、注销确认、Gemini 设置、删除确认等多个 `Dialog`。

## 代码展开

### 为什么侧栏文件这么长

这个组件的职责不是单纯“列出会话”。它同时是工作区的管理入口：左侧会话列表、移动端抽屉、用户头像菜单、归档区、收藏区、Gemini 设置、个人账户、删除确认都在这里。因此读文件时不要从 JSX 一路硬读，应该先按状态分区。

### 桌面和移动端复用同一份内容

文件中间有一个 `sidebarContent` 变量，它包含实际侧栏内容。桌面端把它放进固定 `aside`，移动端把同一份内容放进 `SheetContent`。这个设计减少重复 DOM，但也意味着移动端打开、选择会话、新建会话后要调用 `onMobileOpenChange(false)` 收起抽屉。

### 重命名流程

重命名有两个局部状态：

- `editingConversationId`
- `titleDraft`

提交时 `handleRenameSubmit` 会 trim 标题。如果为空，直接返回；如果非空，就调用父层 `onRenameConversation`。失败时 catch 为空，刻意保留编辑态和草稿，让用户能继续修改而不是丢掉输入。

### 删除对话流程

删除不是点击按钮就立刻请求，而是先把目标会话放进 `pendingDeleteConversation`，弹出确认框。确认后：

```ts
setPendingDeleteConversation(null);
await onDeleteConversation(conversation.id);
```

这里先关弹窗，再等待删除。这样接口慢的时候不会把用户卡在确认框里。真正的乐观移除和失败回滚在 `useChatWorkspace.handleDeleteConversation` 中完成。

### Gemini 设置弹窗

打开 Gemini 设置时，组件把当前 `geminiRuntimeConfig` 拷贝到草稿：

- `geminiApiKeyDraft`
- `geminiBaseUrlDraft`

保存时会校验 URL 必须是合法 `https`。拉取模型时则把草稿配置传给 `onFetchGeminiModels`。模型列表中的每一项都有三个动作：

- 启用 / 停用：`onUpdateFetchedModel(model.id, { isEnabled })`
- 设为默认：`onUpdateFetchedModel(model.id, { isDefault: true })`
- 删除：`onDeleteFetchedModel(model.id)`

不支持 catalog 的模型会显示“不支持”，并禁用启用开关。受保护默认模型不能删除。

### 账户弹窗

账户弹窗打开时会把当前用户昵称放进 `displayNameDraft`，并清空密码输入和消息提示。它包含三条链路：

1. 保存资料：`onUpdateProfile(displayNameDraft.trim())`
2. 上传头像：文件 input 变化后调用 `onUploadAvatar(file)`
3. 修改密码：先检查两次密码是否一致，再调用 `onUpdatePassword(passwordDraft)`

注销账户是二次确认弹窗。确认后调用 `onDeleteAccount`，成功后关闭账户弹窗和移动端侧栏。

### 会话项的视觉状态

会话项需要同时表达：

- 是否当前激活。
- 是否正在生成。
- 是否正在删除、归档、恢复。
- 是否正在编辑标题。
- 是否收藏。

因此文件中会频繁看到 `isDeletingConversationId === conversation.id` 这类判断。它们不是业务数据，而是操作反馈。

### UI 规模

展开侧栏约是一个窄工作台：顶部品牌和折叠按钮，中间新对话按钮与会话列表，底部用户菜单。移动端则是从左侧滑出的 `Sheet`。弹窗尺寸更大：Gemini 设置约 `52rem`，账户约 `42rem`，删除确认约 `42rem`。
