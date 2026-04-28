# ARCHITECTURE.md

## 1. 项目目标

这是一个基于 **Nano Banana API** 的本地无限画布生图工具。

**目标用户**：本地开发者 / 设计师，无需云端，在本地浏览器中完成 AI 生图与微调。

**解决的问题**：提供轻量的 AI 生图 Web 界面，支持模型切换、参数控制、参考图传递、涂鸦局部微调、全程 Token 可视化。

**MVP 边界**：
- 单用户、本地运行、无后端
- 不支持多用户协作、不支持实时同步
- 不引入 Redux / Zustand / Apollo 等重型依赖

---

## 2. 技术栈

| 层级 | 技术选型 | 版本要求 | 选择理由 |
|------|---------|---------|---------|
| 前端框架 | React | 18.x | 生态成熟，文档完整 |
| 构建工具 | Vite | 5.x | 启动快，热更新快 |
| 语言 | TypeScript | 5.x | 类型安全，减少 bug |
| UI 样式 | Tailwind CSS | 3.x | 原子化 CSS，零组件库依赖，包体积小 |
| Canvas 库 | Fabric.js | 6.x | 轻量（~200KB），支持缩放/平移/遮罩/选中 |
| 状态管理 | React Context + useReducer | 内置 | 简单够用，不引入外部状态库 |
| 包管理器 | pnpm | 8.x | 安装快，磁盘占用小 |
| 测试框架 | Vitest + React Testing Library | 最新 | 与 Vite 集成最佳 |
| HTTP 客户端 | 原生 fetch | 内置 | 轻量，无额外依赖 |

**明确排除的技术（worker 不得自行引入）**：
- Redux、Zustand、MobX、Recoil
- Apollo Client、React Query（SWR 可以）
- Ant Design、MUI、Chakra UI 等 UI 组件库
- Express / NestJS 等后端框架

---

## 3. 目录结构

