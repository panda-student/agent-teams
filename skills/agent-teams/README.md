# Agent Teams

多Agent并行协作执行引擎，通过独立上下文解决上下文腐化问题，支持专业团队协作的质量保障系统。

## 核心设计

**主Agent只调度，专业团队执行**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  主Agent (调度器)                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 职责: 任务分解、依赖分析、调度、聚合结果                  │   │
│  │ 上下文: 保持精简 (< 25%)                                 │   │
│  │ 禁止: 直接修改代码、执行测试、探索代码库                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│              启动专业团队（获得独立200k上下文）                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 开发团队       │ 测试团队       │ 评审团队              │   │
│  │ 独立上下文     │ 独立上下文     │ 独立上下文            │   │
│  │ 执行具体任务   │ 执行具体任务   │ 执行具体任务          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 质量保障系统

**专业团队独立工作、闭环反馈迭代**

```
┌──────────┐
│ 开发团队  │ ←─────────────────────────────┐
└────┬─────┘                               │
     │                                     │
     ▼                                     │
┌──────────┐     不通过                     │
│ 评审团队  │ ──────────────────────────────┤
└────┬─────┘                               │
     │ 通过                                │
     ▼                                     │
┌──────────┐     不通过                     │
│ 测试团队  │ ──────────────────────────────┘
└────┬─────┘
     │ 通过
     ▼
┌──────────┐
│ 验收通过  │
└──────────┘
```

### 团队角色

| 团队 | 职责 | 产出 | 权限 |
|------|------|------|------|
| 开发团队 | 代码实现、Bug修复 | 代码、修复报告 | 修改代码 |
| 测试团队 | 功能验证、回归测试 | 测试报告 | 通过/否决 |
| 评审团队 | 代码质量、规范检查 | 评审报告 | 通过/否决 |
| 安全团队 | 安全审计、漏洞扫描 | 安全报告 | 通过/否决 |
| 性能团队 | 性能测试、优化建议 | 性能报告 | 通过/否决 |
| 主Agent | 调度、汇总、报告整合 | 汇总报告 | 流程控制 |

### 死循环防护

| 防护层 | 配置 |
|--------|------|
| 测试-开发循环 | 最多3次 |
| 评审-开发循环 | 最多2次 |
| 安全-开发循环 | 最多2次 |
| 总流转次数 | 最多10次 |
| 超时限制 | 2小时 |

## 快速开始

```javascript
const at = require('./scripts/index');

// 完整流程：分解 → 分析 → 调度
const plan = at.plan('.', '开发用户登录功能');

// 输出
// {
//   mission_id: 'mission-xxx',
//   task_type: 'develop',
//   decomposition: { total_tasks: 8, tasks: [...] },
//   analysis: { parallel_groups: [...], conflicts: [] },
//   schedule: { total_phases: 5, ... },
//   next_action: { action: 'launch_agents', agents: [...] },
//   persisted: true,
//   plan_file: '.claude/context/plans/执行计划-2026-03-26.md'
// }
```

### 质量保障流程

```javascript
const { QualityAssuranceSystem } = require('./scripts/lib/quality-system');

const qas = new QualityAssuranceSystem('./project');

// 注册专业团队
qas.createTeam('developer');
qas.createTeam('tester');
qas.createTeam('reviewer');
qas.createTeam('security');
qas.createTeam('performance');

// 运行质量保障流程
const result = await qas.run({
  task: { name: '开发用户登录功能' },
  entryTeam: 'developer',
  requiredTeams: ['tester', 'reviewer', 'security', 'performance']
});

// 输出
// {
//   finalStatus: 'completed',
//   summary: { path: '.claude/context/reports/汇总报告-2026-03-26.md' },
//   transitionHistory: [...],
//   duration: 1234
// }
```

## API

### 任务分解与调度

```javascript
// 任务分解
at.decompose(request)           // 返回任务列表

// 依赖分析
at.analyzeDependencies(tasks)   // 返回并行组

// 调度计划
at.schedule(plan, baseDir)      // 返回执行计划

// 完整流程
at.plan(baseDir, request)       // 一站式API
```

### 状态管理

```javascript
// 初始化
at.init(baseDir, goal)          // 初始化上下文

// 检查点
at.checkpoint(baseDir, type)    // 创建检查点 (micro/segment/phase/quality)

// 完成
at.complete(baseDir)            // 完成任务

// 状态查询
at.status(baseDir)              // 获取当前状态
```

### 上下文管理

```javascript
// 上下文使用情况
at.contextUsage(baseDir)        // 获取使用情况

// 压缩状态
at.compress(baseDir, options)   // 压缩状态

// 获取摘要
at.getSummary(baseDir)          // 获取精简摘要

// 检查是否需要压缩
at.needsCompression(baseDir)    // 返回是否需要压缩
```

### 团队管理

```javascript
// 注册Worker
at.registerWorker(baseDir, {
  name: 'developer-agent-1',
  type: 'developer',
  role: 'frontend'
})

// 更新心跳
at.updateWorkerHeartbeat(baseDir, workerId)

// 分配任务
at.assignTaskToWorker(baseDir, workerId, taskId)
```

