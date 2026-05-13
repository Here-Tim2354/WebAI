---
aliases:
  - ConversationSidebar 状态流
---

# ConversationSidebar 前端状态流说明

这篇笔记帮助我们理解 `ConversationSidebar` 的前端运行机制，而不是页面展示结构。

代码入口：
- `src/features/chat/components/conversation-sidebar.tsx`

关联笔记：
- [[conversation-sidebar]]
- [[chatshell-stateflow]]

## 1. 组件定位

`ConversationSidebar` 负责会话导航交互，但它本身不是数据源。

更准确地说：

- 会话数据由 `ChatShell` 持有
- `ConversationSidebar` 接收这些状态和回调
- 然后负责把“用户操作”转换成对父层回调的调用

所以它是一个“交互型展示组件”，不是一个自己发请求的数据组件。

---

## 2. 来自父组件的输入

父组件 `ChatShell` 传入的关键 props 包括：

- `conversations`
- `activeConversationId`
- `isCreating`
- `isDeletingConversationId`
- `isArchivingConversationId`
- `isRestoringConversationId`
- `isLoadingArchivedConversations`
- `isLoadingFavoriteConversations`
- `isSigningOut`
- `currentUser`
- `geminiRuntimeConfig`
- `fetchedModels`
- `isFetchingGeminiModels`
- `mobileOpen`
- `onMobileOpenChange`
- `onCreateConversation`
- `onSelectConversation`
- `onRenameConversation`
- `onDeleteConversation`
- `onArchiveConversation`
- `onRestoreConversation`
- `onLoadArchivedConversations`
- `onLoadFavoriteConversations`
- `onSaveGeminiRuntimeConfig`
- `onFetchGeminiModels`
- `onUpdateProfile`
- `onUploadAvatar`
- `onUpdatePassword`
- `onSignOut`

这些输入决定了：

- 当前显示什么
- 哪一项是激活态
- 哪些按钮应该显示加载态
- 点击后应该触发哪个父层逻辑

---

## 3. 本组件自身维护的状态

虽然数据主权在父层，但 `ConversationSidebar` 仍然维护了一些局部 UI 状态。

### 3.1 `isCollapsed`

```tsx
const [isCollapsed, setIsCollapsed] = useState(false);
```

作用：
- 控制桌面端侧栏是否收起

特点：
- 只影响本地布局展示
- 不影响父层会话数据

---

### 3.2 `editingConversationId`

```tsx
const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
```

作用：
- 表示当前正在重命名的是哪一个会话

特点：
- 为 `null` 时，列表全部是普通态
- 为某个 id 时，对应项进入编辑态输入框

---

### 3.3 `pendingDeleteConversation`

```tsx
const [pendingDeleteConversation, setPendingDeleteConversation] =
  useState<Conversation | null>(null);
```

作用：
- 表示当前正在等待确认删除的是哪条会话

特点：
- 不只是存 id，而是直接存整条 `Conversation`
- 这样删除弹窗里可以直接显示标题

---

### 3.4 `titleDraft`

```tsx
const [titleDraft, setTitleDraft] = useState("");
```

作用：
- 保存重命名输入框里的标题草稿

特点：
- 只在编辑态使用
- 提交成功或失焦时会清空

### 3.5 二级面板状态

侧栏还维护个人账户、收藏区、归档区和 Gemini 设置面板的开关状态。

这些状态只影响弹窗显示，不直接拥有业务数据。

---

## 4. 核心交互流

### 4.1 新建会话

链路：

1. 用户点击“新对话”
2. 调用 `handleCreateConversationClick()`
3. 内部调用父层传入的 `onCreateConversation()`
4. 成功后自动关闭移动端抽屉

运行特点：

- 创建逻辑本身不在侧栏内部
- 侧栏只负责触发和 UI 收口
- 手动新建的空白会话仍先显示默认标题；首条文本消息发送时，由工作区层补成截断后的自动标题

---

### 4.2 切换会话

链路：

1. 用户点击某条会话卡片
2. `handleSelectConversation(conversation.id)`
3. 内部调用 `onSelectConversation(conversationId)`
4. 自动关闭移动端抽屉

结果：
- 父层 `ChatShell` 更新 `activeConversationId`
- 后续由 `ChatShell` 的 `useEffect` 继续加载会话详情

---

### 4.3 重命名会话

