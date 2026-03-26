/**
 * Agent Teams - 质量保障系统
 * 
 * 实现主Agent调度器
 */

const { getTimestamp, generateId, ensureDir, writeFile } = require('./utils');
const { getPaths } = require('./constants');
const { TEAM_CLASSES, TEAM_ROLES, ISSUE_SEVERITY, DEFAULT_LOOP_LIMITS } = require('./teams');
const { TransitionEngine } = require('./transition-engine');
const ContextManager = require('./context');
const path = require('path');
const fs = require('fs');

class QualityAssuranceSystem {
  constructor(baseDir, config = {}) {
    this.baseDir = baseDir;
    this.config = {
      loopLimits: { ...DEFAULT_LOOP_LIMITS, ...(config.loopLimits || {}) }
    };
    this.paths = getPaths(baseDir);
    this.contextManager = new ContextManager(baseDir);
    this.teams = new Map();
    this.teamReports = new Map();
    this.issueHistory = [];
    this.pendingIssues = [];
    this.startTime = null;
    this.transitionEngine = new TransitionEngine(this.config);
    this.currentTask = null;
    this.currentEntry = null;
    this.completedTeams = [];
    this.pendingTeams = [];
    this.currentTeam = null;
    this.maxIterations = 20;
    this.iterationCount = 0;
  }

  createTeam(teamId) {
    const TeamClass = TEAM_CLASSES[teamId];
    if (!TeamClass) {
      throw new Error(`Unknown team: ${teamId}`);
    }
    
    const team = new TeamClass(TEAM_ROLES[teamId]);
    this.teams.set(teamId, team);
    return team;
  }

  async run(options) {
    this.startTime = Date.now();
    this.currentTask = options.task;
    this.currentEntry = options.entryTeam || 'developer';
    this.pendingTeams = [...(options.requiredTeams || [])];
    this.completedTeams = [];
    this.pendingIssues = [];
    this.iterationCount = 0;
    
    this.contextManager.initMission({
      goal: options.task?.name || 'Quality Assurance Task'
    });
    
    this.contextManager.state.teams = this.pendingTeams;
    this.contextManager._saveState();
    
    const route = this.transitionEngine.planRoute(
      this.currentEntry, 
      this.pendingTeams
    );
    
    this.currentTeam = this.currentEntry;
    
    while (this.iterationCount < this.maxIterations) {
      this.iterationCount++;
      
      if (this.currentTeam === 'summary' || this.currentTeam === 'escalation') {
        break;
      }
      
      const team = this.teams.get(this.currentTeam);
      if (!team) {
        return this.handleEscalation(`Team ${this.currentTeam} not found`);
      }
      
      const context = {
        pendingIssues: this.pendingIssues,
        completedTeams: this.completedTeams,
        pendingTeams: this.pendingTeams,
        loopLimits: this.config.loopLimits
      };
      
      const result = await team.execute(this.currentTask, context);
      
      this.teamReports.set(this.currentTeam, {
        teamId: this.currentTeam,
        teamName: team.name,
        timestamp: getTimestamp(),
        status: result.status,
        issues: result.issues,
        output: result.output
      });
      
      if (result.issues && result.issues.length > 0) {
        this.issueHistory.push([...result.issues]);
      }
      
      const nextStep = this.transitionEngine.determineNext(
        this.currentTeam, 
        result, 
        {
          pendingTeams: this.pendingTeams,
          completedTeams: this.completedTeams,
          loopLimits: this.config.loopLimits
        }
      );
      
      if (nextStep.action === 'escalate') {
        return this.handleEscalation(nextStep.message);
      }
      
      if (nextStep.action === 'return_to_developer') {
        this.pendingIssues = nextStep.issues || [];
        this.completedTeams.push(this.currentTeam);
        this.currentTeam = 'developer';
        continue;
      }
      
      if (nextStep.nextTeam === 'summary') {
        this.completedTeams.push(this.currentTeam);
        return this.handleSummary();
      }
      
      this.completedTeams.push(this.currentTeam);
      this.pendingTeams = this.pendingTeams.filter(t => t !== nextStep.nextTeam);
      this.currentTeam = nextStep.nextTeam;
      this.pendingIssues = [];
    }
    
    return this.handleEscalation('Max iterations reached');
  }

  handleEscalation(reason) {
    return {
      finalStatus: 'escalated',
      escalation: {
        reason,
        timestamp: getTimestamp(),
        transitionHistory: this.transitionEngine.getTransitionHistory(),
        loopPatterns: this.transitionEngine.detectLoopPattern()
      },
      duration: Date.now() - this.startTime,
      transitionEngine: this.transitionEngine
    };
  }

  handleSummary() {
    const summary = this.generateSummaryReport();
    return {
      finalStatus: 'completed',
      summary,
      duration: Date.now() - this.startTime,
      transitionEngine: this.transitionEngine,
      teamReports: Object.fromEntries(this.teamReports)
    };
  }

  generateSummaryReport() {
    const reportsDir = this.paths.reports;
    ensureDir(reportsDir);
    
    const timestamp = getTimestamp();
    const dateStr = timestamp.split('T')[0];
    const fileName = `汇总报告-${dateStr}.md`;
    const filePath = path.join(reportsDir, fileName);
    
    const iterationReport = this.transitionEngine.getReport();
    
    let content = `# 汇总报告

**生成时间**: ${timestamp}

## 一、执行概况

| 指标 | 数值 |
|------|------|
| 总流转次数 | ${iterationReport.totalTransitions} |
| 完成团队数 | ${this.completedTeams.length} |
| 问题历史数 | ${this.issueHistory.length} |

## 二、团队执行统计

| 团队 | 执行次数 | 最终状态 |
|------|---------|---------|
`;
    
    for (const [id, team] of this.teams) {
      content += `| ${team.name} | ${team.iterations} | ${team.status} |\n`;
    }
    
    if (iterationReport.loopPatterns.length > 0) {
      content += `
## 三、循环模式检测

| 路径 | 次数 |
|------|------|
`;
      iterationReport.loopPatterns.forEach(p => {
        content += `| ${p.path} | ${p.count} |\n`;
      });
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
  QualityAssuranceSystem,
  TEAM_CLASSES,
  ISSUE_SEVERITY
};
