# Task Card 规范

本文档定义下发给小模型 worker 执行的 Task Card 的结构、切分规则和质量标准。

Task Card 是小模型 worker 的**唯一执行依据**。Worker 不看其他文档，不问问题，只按 Task Card 执行。因此 Task Card 的质量直接决定 worker 的成功率。

---

## 面向对象

Task Card 的读者是**小参数模型**（Haiku 级别或更小）。它们的特点：

- 执行能力够用，但**不会做设计决策**
- 遇到模糊点会**自己脑补**，通常脑补错
- 不会主动问问题，硬着头皮做完交付错的结果
- 不理解全局，只看单个 Task Card
- 容易"顺手"多做事情，改到不该改的地方

写 Task Card 时，要假设 worker 是一个"只会严格照做、不懂上下文、也不会判断"的执行者。

---

## Task Card 标准格式

每个 Task Card 是独立的 Markdown 文件，路径：`plans/T-xxx.md`。

```markdown
---
task_id: T-xxx
epic: E-x
title: 简短标题（不超过 10 个字）
depends_on: [T-xxx, T-xxx]
estimated_minutes: 30-120
files_touched:
  - path/to/file.ext
files_read_only:
  - path/to/ref.ext
forbidden_paths:
  - config/**
acceptance:
  - 可机器验证的条目
  - 可机器验证的条目
---

## Context
## Prerequisites
## Steps
## Acceptance
## Out of Scope
## Examples
```

### Frontmatter 字段说明

**task_id**：全局唯一，格式 `T-001`、`T-002`……数字三位，便于排序。

**epic**：所属 Epic 编号，对应 `ARCHITECTURE.md` 第 10 节的 Epic 划分。

**title**：简短标题，动词开头最好（"新增 X"、"修改 Y"、"重构 Z"）。

**depends_on**：必须已完成的前置任务 ID 列表。为空则表示无依赖。

**estimated_minutes**：预估时长，**15 分钟下限，240 分钟上限**。超过必须切。

**files_touched**：白名单。Worker **只能修改**这里列出的文件。Reviewer 会用 `git diff --name-only` 核对，修改了白名单外的文件算任务失败。

**files_read_only**：Worker 执行时需要参考但不能修改的文件。

**forbidden_paths**：强调禁止触碰的路径，支持 glob。即使 Worker "觉得需要改" 也不能改。

**acceptance**：验收标准列表，每一条**必须能用命令或检查自动验证**。禁止出现主观描述。

### 正文章节说明

#### Context（背景）

一段话，说清楚：
- 这个任务在整个项目里的位置（属于哪个 Epic，前后关系）
- 为什么要做（解决什么问题 / 为后续哪些任务铺路）
- 完成后会对什么产生影响

目的是让 worker 理解任务的"意义"，遇到多种合理做法时能选对。

#### Prerequisites（前置知识）

Worker 在开始写代码前**必须读**的内容：

- `ARCHITECTURE.md` 的第 X 节、第 Y 节（具体指名）
- 前置任务 T-xxx 的产出文件
- 外部文档链接（如果有）

不要让 worker "通读全项目"——具体到章节。

#### Steps（步骤）

**原子化的步骤**，一步一个动作。规则：

- 每一步指明**动哪个文件的哪个部分**
- 如果有多种实现方式，**明确指定一种**，不给 worker 选择权
- 每一步结束后 worker 应能独立验证（运行了 X，看到 Y）
- 步骤数量建议 3-8 步，过多说明任务太大，过少说明描述不够细

示例：

```markdown
1. 在 `src/components/ProductCard.tsx` 的 props interface 中新增字段：
   `badgeStyle?: 'none' | 'sale' | 'new'`，默认值 `'none'`
2. 在组件渲染函数顶部添加 badge 渲染逻辑：
   - 当 badgeStyle === 'sale'，渲染 `<span className="badge-sale">SALE</span>`
   - 当 badgeStyle === 'new'，渲染 `<span className="badge-new">NEW</span>`
   - 当 badgeStyle === 'none'，不渲染任何 badge
3. 在 `src/styles/product-card.css` 追加两个类的样式（颜色参考 ARCHITECTURE.md 第 7 节）
4. 在 `tests/ProductCard.test.tsx` 追加三个测试用例，对应三种 badgeStyle
5. 运行 `npm test -- ProductCard`，确认通过
```

#### Acceptance（验收标准）

展开 frontmatter 里的 acceptance 清单，每一条说明**怎么验证**：

```markdown
- [ ] ProductCard 支持 badgeStyle prop
  验证：`grep -q "badgeStyle" src/components/ProductCard.tsx`
- [ ] 三种 badge 样式都有测试覆盖
  验证：`npm test -- ProductCard` 输出包含 3 个新增用例且全部通过
- [ ] 不破坏现有调用方
  验证：`npm test` 全部通过
- [ ] 代码风格通过
  验证：`npm run lint` 无错误
```