```
nano_canvas/
├── src/
│   ├── components/           # 可复用的 UI 组件
│   │   ├── Canvas/           # Fabric.js 画布组件
│   │   │   ├── InfiniteCanvas.tsx
│   │   │   ├── CanvasToolbar.tsx
│   │   │   └── CanvasNode.tsx
│   │   ├── Controls/         # 控制面板
│   │   │   ├── ModelSelector.tsx
│   │   │   ├── ParamControls.tsx
│   │   │   ├── ImageSizeSelector.tsx
│   │   │   └── TokenDisplay.tsx
│   │   ├── Prompt/           # 提示词区域
│   │   │   ├── PromptInput.tsx
│   │   │   └── RefImageUpload.tsx
│   │   ├── Sketch/           # 涂鸦微调面板
│   │   │   ├── SketchOverlay.tsx
│   │   │   └── SketchPromptInput.tsx
│   │   └── common/           # 通用组件
│   │       ├── Button.tsx
│   │       ├── Select.tsx
│   │       ├── Slider.tsx
│   │       └── Spinner.tsx
│   ├── pages/
│   │   └── MainPage.tsx      # 唯一页面，所有功能集成在此
│   ├── contexts/
│   │   ├── CanvasContext.tsx    # 画布节点状态（图片列表、选中节点）
│   │   ├── ConfigContext.tsx    # 模型选择、参数配置状态
│   │   └── TokenContext.tsx    # Token 消耗统计
│   ├── hooks/
│   │   ├── useFabricCanvas.ts   # Fabric.js 初始化和工具封装
│   │   ├── useImageGeneration.ts # API 调用逻辑
│   │   └── useTokenTracker.ts   # Token 解析和累计
│   ├── services/
│   │   └── nanoBananaApi.ts    # Nano Banana API 调用封装
│   ├── types/
│   │   ├── models.ts           # 核心数据模型（接口定义）
│   │   └── api.ts              # API 请求/响应类型
│   ├── utils/
│   │   ├── imageUtils.ts       # base64 转换、图片下载
│   │   └── tokenUtils.ts       # Token 解析格式化
│   ├── App.tsx
│   └── main.tsx
├── tests/                    # 测试文件（与 src 同名结构）
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

**命名规则**：
- 文件名：`kebab-case.tsx`
- 组件名：`PascalCase.tsx`
- 函数/变量：`camelCase`
- 常量：`SCREAMING_SNAKE_CASE`
- CSS 类：`kebab-case`（Tailwind 默认）

---

## 4. 数据模型

### 4.1 画布节点（CanvasNode）

```typescript
interface CanvasNode {
  id: string;           // UUID，唯一标识
  imageData: string;    // base64 编码的图片数据
  position: { x: number; y: number };   // 在画布上的位置
  scale: number;        // 缩放比例，默认 1.0
  rotation: number;     // 旋转角度，默认 0
  createdAt: Date;      // 创建时间
  prompt: string;       // 生成时使用的 prompt
  model: string;        // 使用的模型名称
  tokenUsed: number;    // 本次消耗的 Token 数量
}
```

### 4.2 生成配置（GenerationConfig）

```typescript
interface GenerationConfig {
  model: 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro';
  prompt: string;
  negativePrompt?: string;
  steps?: number;       // 推理步数
  cfgScale?: number;    // CFG 强度
  width?: number;       // 输出宽度
  height?: number;      // 输出高度
  seed?: number;        // 随机种子
  refImage?: string;    // 参考图 base64（可选）
  refImageStrength?: number; // 参考图影响强度
}
```

### 4.3 Token 统计（TokenUsage）

```typescript
interface TokenUsage {
  current: number;      // 最近一次 API 调用的 Token 消耗
  total: number;        // 本次会话累计消耗
}
```

### 4.4 涂鸦微调请求（InpaintRequest）

```typescript
interface InpaintRequest {
  originalImageData: string;  // 原图 base64
  maskData: string;           // 涂鸦遮罩 base64（白色=重绘区域）
  prompt: string;             // 微调描述文字
  model: GenerationConfig['model'];
  width: number;
  height: number;
  // 其他参数同 GenerationConfig
}
```

---

## 5. API 规范

### 5.1 生成图片

**请求**
```
POST https://api.nanobanana.example/v1/generate
Content-Type: application/json
Authorization: Bearer <API_KEY>
```

**请求体**
```json
{
  "model": "nano-banana-2",
  "prompt": "a cute cat",
  "negative_prompt": "blurry, low quality",
  "steps": 25,
  "cfg_scale": 7.0,
  "width": 1024,
  "height": 1024,
  "seed": 12345,
  "ref_image": "data:image/png;base64,...",
  "ref_image_strength": 0.7
}
```

**成功响应**
```json
{
  "image": "data:image/png;base64,...",
  "seed": 12345,
  "token_used": 850,
  "processing_time_ms": 3200
}
```

**错误响应**
```json
{
  "error": {
    "code": "INVALID_MODEL",
    "message": "Model not found"
  }
}
```

### 5.2 涂鸦微调（局部重绘）

**请求**
```
POST https://api.nanobanana.example/v1/inpaint
Content-Type: application/json
Authorization: Bearer <API_KEY>
```

**请求体**
```json
{
  "model": "nano-banana-2",
  "original_image": "data:image/png;base64,...",
  "mask": "data:image/png;base64,...",
  "prompt": "change cat color to blue",
  "width": 1024,
  "height": 1024
}
```

**成功响应**（同生成图片）

### 5.3 错误码规范

| code | 含义 |
|------|------|
| `INVALID_MODEL` | 模型名称无效 |
| `INVALID_PARAMS` | 参数格式错误或越界 |
| `RATE_LIMITED` | 请求频率超限 |
| `INVALID_API_KEY` | API Key 无效 |
| `IMAGE_TOO_LARGE` | 参考图超过大小限制 |
| `INTERNAL_ERROR` | 服务端内部错误 |

---

## 6. 组件职责边界

### 6.1 InfiniteCanvas

- **职责**：初始化 Fabric.js 实例，处理画布缩放/平移事件
- **对外暴露**：节点列表、选中节点 ID
- **不负责**：节点数据更新（由 Context 提供）

### 6.2 CanvasNode

- **职责**：渲染单个图片节点，处理选中/拖拽事件
- **内部**：使用 Fabric.js Image 对象

### 6.3 ModelSelector

- **职责**：三个选项切换（nano-banana / nano-banana-2 / nano-banana-pro）
- **样式**：横向单选按钮组

### 6.4 ParamControls

- **职责**：渲染可配置的滑块和输入框（steps / cfg_scale / seed 等）
- **数据来源**：ConfigContext
- **不负责**：API 调用

### 6.5 ImageSizeSelector

- **职责**：预设尺寸快捷选择 + 自定义宽高输入
- **预设选项**：512x512、768x768、1024x1024、1024x768、768x1024

### 6.6 RefImageUpload

- **职责**：上传参考图，预览显示，支持移除
- **限制**：仅支持 PNG/JPG，单张，最大 10MB

### 6.7 PromptInput

- **职责**：主 prompt 文本输入，支持 Ctrl+Enter 快捷提交
- **占位符**：`"描述你想生成的画面..."`

### 6.8 SketchOverlay

- **职责**：在选中图片上方叠加透明画布，接收用户涂鸦
- **工具**：画笔（可调粗细、颜色固定白色用于遮罩）
- **完成后**：生成 mask base64，触发微调弹窗

### 6.9 SketchPromptInput

- **职责**：涂鸦后的微调描述输入
- **位于**：SketchOverlay 完成后弹出的 Modal

### 6.10 TokenDisplay

- **职责**：显示本次 Token 消耗 + 会话累计 Token
- **位置**：界面底部或侧边栏固定显示

---

## 7. 工作流

### 7.1 生成图片流程

```
用户输入 Prompt
  → 选择模型、尺寸、参数（可选）
  → 点击"生成"
  → 显示加载状态
  → 调用 nanoBananaApi.generate()
  → 成功后：创建 CanvasNode，添加到 CanvasContext
  → TokenDisplay 更新
  → 失败时：显示错误 Toast
