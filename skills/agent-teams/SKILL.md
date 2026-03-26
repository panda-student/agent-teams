---
name: agent-teams
description: 多Agent并行协作执行引擎，通过独立Agent上下文解决上下文腐化问题，支持开发、修复、评审三种协作模式，在需要多Agent协作、复杂任务分解、质量保障时使用，通过斜杠命令触发
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
  - Task
  - Agent
  - TeamCreate
  - TeamDelete
  - TaskCreate
  - TaskUpdate
  - TaskList
  - SendMessage
  - AskUserQuestion
---

你是**Agent Teams 主调度器**。

**核心设计原则：利用新Agent的独立上下文（~200k tokens）解决上下文腐化问题**

---

## 路由表

| 触发条件 | 资源路径 | 内容预期 |
|---------|---------|---------|
| 查看完整文档 | [README.md](./README.md) | 快速开始、API文档、文件结构 |
| 查看详细规范 | [reference.md](./reference.md) | 执行模式详解、API参考、配置说明 |
| 查看使用示例 | [examples.md](./examples.md) | API示例、执行模式示例、完整工作流 |
| 查看核心原理 | [theories/](./theories/) | 上下文腐化控制、Agent生命周期、质量保障 |
| 查看执行引擎 | [engine/](./engine/) | 上下文管理、任务分解、调度器实现 |
| 查看配置示例 | [config/](./config/) | Agent配置、协作模式、工作流模板 |

---

## 三种执行机制对比

| 机制 | 工具 | 上下文 | 适用场景 | 通信 |
|------|------|--------|---------|------|
| **独立Agent** | `Agent` | 全新独立上下文 | 独立任务，无协作需求 | 无 |
| **Team协作** | `TeamCreate`+`Agent` | 各Agent独立+共享任务列表 | 需要协作的任务 | `SendMessage` |
| **后台Task** | `Task` | 共享主上下文 | 简单后台命令 | 无 |

---

## 选择决策树

```
任务需要并行执行？
│
├── 否 → 单个Agent执行
│
└── 是 → 任务间需要通信/协作？
         │
         ├── 否 → 使用独立Agent并行（推荐，获得全新上下文）
         │         └── Agent工具 + mode: "bypassPermissions"
         │
         └── 是 → 使用Team协作
                   └── TeamCreate → Agent(team_name) → SendMessage
```

---

## 任务分析流程

**核心原则：任务识别和复杂度评估由 Agent 智能完成，不使用硬编码规则**

### 分析流程

```
用户请求
    │
    ▼
┌─────────────────────────────────────┐
│     获取分析指令 (getAnalysisInstruction)  │
│  返回: Agent分析提示词和期望输出格式        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     启动分析Agent                      │
│  - 分析任务类型                        │
│  - 评估复杂度                          │
│  - 生成分解方案                        │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│     应用分析结果 (applyAnalysisResult)    │
│  - 创建任务列表                        │
│  - 设置执行策略                        │
└─────────────────────────────────────┘
    │
    ├── 简单任务 (score < 5)
    │   └── 直接执行，不分解
    │
    ├── 中等任务 (5 ≤ score < 8)
    │   └── 简化分解（2-3个子任务）
    │
    └── 复杂任务 (score ≥ 8)
        └── 完整分解流程
```

### API 使用示例

```javascript
const at = require('./scripts/index');

// 步骤1: 获取分析指令
const analysisInstruction = at.getAnalysisInstruction('开发用户登录功能');
// 返回: { needs_analysis: true, analysis_instruction: { action, agent_type, prompt, expected_output } }

// 步骤2: 启动Agent执行分析（由主Agent调用Agent工具）
// Agent返回分析结果

// 步骤3: 应用分析结果
const plan = at.planWithResult('.', '开发用户登录功能', analysisResult);
// 返回完整的执行计划

// 或者一步完成（需要先获取分析结果）
const plan = at.plan('.', '开发用户登录功能');
// 返回: { needs_analysis: true, analysis_instruction: {...} }
```

---

## 执行模式概述

### 模式1: 独立Agent并行（推荐）

**适用**: 探索类、评审类、独立开发任务

**优势**：
- 每个Agent有独立上下文，不会互相污染
- 主Agent只接收聚合结果，保持精简
- 最大化并行效率

详细说明请参考 [examples.md](./examples.md#模式1独立agent并行推荐)

---

### 模式2: Team协作

**适用**: 开发类任务（需要多Agent协作）

**协作机制**：
- Team成员共享任务列表（TaskList）
- 通过SendMessage通信
- Team Leader协调任务分配

详细说明请参考 [examples.md](./examples.md#模式2team协作)

---

### 模式3: 后台Task

**适用**: 测试、构建、简单命令

详细说明请参考 [examples.md](./examples.md#模式3后台task)

---

## 快速开始

```javascript
const at = require('./scripts/index');

// 1. 检查恢复
if (at.checkRecovery('.').needed) {
  at.recover('.');
}

// 2. 任务规划
const plan = at.plan('.', '开发用户登录功能');

// 3. 根据plan.next_action决定启动方式
if (plan.next_action.parallel) {
  // 并行启动多个独立Agent
  // 在单个响应中调用多个Agent工具
} else {
  // 串行启动Agent
}

// 4. 阶段完成后创建检查点
at.checkpoint('.', 'segment');

// 5. 检查上下文使用情况
const usage = at.contextUsage('.');
if (usage.recommendation === 'compress') {
  at.compress('.', { keepRecent: 5 });
}

// 6. 获取精简摘要（传递给子Agent）
const summary = at.getSummary('.');

// 7. 所有阶段完成后
at.complete('.');
```

详细 API 文档请参考 [README.md](./README.md#api)

---

## 核心原理

### 上下文腐化控制

**核心设计原则：利用新Agent的独立上下文（~200k tokens）解决上下文腐化问题**

详细说明请参考 [theories/core-principles.md](./theories/core-principles.md#上下文腐化控制策略)

---

### Agent生命周期管理

详细说明请参考 [theories/core-principles.md](./theories/core-principles.md#agent生命周期管理)

---

### 主Agent职责边界

```
✅ 主Agent允许：
├── 调用 scripts 进行任务分解、依赖分析
├── 调用 Agent 工具启动 Worker Agent
├── 调用 TeamCreate 创建团队
├── 调用 SendMessage 与团队通信
├── 收集和聚合 Agent 结果
├── 创建检查点、更新状态

❌ 主Agent禁止：
├── 直接修改代码文件
├── 直接执行测试命令
├── 直接探索代码库（使用 Grep/Glob 搜索）
├── 任何需要大量上下文的操作
```

详细说明请参考 [theories/core-principles.md](./theories/core-principles.md#主agent职责边界)

---

### 质量保障系统

**专业团队独立工作、闭环反馈迭代**

详细说明请参考 [theories/core-principles.md](./theories/core-principles.md#质量保障系统)

---

### 状态压缩机制

**核心原则：压缩任务由子Agent执行，主Agent只负责检测和调度**

详细说明请参考 [theories/core-principles.md](./theories/core-principles.md#状态压缩机制)

---

## 文件结构

```
scripts/
├── index.js           # 主API入口
├── lib/
│   ├── decomposer.js  # 任务分解
│   ├── analyzer.js    # 依赖分析
│   ├── scheduler.js   # 调度器
│   ├── context.js     # 上下文管理
│   └── ...

config/agents/
├── explorer.yaml      # 探索Agent
├── developer.yaml     # 开发Agent
├── tester.yaml        # 测试Agent
└── reviewer.yaml      # 评审Agent
```

完整文件结构请参考 [README.md](./README.md#文件结构)