### 任务进度

```javascript
// 更新任务进度
at.updateTaskProgress(baseDir, taskId, {
  status: 'completed',
  progress: 100,
  result: { summary: '任务完成' }
})

// 启动阶段
at.startPhase(baseDir, phaseId, tasks)

// 完成阶段
at.completePhase(baseDir, phaseId)
```

### 报告生成

```javascript
// 测试报告
at.generateTestReport(baseDir, {
  total: 25,
  passed: 23,
  failed: 2,
  coverage: { statements: 85, branches: 72 }
})

// 评审报告
at.generateReviewReport(baseDir, {
  type: '代码评审',
  results: [...],
  issues: [...],
  suggestions: [...]
})

// 汇总报告
at.generateSummaryReport(baseDir)

// 最终报告
at.generateFinalReport(baseDir)
```

### 验收确认

```javascript
// 请求验收
const acceptance = at.requestAcceptance(baseDir);
// {
//   needs_acceptance: true,
//   summary_report: '.claude/context/reports/汇总报告-xxx.md',
//   options: [
//     { key: 'accept', label: '验收通过' },
//     { key: 'reject', label: '验收不通过' }
//   ]
// }

// 确认验收
at.confirmAcceptance(baseDir, true)   // 通过，清理中间文件
at.confirmAcceptance(baseDir, false)  // 不通过，保留所有文件

// 清理中间文件
at.cleanupIntermediate(baseDir, {
  keepCheckpoints: false,
  keepWAL: false,
  keepWorkers: false
})
```

## 任务类型

| 类型 | 关键词 | Agent | 并行度 |
|------|--------|-------|--------|
| 探索 | 探索、分析、了解 | explorer | 8 |
| 开发 | 开发、实现、新增 | developer | 3 |
| 修复 | bug、修复、问题 | developer | 3 |
| 评审 | 评审、检查、审查 | reviewer | 4 |
| 部署 | 部署、发布、CI/CD | developer | 2 |
| 测试 | 测试、验证 | tester | 4 |

## 文件结构

```
.claude/context/
├── core/
│   ├── mission.md           # 任务描述
│   ├── constraints.md       # 约束条件
│   ├── decisions.md         # 决策记录
│   └── RECOVERY_TRIGGER.md  # 恢复触发器
├── active/
│   ├── state.yaml           # 当前状态
│   └── current.md           # 当前摘要
├── history/
│   └── checkpoints/         # 检查点文件
├── workers/                 # Worker注册文件
├── plans/                   # 执行计划
│   └── 执行计划-2026-03-26.md
└── reports/                 # 报告文件
    ├── 测试报告-2026-03-26.md
    ├── 评审报告-2026-03-26.md
    └── 汇总报告-2026-03-26.md

scripts/
├── index.js                 # 主API入口
└── lib/
    ├── decomposer.js        # 任务分解
    ├── analyzer.js          # 依赖分析
    ├── scheduler.js         # 调度器
    ├── context.js           # 上下文管理
    ├── checkpoint.js        # 检查点
    ├── wal.js               # WAL持久化
    ├── recovery.js          # 恢复机制
    ├── teams.js             # 专业团队定义
    ├── transition-engine.js # 流转规则引擎
    ├── quality-system.js    # 质量保障系统
    ├── iteration-controller.js # 迭代控制器
    └── utils.js             # 工具函数

config/agents/
├── explorer.yaml            # 探索Agent配置
├── developer.yaml           # 开发Agent配置
├── tester.yaml              # 测试Agent配置
├── reviewer.yaml            # 评审Agent配置
└── compressor.yaml          # 压缩Agent配置
```

## 上下文腐化控制

### 压缩机制

状态文件超过80%阈值时，自动生成压缩任务指令：

```javascript
// recordChange 返回压缩指令
const compressTask = cm.recordChange('task_complete', data);

if (compressTask) {
  // 压缩任务指令
  // { action: 'launch_compress_agent', task: { agent: 'compressor', ... } }
}
```

### 压缩任务下发

```
主Agent检测到压缩需求
    │
    ├── 返回压缩指令
    │
    ▼
启动compressor子Agent
    │
    ├── 归档已完成任务
    ├── 保留最近5条任务
    └── 返回压缩摘要
    │
    ▼
主Agent继续执行
```

## Agent生命周期

| 类型 | 关闭方式 |
|------|---------|
| 独立Agent | 任务完成自动结束 |
| Team成员 | `SendMessage(shutdown_request)` → `TeamDelete()` |
| 后台Task | 自动结束或 `TaskStop()` |

```javascript
// 关闭Team
const instructions = at.getShutdownInstructions('my-team');
// 步骤1: SendMessage({ type: 'shutdown_request' })
// 步骤2: 等待 approve: true
// 步骤3: TeamDelete()
```

## 文档

- [SKILL.md](SKILL.md) - 完整技能定义
- [engine/](engine/) - 执行引擎文档
- [theories/](theories/) - 理论基础
