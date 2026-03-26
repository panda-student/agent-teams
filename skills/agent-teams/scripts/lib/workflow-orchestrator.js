/**
 * Agent Teams - 工作流编排器
 * 
 * 协调专业团队执行，实现多级循环迭代
 */

const { IterationController, STAGE_ORDER, ISSUE_SEVERITY } = require('./iteration-controller');
const { getTimestamp, generateId, ensureDir, writeFile, writeYAML, readYAML } = require('./utils');
const { getPaths } = require('./constants');
const path = require('path');
const fs = require('fs');

class WorkflowOrchestrator {
  constructor(baseDir, config = {}) {
    this.baseDir = baseDir;
    this.config = config;
    this.paths = getPaths(baseDir);
    this.iterationController = new IterationController(baseDir, config);
    
    this.teams = new Map();
    this.teamReports = new Map();
    this.mainAgentReport = null;
  }

  registerTeam(teamId, teamConfig) {
    this.teams.set(teamId, {
      id: teamId,
      name: teamConfig.name,
      type: teamConfig.type,
      role: teamConfig.role,
      status: 'idle',
      lastResult: null,
      iterations: 0
    });
  }

  async executeStage(stage, task) {
    const stageConfig = {
      development: { team: 'dev-team', output: '代码实现' },
      review: { team: 'review-team', output: '评审报告' },
      test: { team: 'test-team', output: '测试报告' }
    };
    
    const config = stageConfig[stage];
    if (!config) {
      return { status: 'passed', issues: [] };
    }
    
    const team = this.teams.get(config.team);
    if (!team) {
      return { 
        status: 'error', 
        issues: [{ 
          id: 'team-not-found', 
          message: `团队 ${config.team} 未注册`,
          severity: ISSUE_SEVERITY.CRITICAL 
        }] 
      };
    }
    
    team.status = 'executing';
    team.iterations++;
    
    const result = await this.simulateTeamExecution(stage, team, task);
    
    team.status = result.status === 'passed' ? 'completed' : 'failed';
    team.lastResult = result;
    
    this.teamReports.set(stage, {
      stage,
      team: config.team,
      timestamp: getTimestamp(),
      result: result.status,
      issues: result.issues,
      output: result.output
    });
    
    this.iterationController.recordIteration(stage, result);
    
    return result;
  }

  async simulateTeamExecution(stage, team, task) {
    const stageHandlers = {
      development: () => this.executeDevelopment(team, task),
      review: () => this.executeReview(team, task),
      test: () => this.executeTest(team, task)
    };
    
    const handler = stageHandlers[stage];
    if (handler) {
      return await handler();
    }
    
    return { status: 'passed', issues: [] };
  }

  async executeDevelopment(team, task) {
    const issues = this.getIssuesToFix();
    
    if (issues.length > 0) {
      this.iterationController.fixedIssues = issues;
    }
    
    return {
      status: 'passed',
      issues: [],
      output: {
        filesModified: issues.length > 0 ? issues.map(i => i.file) : ['src/'],
        summary: issues.length > 0 ? `修复了 ${issues.length} 个问题` : '初始开发完成'
      }
    };
  }

  async executeReview(team, task) {
    const issues = this.generateReviewIssues();
    
    return {
      status: issues.filter(i => i.severity === ISSUE_SEVERITY.CRITICAL).length === 0 ? 'passed' : 'failed',
      issues: issues,
      output: {
        reportFile: this.saveReport('review', { team, issues }),
        summary: `发现 ${issues.length} 个问题`
      }
    };
  }

  async executeTest(team, task) {
    const issues = this.generateTestIssues();
    
    return {
      status: issues.filter(i => i.severity === ISSUE_SEVERITY.CRITICAL).length === 0 ? 'passed' : 'failed',
      issues: issues,
      output: {
        reportFile: this.saveReport('test', { team, issues }),
        summary: `发现 ${issues.length} 个测试问题`
      }
    };
  }

  getIssuesToFix() {
    const allIssues = [];
    
    for (const [stage, report] of this.teamReports) {
      if (report.issues) {
        allIssues.push(...report.issues.map(i => ({ ...i, fromStage: stage })));
      }
    }
    
    return allIssues;
  }

  generateReviewIssues() {
    const iteration = this.iterationController.stageIterations.review || 0;
    
    if (iteration === 0) {
      return [
        { id: 'rv-1', message: '代码风格不一致', severity: ISSUE_SEVERITY.LOW, file: 'src/api.js', line: 45 },
        { id: 'rv-2', message: '缺少错误处理', severity: ISSUE_SEVERITY.MEDIUM, file: 'src/handler.js', line: 78 }
      ];
    }
    
    if (iteration === 1) {
      return [
        { id: 'rv-3', message: '注释不完整', severity: ISSUE_SEVERITY.LOW, file: 'src/utils.js', line: 12 }
      ];
    }
    
    return [];
  }

  generateTestIssues() {
    const iteration = this.iterationController.stageIterations.test || 0;
    
    if (iteration === 0) {
      return [
        { id: 'test-1', message: '登录接口返回500', severity: ISSUE_SEVERITY.CRITICAL, file: 'test/login.test.js' },
        { id: 'test-2', message: '边界条件未覆盖', severity: ISSUE_SEVERITY.MEDIUM, file: 'test/api.test.js' }
      ];
    }
    
    if (iteration === 1) {
      return [
        { id: 'test-3', message: '性能测试未通过', severity: ISSUE_SEVERITY.HIGH, file: 'test/perf.test.js' }
      ];
    }
    
    return [];
  }

