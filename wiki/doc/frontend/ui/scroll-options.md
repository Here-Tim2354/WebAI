# `src/components/ui/scroll-options.ts`

## 文件定位

`scroll-options.ts` 是 OverlayScrollbars 的配置文件。`ScrollArea` 按 axis 读取这里的配置。

## 核心内容

- `ScrollAreaAxis`：`vertical | horizontal | both`。
- `sharedScrollOptions`：统一主题、自动隐藏、点击滚动和更新 debounce。
- `scrollAreaOptionsByAxis`：按方向指定 overflow。
- `dropdownScrollOptions`：下拉菜单滚动配置，目前延迟更短。

## 设计缘由

滚动条配置不应该散落在每个 `ScrollArea` 调用点。集中在这里后，滚动条主题和响应节奏能保持一致。

## 返回规模

没有 UI，只是配置对象。

## 代码展开

### sharedScrollOptions

`sharedScrollOptions` 统一了主题和自动隐藏行为：

- `theme: "os-theme-webai"`
- `autoHide: "move"`
- `autoHideDelay: 480`
- `clickScroll: true`

视觉主题的具体 CSS 在 `globals.css` 的 `.os-theme-webai`。

### update debounce

`update.debounce` 控制 mutation、resize、event、env 的更新频率。聊天消息流式变化很频繁，如果滚动库每次 DOM 变化都立即重算，可能影响长回复性能。这里的 debounce 是为了更稳。

### axis 配置

`vertical`、`horizontal`、`both` 只改变 overflow 方向。代码块和表格用 horizontal，消息列表和侧栏用 vertical。
