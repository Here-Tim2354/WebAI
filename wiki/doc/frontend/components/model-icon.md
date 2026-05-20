# `src/features/chat/components/model-icon.tsx`

## 文件定位

`ModelIcon` 是模型图标适配器。它被 `ChatHeader` 的模型下拉菜单使用。

## 核心逻辑

输入是 `Pick<AIModel, "icon" | "label">`。

判断顺序：

1. 如果 `icon` 是 URL 或 `/` 开头路径，用原生 `img` 渲染。
2. 如果 icon key 是 `sparkles` 或 `gemini`，渲染 `SparklesIcon`。
3. 如果 icon key 是 `bot`，渲染 `BotIcon`。
4. 其他情况回退到 `SparklesIcon`。

## 设计缘由

Lucide 没有 Gemini 官方品牌图标，所以注册表里的 `gemini` key 先映射成通用 sparkles。真正的品牌 svg 如果走 `/model-icons/*.svg`，也可以被第一条路径规则接住。

## 返回组件规模

一个 `size-4` 左右的小图标，通常出现在模型按钮和菜单项里。

## 代码展开

### icon 字段的两种语义

`model.icon` 既可以是资源路径，也可以是语义 key。代码先判断它是不是 `http://`、`https://` 或 `/` 开头。满足的话直接当图片地址。

否则才把它当 key 处理，比如 `gemini`、`sparkles`、`bot`。

### 为什么 alt 用 label

图片模式下 alt 是 `${model.label} icon`。因为图片可能是模型或 provider 图标，读屏器至少能知道它属于哪个模型。

Lucide 图标模式下设置 `aria-hidden="true"`，因为旁边通常已经有模型名称，重复读图标没有意义。
