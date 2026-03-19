---
name: Agent-Teams
description: Agent Teams技能，用于创建多个Claude Code实例作为团队协作。支持两种模式：开发需求（规划审批）和修复bug（竞争假设）。当用户需要使用Agent Teams进行团队协作时触发。
---

# Agent Teams 技能

## 触发行为

**当此技能被调用时，必须首先询问用户选择使用哪种模式：**

1. **开发需求模式** - 适用于新功能开发、需求实现等场景
2. **修复bug模式** - 适用于问题排查、bug修复等场景

根据用户选择的模式，进入相应的工作流程。

## 核心组件

- **Lead**: 协调者，负责任务分配、进度跟踪和结果整合
- **Teammates**: 执行者，负责具体任务的实施和交付
- **Task List**: 共享任务列表，用于跟踪团队进度
- **Mailbox**: 消息系统，用于团队成员之间的沟通

## 使用场景

1. **开发需求** → 开发工作流（详见 [development-workflow/planning.md](references/development-workflow/planning.md)）
2. **修复bug** → 竞争假设模式（详见 [competitive-hypothesis/index.md](references/competitive-hypothesis/index.md)）

## 最佳实践

1. **上下文管理**: 为Teammates提供完整的上下文信息
2. **任务拆分**: 每个Teammate负责5-6个任务，明确交付物
3. **避免冲突**: 每个Teammate拥有不同的文件集
4. **监控与引导**: Lead定期检查进度，及时解决问题
5. **协作机制**: Lead等待Teammates完成后再继续下一步
6. **质量保证**: 每个阶段完成后进行评审，确保代码质量