```

### 7.2 涂鸦微调流程

```
用户选中已有 CanvasNode
  → 点击"微调"按钮
  → SketchOverlay 在选中图片上方显示
  → 用户涂抹需要重绘的区域
  → 点击"完成涂鸦"
  → SketchPromptInput Modal 弹出
  → 用户输入微调描述
  → 点击"发送"
  → 调用 nanoBananaApi.inpaint()
  → 成功后：替换原 CanvasNode 的图片数据
  → 失败时：显示错误 Toast
```

### 7.3 画布操作

- **缩放**：鼠标滚轮（Fabric.js 内置）
- **平移**：空格键 + 拖拽 或 鼠标中键拖拽
- **选中节点**：单击节点
- **删除节点**：选中后按 Delete 键 或 点击工具栏删除按钮
- **下载节点图片**：选中节点后点击下载按钮

---

## 8. Contexts 设计

### 8.1 CanvasContext

```typescript
interface CanvasContextValue {
  nodes: CanvasNode[];
  selectedNodeId: string | null;
  addNode: (node: CanvasNode) => void;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
}
```

### 8.2 ConfigContext

```typescript
interface ConfigContextValue {
  config: GenerationConfig;
  updateConfig: (updates: Partial<GenerationConfig>) => void;
  resetConfig: () => void;
}
```

### 8.3 TokenContext

```typescript
interface TokenContextValue {
  usage: TokenUsage;
  recordUsage: (tokens: number) => void;
  resetTotal: () => void;
}
```

---

## 9. 明确排除的功能

以下功能不在 MVP 范围内，worker 不得自行实现：

- ~~多用户实时协作~~
- ~~图片云端存储~~
- ~~用户登录/鉴权系统~~
- ~~历史记录/撤销重做~~
- ~~节点分组~~
- ~~画布批量导出~~
- ~~Node.js 后端服务~~

---

## 10. Git 规范

- 分支命名：`feat/xxx` / `fix/xxx` / `task/T-xxx`
- Commit 格式：Conventional Commits
  - `feat: add model selector component`
  - `fix: resolve token display not updating`
  - `task/T-003: implement sketch overlay`
