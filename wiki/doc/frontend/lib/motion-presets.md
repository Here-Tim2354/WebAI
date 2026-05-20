# `src/features/chat/lib/motion-presets.ts`

## 文件定位

这个文件集中保存 Motion 动画参数。`ChatInput`、`MessageBubble`、`MessageList`、`WorkspaceNotice`、`message-attachments` 都会用到。

## 导出内容

- `smoothEase`：通用缓动曲线。
- `softSpring`：消息气泡、提示等偏柔和的弹簧。
- `panelSpring`：面板展开收起时更紧一点的弹簧。
- `microTween`：短小状态变化。

## 设计缘由

动画参数分散在各个组件里会让界面节奏不一致。这里集中保存后，输入区、消息、弹窗的运动感更接近同一套系统。

## 返回规模

没有 UI，只是常量。

## 代码展开

### 几组参数怎么选

`softSpring` 用在消息气泡和顶部提示，弹性更柔一点。`panelSpring` 用在输入区 URL 面板这类展开收起，刚性更高，避免面板拖泥带水。

`smoothEase` 是三次贝塞尔数组，常用于短过渡，比如按钮、渐隐、内容 reveal。`microTween` 则是把短动画写成统一对象，适合之后扩展到更多小交互。

### reduced motion

这些 preset 本身不判断 reduced motion。具体组件会通过 `useReducedMotion` 或全局 CSS 禁用动画。因此 preset 只负责默认运动风格。
