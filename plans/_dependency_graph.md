# 依赖图

本文档展示所有 Task Card 之间的依赖关系，供并行执行规划使用。

## 依赖图（Mermaid 格式）

```
graph TD
    T-001 --> T-002
    T-001 --> T-007

    T-002 --> T-003
    T-002 --> T-004
    T-002 --> T-005
    T-002 --> T-006

    T-005 --> T-010
    T-005 --> T-011

    T-007 --> T-008
    T-007 --> T-012

    T-008 --> T-009
    T-009 --> T-011

    T-010 --> T-013
    T-011 --> T-013
    T-012 --> T-013

    T-003 --> T-009
    T-004 --> T-009
    T-006 --> T-013
```

## 依赖详解

| Task | 依赖项 | 说明 |
|------|--------|------|
| T-001 | 无 | 项目初始化，起点 |
| T-002 | T-001 | 需先有项目结构和 package.json |
| T-003 | T-002 | 需先有 types 定义 |
| T-004 | T-002 | 需先有 types 定义 |
| T-005 | T-002 | 需先有 CanvasNode 类型定义 |
| T-006 | T-002 | 需先有 GenerationConfig、TokenUsage 类型定义 |
| T-007 | T-001 | 需先有 Tailwind 配置 |
| T-008 | T-007 | 需先有通用组件（Button、Select、Slider） |
| T-009 | T-007, T-008 | 需先有通用组件和控制面板（获取配置状态） |
| T-010 | T-005, T-007 | 需先有 CanvasContext 和通用组件 |
| T-011 | T-005, T-007, T-009 | 需先有 CanvasContext、通用组件、PromptInput（参考 API 调用模式） |
| T-012 | T-007 | 需先有通用组件 |
| T-013 | T-005, T-006, T-008, T-009, T-010, T-011, T-012 | 需先有所有上下文和所有组件 |

## 并行执行分组

### 第 1 批（无依赖，可并行）
- T-001（项目初始化）

### 第 2 批（T-001 完成后）
- T-002（类型定义）
- T-007（通用组件）

### 第 3 批（T-002 + T-007 完成后）
- T-003（API 服务层）
- T-004（工具函数）
- T-005（CanvasContext）
- T-006（ConfigContext + TokenContext）
- T-008（控制面板组件）
- T-012（API Key 配置组件）

### 第 4 批（第 3 批相关任务完成后）
- T-009（PromptInput 组件）— 依赖 T-007, T-008
- T-010（无限画布组件）— 依赖 T-005, T-007
- T-011（涂鸦微调组件）— 依赖 T-005, T-007, T-009

### 第 5 批（第 4 批完成后）
- T-013（主页面集成）— 依赖 T-005, T-006, T-008, T-009, T-010, T-011, T-012

## Epic 分组

| Epic | 任务 |
|------|------|
| E-1（基础设施） | T-001, T-002 |
| E-2（核心业务逻辑） | T-003, T-004, T-005, T-006 |
| E-3（UI 组件） | T-007, T-008, T-009, T-010, T-011, T-012, T-013 |

## 文件 touched 统计

| 文件 | 被哪些 Task 修改 |
|------|-----------------|
| package.json | T-001 |
| vite.config.ts | T-001 |
| tsconfig.json | T-001 |
| tailwind.config.js | T-001 |
| postcss.config.js | T-001 |
| index.html | T-001 |
| src/main.tsx | T-001 |
| src/App.tsx | T-001, T-013 |
| src/types/models.ts | T-002 |
| src/types/api.ts | T-002 |
| src/services/nanoBananaApi.ts | T-003 |
| src/utils/imageUtils.ts | T-004 |
| src/utils/tokenUtils.ts | T-004 |
| src/utils/index.ts | T-004 |
| src/contexts/CanvasContext.tsx | T-005 |
| src/contexts/ConfigContext.tsx | T-006 |
| src/contexts/TokenContext.tsx | T-006 |
| src/contexts/index.ts | T-006 |
| src/components/common/Button.tsx | T-007 |
| src/components/common/Select.tsx | T-007 |
| src/components/common/Slider.tsx | T-007 |
| src/components/common/Spinner.tsx | T-007 |
| src/components/common/index.ts | T-007 |
| src/components/Controls/ModelSelector.tsx | T-008 |
| src/components/Controls/ParamControls.tsx | T-008 |
| src/components/Controls/ImageSizeSelector.tsx | T-008 |
| src/components/Controls/TokenDisplay.tsx | T-008 |
| src/components/Controls/index.ts | T-008 |
| src/components/Prompt/PromptInput.tsx | T-009 |
| src/components/Prompt/RefImageUpload.tsx | T-009 |
| src/components/Prompt/index.ts | T-009 |
| src/components/Canvas/InfiniteCanvas.tsx | T-010 |
| src/components/Canvas/CanvasNode.tsx | T-010 |
| src/components/Canvas/CanvasToolbar.tsx | T-010 |
| src/components/Canvas/index.ts | T-010 |
| src/components/Sketch/SketchOverlay.tsx | T-011 |
| src/components/Sketch/SketchPromptInput.tsx | T-011 |
| src/components/Sketch/index.ts | T-011 |
| src/components/Settings/ApiKeyConfig.tsx | T-012 |
| src/components/Settings/index.ts | T-012 |
| src/pages/MainPage.tsx | T-013 |
