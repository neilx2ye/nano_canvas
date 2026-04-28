# ITERATION_v2.md

## 迭代目标

扩展 nano_canvas 的模型差异化支持、图片管理（标注、串联、版本）、以及 Mask 抠图功能。

## 变更边界

### 涉及的功能模块

- **模型选择器** (ModelSelector)：动态展示模型专属参数，禁用不适用的参数
- **参数控件** (ParamControls)：根据模型自动启用/禁用参数组合
- **API 服务层** (nanoBananaApi)：支持 thinking 模式输出、Mask 抠图模式
- **Canvas 画布** (InfiniteCanvas)：图片节点交互（标注、连线、版本）
- **Prompt 构建** (PromptInput)：支持多图串联构建 prompt
- **Sketch 微调** (SketchOverlay)：支持 Mask 抠图模式

### 新增文件

- `src/components/Canvas/ImageNodeMenu.tsx` - 图片节点右键/点击菜单
- `src/components/Canvas/ImageAnnotationModal.tsx` - 图片标注弹窗
- `src/components/Canvas/CanvasConnection.tsx` - 连接线组件
- `src/components/Controls/ThinkingConfig.tsx` - thinking level 控件（仅 nano-banana-pro/nano-banana-2）

### 修改文件

**类型定义 (严格贴合现有目录)**
- `src/types/models.ts` - 扩展 CanvasNode
- `src/types/api.ts` - 扩展请求/响应类型

**Context (接口向后兼容)**
- `src/contexts/CanvasContext.tsx` - 扩展状态管理

**Service (向后兼容)**
- `src/services/nanoBananaApi.ts` - 扩展 API 方法

**组件 (严格贴合现有目录)**
- `src/components/Controls/ModelSelector.tsx`
- `src/components/Controls/ParamControls.tsx`
- `src/components/Controls/ImageSizeSelector.tsx`
- `src/components/Canvas/InfiniteCanvas.tsx`
- `src/components/Canvas/CanvasToolbar.tsx`
- `src/components/Canvas/index.ts`
- `src/components/Prompt/PromptInput.tsx`
- `src/components/Sketch/SketchOverlay.tsx`
- `src/components/Sketch/SketchPromptInput.tsx`

## 兼容性要求

### API 层兼容

- 现有 `generateImage()` 接口保持不变
- 新增 `generateImageWithThinking()` 方法，返回 `{ image, thinkingSteps }`
- 新增 `maskImage()` 方法，用于 Mask 抠图
- `nanoBananaApi.ts` 的 ModelMap 已是正确的

### Context 接口兼容

- `CanvasContextValue` 扩展时保留现有方法签名
- `useCanvasContext()` 的返回值必须保持向后兼容
- 不删除现有的 `nodes`、`selectedNodeId`、`addNode`、`updateNode`、`removeNode`、`selectNode`

### 数据模型兼容

- `CanvasNode` 必须保留现有字段（id, imageData, position, scale, rotation, createdAt, prompt, model, tokenUsed）
- 新增字段：`annotation?: string`、`versions?: CanvasNodeVersion[]`、`connectedFrom?: string`、`connectedTo?: string[]`、`isDefaultVisible?: boolean`

## 不允许改动的范围

### 禁止触碰的文件/目录

- `src/contexts/TokenContext.tsx`
- `src/components/common/*`
- `src/utils/tokenUtils.ts`
- `src/pages/MainPage.tsx`

### 禁止修改的接口

- `ConfigContextValue` 的 `config` 和 `updateConfig` 签名
- `TokenContextValue` 的所有方法
- `services/nanoBananaApi.ts` 中现有的函数签名

### 禁止破坏的现有功能

- API Key 配置流程
- Token 统计显示
- 画布缩放/平移交互
- 单图生成流程

## 模型参数差异矩阵

| 参数 | nano-banana | nano-banana-pro | nano-banana-2 |
|------|------------|-----------------|---------------|
| aspectRatio | 10种 | 10种 | 14种 |
| imageSize | - | 1K/2K/4K | 512/1K/2K/4K |
| thinking_level | - | 强制开启 | minimal/low/medium/high |
| Mask 抠图 | 支持 | 不支持 | 不支持 |
| 参考图上限 | ~5张 | 14张 | 14张 |

### 参数联动规则

1. 切换模型时，UI 展示全部参数但禁用不适用的
2. 选择 Mask 抠图时，自动禁用 thinking_mode
3. nano-banana-pro 始终启用 thinking_mode
4. PromptInput 串联图片时，仅传 `isDefaultVisible=true` 的图片

## 串联图片 Prompt 规范

```
Image 1: [annotation]
Image 2: [annotation]
...
[用户 prompt]
```

annotation 为空时使用 "Image N" 占位。

## 版本管理交互规范

- 新图生成时，原图保留为版本，新图设为 `isDefaultVisible=true`
- 版本数量无上限
- 点击图片弹出 ImageNodeMenu，可选择查看版本或重新生成
- 串联时仅传 `isDefaultVisible=true` 的图片

## Mask 抠图交互规范

1. 用户选中图片 → 画布工具栏出现 "Mask 模式" 按钮（仅 nano-banana 显示）
2. 点击进入 SketchOverlay 画笔模式
3. 用户绘制蒙版后点击 "应用抠图"
4. 调用 `maskImage()` → 返回结果 → 更新图片，保留历史版本

## 思考流程展示规范

- API 返回 thinking 步骤时，在 PromptInput 下方或侧边栏展示
- 展示为可折叠的展开列表，格式：`[Step N] ...text...`
- 加载完成后可收起，不阻塞主流程