链路：

1. 用户在会话菜单中点击“重命名”
2. 设置：
   - `editingConversationId = 当前会话 id`
   - `titleDraft = 当前标题`
3. 该会话项切换到编辑态输入框
4. 用户提交表单
5. `handleRenameSubmit()` 调用父层 `onRenameConversation()`
6. 成功后退出编辑态

失败时：

- 组件会保留输入内容和编辑态
- 方便用户继续修正

布局边界：

- 重命名后的长标题不会改变侧栏或会话卡片宽度
- 会话项、表单和标题文本区都固定在侧栏可用宽度内
- 展示态标题只截断文本，操作菜单位置保持稳定

---

### 4.4 删除会话

链路：

1. 用户在菜单里点击“删除”
2. `setPendingDeleteConversation(conversation)`
3. 打开删除确认 `Dialog`
4. 用户点击确认删除
5. `handleConfirmDeleteConversation()` 调用父层 `onDeleteConversation(id)`
6. 确认弹窗立即关闭，后续等待由父层乐观状态承接

失败时：

- 弹窗不再保持打开，避免删除请求期间硬控用户
- 父层恢复会话列表和激活会话，并通过工作区错误提示说明失败原因

---

### 4.5 收藏与归档

收藏链路：

1. 用户在会话菜单中点击收藏或取消收藏
2. 调用父层会话收藏回调
3. 成功后由父层刷新列表和收藏区数据

归档链路：

1. 用户在会话菜单中点击归档
2. 调用 `onArchiveConversation(conversation.id)`
3. 成功后该会话离开最近列表
4. 用户可在归档区中调用 `onRestoreConversation()` 恢复

收藏区和归档区打开时会触发对应加载回调；登录后父层也会尝试静默预取，减少用户第一次打开时的等待。

---

### 4.6 个人账户

链路：

1. 用户从底部用户菜单打开个人账户
2. 修改昵称时调用 `onUpdateProfile(displayName)`
3. 上传头像时调用 `onUploadAvatar(file)`
4. 修改密码时调用 `onUpdatePassword(password)`
5. 成功后父层更新当前用户展示资料

个人账户面板只负责收集输入和展示反馈，资料写入由父层接口完成。

---

### 4.7 退出登录

链路：

1. 用户点击退出登录
2. `handleSignOutClick()`
3. 调用父层 `onSignOut()`
4. 成功后关闭移动端抽屉

逻辑主体仍在父层，侧栏只负责交互入口。

---

## 5. 展示状态如何由状态驱动

`ConversationSidebar` 的视觉变化主要受这些状态影响：

- `isCollapsed`
  - 决定桌面端侧栏宽窄
- `mobileOpen`
  - 决定移动端抽屉开关
- `editingConversationId`
  - 决定某条会话是输入框还是普通项
- `pendingDeleteConversation`
  - 决定删除弹窗是否打开
- 二级面板开关
  - 决定个人账户、收藏区、归档区和 Gemini 设置是否打开
- `activeConversationId`
  - 决定哪一项是当前激活态
- `isDeletingConversationId`
  - 决定哪一项显示删除中
- `isArchivingConversationId`
  - 决定哪一项显示归档中
- `isRestoringConversationId`
  - 决定归档区恢复按钮状态
- `isCreating`
  - 决定新建按钮是否显示“创建中...”
- `isSigningOut`
  - 决定退出按钮是否显示“退出中...”

也就是说，侧栏并不是“写死的静态列表”，而是一个高度依赖状态驱动展示的交互组件。

---

## 6. 为什么侧栏自己不请求数据

这是这个组件理解上的重点。

当前设计里：

- 侧栏不直接 `fetch`
- 侧栏不直接管理会话持久化
- 侧栏不直接管理个人资料持久化
- 侧栏只处理局部 UI 状态和面板输入

这样做的好处是：

- 页面级数据集中在 `ChatShell` / `useChatWorkspace`
- 侧栏可以保持更纯粹
- 会话逻辑不会分散在多个组件里

所以它更像：

- “会话交互面板”

而不是：

- “会话数据控制器”

---

## 7. 一句话总结

`ConversationSidebar` 的状态流本质是：父层提供会话、用户、模型和加载状态，本组件维护局部 UI 态，再把用户点击、编辑、收藏、归档、账户管理和退出这些动作回抛给父层执行。
