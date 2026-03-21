---
name: agent-teams
description: 多Agent协作技能，通过四大基本元素自由组合适应复杂开发需求。Invoke when: 开发任务、Bug修复、代码评审、自动化部署、或需要团队协作的复杂任务。
---

# Agent Teams

**核心目标：在保证质量的前提下，最短时间完成任务**

## 快速路由

| 任务类型 | 关键词 | 配置模板 |
|---------|--------|---------|
| 功能开发 | 开发、实现、新增、重构、添加 | `standard-dev` |
| Bug修复 | bug、修复、问题、错误、缺陷 | `bug-fix` |
| 代码评审 | 评审、检查、审查、审计 | `code-review` |
| 自动部署 | 部署、发布、CI/CD、自动化 | `auto-cicd` |

---

## 触发流程

### 步骤一：创建团队（强制）

```
📋 正在创建团队...
✅ 团队已创建：
- Lead: [协调者]
- Teammate 1-3+: [角色]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 步骤二：匹配配置

**需求明确 → 自动匹配**

```
📋 分析需求 → ✅ 匹配配置：[模板名称]
👉 加载配置：.claude/config/templates/[文件名].yaml
```

**需求不明确 → 用户选择**

```
AskUserQuestion:
  question: "请选择执行配置："
  options:
    - "📦 标准开发流程"
    - "🐛 Bug修复流程"
    - "🔍 代码评审流程"
    - "🚀 全自动CI/CD流程"
    - "⚙️ 自定义组合"
```

### 步骤三：执行循环

```
a. 识别并行任务组 → b. 分配给Teammates → c. 并行执行 → d. 质量门验证 → e. 下一批
```

### 步骤四：输出与转换

```
🎉 执行完成 → 📊 结果汇总 → 📦 交付物 → 🔄 可切换配置
```

---

## 四大基本元素

| 元素 | 类型 | 说明 |
|------|------|------|
| **团队类型** | product/dev/test/review/ops/design/mixed | 角色构成 |
| **协作模式** | one-way/two-way/network/hierarchical/pipeline | 信息流向 |
| **人机协作** | auto/key-node/interactive/guided/manual | 用户参与度 |
| **流程类型** | serial/parallel/hybrid/iterative/conditional | 执行顺序 |

详细定义 → [reference.md](reference.md)

---

## 质量保证

**强制检查项（P0）：**
- 代码编译 ✅
- 类型检查 ✅
- 单元测试 ✅

**禁止行为（验证通过前）：**
- ❌ 报告完成 / ❌ 提交代码 / ❌ 切换配置

详细规范 → [reference.md#质量保证机制](reference.md#质量保证机制)

---

## 工作目录

```
.claude/
├── config/elements/     # 基本元素定义
├── config/templates/    # 预设模板
├── deliverables/        # 交付物留存
├── logs/                # 执行日志
└── instances/           # 实例数据
```

详细结构 → [reference.md#工作目录结构](reference.md#工作目录结构)

---

## 配置模板间调用

```
standard_dev → code_review → [通过:完成 | 需修改:bug_fix | 不通过:standard_dev]
                        ↓
                    bug_fix → code_review
```

详细流程 → [reference.md#配置模板间调用关系](reference.md#配置模板间调用关系)

---

## 附录资源

| 资源 | 用途 | 路径 |
|------|------|------|
| 详细规范 | 完整定义和规范 | [reference.md](reference.md) |
| 示例文档 | 使用示例 | [examples.md](examples.md) |
| 并行执行理论 | 并行处理策略 | [theories/parallel-execution.md](theories/parallel-execution.md) |
| 质量保证理论 | 质量门机制 | [theories/quality-guarantee.md](theories/quality-guarantee.md) |
| 执行计划模板 | 计划文档模板 | [templates/plan-template.md](templates/plan-template.md) |
| 执行报告模板 | 报告文档模板 | [templates/report-template.md](templates/report-template.md) |

---

## 核心原则

| 原则 | 描述 |
|------|------|
| **并行优先** | 最大化并行，最短时间完成 |
| **质量优先** | 质量是底线，必须通过 |
| **文件隔离** | 不同文件集，避免冲突 |
| **模块隔离** | 不同模块，职责清晰 |
| **状态同步** | 实时监控，及时处理 |
| **灵活组合** | 自由组合，适应场景 |