  saveReport(stage, data) {
    const reportsDir = this.paths.reports;
    ensureDir(reportsDir);
    
    const timestamp = getTimestamp();
    const dateStr = timestamp.split('T')[0];
    const fileName = `${stage === 'review' ? '评审报告' : '测试报告'}-${dateStr}.md`;
    const filePath = path.join(reportsDir, fileName);
    
    const content = this.renderReport(stage, data);
    writeFile(filePath, content);
    
    return filePath;
  }

  renderReport(stage, data) {
    const { team, issues } = data;
    
    return `# ${stage === 'review' ? '评审报告' : '测试报告'}

**团队**: ${team.name}
**时间**: ${getTimestamp()}
**迭代次数**: ${team.iterations}

## 结果

**状态**: ${issues.length === 0 ? '✅ 通过' : '❌ 存在问题'}

## 问题列表

${issues.length > 0 ? `| ID | 问题 | 严重程度 | 文件 |
|----|------|---------|------|
${issues.map(i => `| ${i.id} | ${i.message} | ${i.severity} | ${i.file || '-'} |`).join('\n')}` : '无问题'}

---
*报告由 ${team.name} 自动生成*
`;
  }

  async run(task) {
    const result = {
      taskId: generateId('task'),
      startTime: getTimestamp(),
      stages: [],
      iterations: [],
      finalStatus: 'pending',
      reports: {}
    };
    
    let currentStage = 'development';
    let stageResult;
    
    while (currentStage !== 'acceptance' && currentStage !== 'escalation') {
      console.log(`\n=== 执行阶段: ${currentStage} ===`);
      
      stageResult = await this.executeStage(currentStage, task);
      
      result.stages.push({
        stage: currentStage,
        status: stageResult.status,
        issues: stageResult.issues.length,
        timestamp: getTimestamp()
      });
      
      console.log(`阶段结果: ${stageResult.status}`);
      console.log(`发现问题: ${stageResult.issues.length}`);
      
      const nextStep = this.iterationController.getNextStage(currentStage, stageResult);
      
      result.iterations.push({
        from: currentStage,
        to: nextStep.stage,
        action: nextStep.action,
        message: nextStep.message
      });
      
      console.log(`下一步: ${nextStep.message}`);
      
      if (nextStep.action === 'escalate') {
        currentStage = 'escalation';
        result.finalStatus = 'escalated';
        result.escalationReason = nextStep.message;
      } else {
        currentStage = nextStep.stage;
      }
    }
    
    if (currentStage === 'acceptance') {
      result.finalStatus = 'completed';
      result.reports = this.generateFinalReports();
    }
    
    result.endTime = getTimestamp();
    result.duration = Date.now() - new Date(result.startTime).getTime();
    result.iterationReport = this.iterationController.getReport();
    
    return result;
  }

  generateFinalReports() {
    const reports = {};
    
    for (const [stage, report] of this.teamReports) {
      reports[stage] = report;
    }
    
    const summaryReport = this.generateSummaryReport();
    reports.summary = summaryReport;
    
    return reports;
  }

  generateSummaryReport() {
    const reportsDir = this.paths.reports;
    ensureDir(reportsDir);
    
    const timestamp = getTimestamp();
    const dateStr = timestamp.split('T')[0];
    const fileName = `汇总报告-${dateStr}.md`;
    const filePath = path.join(reportsDir, fileName);
    
    const iterationReport = this.iterationController.getReport();
    
    let content = `# 汇总报告

**生成时间**: ${timestamp}
**总迭代次数**: ${iterationReport.totalIterations}

## 一、执行概况

| 阶段 | 迭代次数 | 状态 |
|------|---------|------|
`;
    
    for (const [stage, count] of Object.entries(iterationReport.stageIterations)) {
      const report = this.teamReports.get(stage);
      content += `| ${stage} | ${count} | ${report?.result || '-'} |\n`;
    }
    
    content += `
## 二、问题历史

| 迭代 | 问题数 | 详情 |
|------|--------|------|
`;
    
    iterationReport.issueHistory.forEach((issues, idx) => {
      content += `| ${idx + 1} | ${issues.length} | ${issues.map(i => i.message).join(', ') || '无'} |\n`;
    });
    
    if (iterationReport.recurringIssues.size > 0) {
      content += `
## 三、重复问题

| 问题ID | 出现次数 |
|--------|---------|
`;
      for (const [id, count] of iterationReport.recurringIssues) {
        content += `| ${id} | ${count} |\n`;
      }
    }
    
    content += `
## 四、团队执行统计

| 团队 | 执行次数 | 最终状态 |
|------|---------|---------|
`;
    
    for (const [id, team] of this.teams) {
      content += `| ${team.name} | ${team.iterations} | ${team.status} |\n`;
    }
    
    content += `
---
*报告由主 Agent 汇总生成*
`;
    
    writeFile(filePath, content);
    
    return { path: filePath, content };
  }
}

module.exports = {
  WorkflowOrchestrator,
  STAGE_ORDER,
  ISSUE_SEVERITY
};