#### Out of Scope（不做什么）

明确列出本任务**不**包含的内容。这是防止 worker "顺手多做"的关键。

```markdown
- 不重构 ProductCard 其他 props
- 不修改现有 CSS 类的样式
- 不添加 badge 的点击事件（留给 T-xxx）
- 不优化组件性能
- 不引入新的 npm 依赖
```

#### Examples（样例）

给出具体的输入输出样例。对数据处理、API、UI 类任务尤其重要。

```markdown
### 使用示例
<ProductCard title="..." badgeStyle="sale" />

### 预期渲染结果
<div class="product-card">
  <span class="badge-sale">SALE</span>
  ...
</div>

### 边界情况
- badgeStyle 未传入 → 不渲染 badge
- badgeStyle="invalid" → TypeScript 编译报错（不需要运行时处理）
```

---

## 切分规则：三项自检

每个 Task Card 生成后，必须通过以下三项检查。任何一项不过关，都要回到规划阶段重切。

### 自检 1：时钟测试

预估一个 worker 完成这个任务需要多久？

- **< 15 分钟**：太小。合并几个相关的小任务。
- **15 分钟 - 2 小时**：甜蜜区 ✓
- **2 - 4 小时**：偏大但可接受，注意 Steps 是否足够原子。
- **> 4 小时**：必须切分。

### 自检 2：Diff 测试

预估这个任务会产生多少行 diff？

- **目标**：< 200 行
- **上限**：500 行
- **超过 500 行**：必须切分

超大 diff 会导致：
- reviewer 审查质量下降（不管人还是 AI）
- 冲突概率指数级上升
- 返工时范围失控

### 自检 3：设计决策测试

列出 worker 执行这个任务时**所有可能需要做决策的地方**。每一个决策必须在 Task Card 里已经给出答案。

常见需要在 Task Card 里定死的决策：
- 新函数 / 变量 / 文件的**命名**
- 新组件的**文件位置**
- 错误处理策略（抛异常 / 返回 null / 返回 Result 类型）
- 日志级别和格式
- 边界条件的行为（空输入、超长输入、无效输入）
- 异步处理方式（Promise / async-await / callback）

如果发现有任何决策需要 worker 自己判断——**不行**，回去补充 Plan。

---

## 依赖图与并发建议

Task Card 生成完后，必须附带一份依赖图文档：`plans/_dependency_graph.md`。

### 依赖图格式

```markdown
# 任务依赖图

## 依赖关系
T-001 (setup)
  ├─ T-002 (data model)
  │    ├─ T-003 (API: GET users)
  │    └─ T-004 (API: POST user)
  └─ T-005 (UI: layout)
       ├─ T-006 (UI: user list)
       └─ T-007 (UI: user form)

## 执行批次（并发建议）

### 批次 1（串行）
- T-001

### 批次 2（可并发 2 路）
- T-002
- T-005

### 批次 3（可并发 4 路）
- T-003
- T-004
- T-006
- T-007
```

### 公共文件协调区

扫描所有 Task Card 的 `files_touched`，找出被多个任务写入的文件，单独列出：

```markdown
## 公共文件协调区

以下文件会被多个任务修改，存在并发冲突风险：

| 文件 | 涉及任务 | 建议策略 |
|---|---|---|
| package.json | T-001, T-003, T-006 | 串行执行 |
| src/routes.ts | T-003, T-004 | 串行执行 |
| src/types/index.ts | T-002, T-006 | 串行执行 |

### 协调策略
- **方案 A（推荐）**：涉及公共文件的任务之间不并发，按依赖顺序串行
- **方案 B**：设一个 integration 任务在最后统一合并，并发任务只改自己的独立文件
```

---

## 禁止事项清单

写 Task Card 时，以下行为必须避免：

1. **模糊表达**：禁用"适当的"、"合理的"、"良好的"、"必要时"、"尽量"、"最好"。
2. **打包任务**：一个 Task 只做一件事。"顺便再做 X" → 拆成独立 Task。
3. **主观验收**：acceptance 不能出现"代码质量好"、"界面美观"、"性能可接受"这类描述。
4. **遗漏 Out of Scope**：每个 Task Card 必须有 Out of Scope 章节，即使只有一两条。
5. **跨 Epic**：一个 Task 的 files_touched 不应跨越多个 Epic 的目录。
6. **缺失 Prerequisites**：假设 worker "应该知道" 是常见失败模式。需要什么前置知识，明说。
7. **循环依赖**：检查 depends_on 不要形成环。

---

## 最终产出清单

规划完成后，目录结构应是：

```
ARCHITECTURE.md                   # 架构蓝图
plans/
├── _dependency_graph.md          # 依赖图与并发建议
├── T-001-xxx.md
├── T-002-xxx.md
├── T-003-xxx.md
└── ...
```

每一个 T-xxx.md 都是独立可分发的执行单元。
