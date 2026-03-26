/**
 * Agent Teams - 质量保障系统
 * 
 * 实现"专业团队独立工作、闭环反馈迭代"架构
 */

const { getTimestamp, generateId, ensureDir, writeFile, readYAML, writeYAML } = require('./utils');
const path = require('path');
const fs = require('fs');

const TEAM_ROLES = {
  developer: {
    id: 'developer',
    name: '开发团队',
    canEntry: true,
    canModify: true,
    produces: 'code',
    producesReport: '修复报告',
    authority: ['modify_code']
  },
  tester: {
    id: 'tester',
    name: '测试团队',
    canEntry: true,
    canModify: false,
    produces: 'test_report',
    producesReport: '测试报告',
    authority: ['pass', 'reject']
  },
  reviewer: {
    id: 'reviewer',
    name: '评审团队',
    canEntry: true,
    canModify: false,
    produces: 'review_report',
    producesReport: '评审报告',
    authority: ['pass', 'reject']
  },
  security: {
    id: 'security',
    name: '安全团队',
    canEntry: true,
    canModify: false,
    produces: 'security_report',
    producesReport: '安全报告',
    authority: ['pass', 'reject']
  },
  performance: {
    id: 'performance',
    name: '性能团队',
    canEntry: true,
    canModify: false,
    produces: 'performance_report',
    producesReport: '性能报告',
    authority: ['pass', 'reject']
  }
};

const ISSUE_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

const DEFAULT_LOOP_LIMITS = {
  tester_developer: 3,
  reviewer_developer: 2,
  security_developer: 2,
  performance_developer: 2,
  total_transitions: 10,
  total_time_ms: 2 * 60 * 60 * 1000
};

class Team {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.canEntry = config.canEntry ?? true;
    this.canModify = config.canModify ?? false;
    this.produces = config.produces;
    this.producesReport = config.producesReport;
    this.authority = config.authority || [];
    
    this.status = 'idle';
    this.iterations = 0;
    this.lastResult = null;
    this.history = [];
  }

  async execute(task, context) {
    this.status = 'executing';
    this.iterations++;
    
    const startTime = Date.now();
    
    try {
      const result = await this.doWork(task, context);
      
      this.lastResult = result;
      this.history.push({
        iteration: this.iterations,
        timestamp: getTimestamp(),
        status: result.status,
        issues: result.issues,
        duration: Date.now() - startTime
      });
      
      this.status = result.status === 'passed' ? 'completed' : 'failed';
      
      return result;
    } catch (error) {
      this.status = 'error';
      return {
        status: 'error',
        issues: [{
          id: `${this.id}-error`,
          message: error.message,
          severity: ISSUE_SEVERITY.CRITICAL
        }]
      };
    }
  }

  async doWork(task, context) {
    return { status: 'passed', issues: [] };
  }

  canEnter() {
    return this.canEntry;
  }

  canModifyCode() {
    return this.canModify;
  }

  getReport() {
    return {
      teamId: this.id,
      teamName: this.name,
      iterations: this.iterations,
      status: this.status,
      lastResult: this.lastResult,
      history: this.history
    };
  }
}

class DeveloperTeam extends Team {
  async doWork(task, context) {
    const issuesToFix = context.pendingIssues || [];
    
    if (issuesToFix.length > 0) {
      return {
        status: 'passed',
        issues: [],
        output: {
          type: 'fix',
          fixedIssues: issuesToFix.map(i => i.id),
          summary: `修复了 ${issuesToFix.length} 个问题`
        }
      };
    }
    
    return {
      status: 'passed',
      issues: [],
      output: {
        type: 'development',
        summary: '初始开发完成'
      }
    };
  }
}

class TesterTeam extends Team {
  async doWork(task, context) {
    const iteration = this.iterations;
    
    if (iteration === 1) {
      return {
        status: 'failed',
        issues: [
          { id: 'test-1', message: '登录接口返回500错误', severity: ISSUE_SEVERITY.CRITICAL, file: 'test/login.test.js' },
          { id: 'test-2', message: '边界条件未覆盖', severity: ISSUE_SEVERITY.MEDIUM, file: 'test/api.test.js' }
        ],
        output: { summary: '发现2个测试问题' }
      };
    }
    
    if (iteration === 2) {
      return {
        status: 'failed',
        issues: [
          { id: 'test-3', message: '性能测试未通过', severity: ISSUE_SEVERITY.HIGH, file: 'test/perf.test.js' }
        ],
        output: { summary: '发现1个性能问题' }
      };
    }
    
    return {
      status: 'passed',
      issues: [],
      output: { summary: '所有测试通过' }
    };
  }
}

class ReviewerTeam extends Team {
  async doWork(task, context) {
    const iteration = this.iterations;
    
    if (iteration === 1) {
      return {
        status: 'passed',
        issues: [
          { id: 'rv-1', message: '代码风格不一致', severity: ISSUE_SEVERITY.LOW, file: 'src/api.js', line: 45 },
          { id: 'rv-2', message: '缺少错误处理', severity: ISSUE_SEVERITY.MEDIUM, file: 'src/handler.js', line: 78 }
        ],
        output: { summary: '发现2个代码问题' }
      };
    }
    
    return {
      status: 'passed',
      issues: [],
      output: { summary: '代码评审通过' }
    };
  }
}

class SecurityTeam extends Team {
  async doWork(task, context) {
    const iteration = this.iterations;
    
    if (iteration === 1) {
      return {
        status: 'failed',
        issues: [
          { id: 'sec-1', message: 'SQL注入风险', severity: ISSUE_SEVERITY.CRITICAL, file: 'src/db.js', line: 23 }
        ],
        output: { summary: '发现1个安全漏洞' }
      };
    }
    
    return {
      status: 'passed',
      issues: [],
      output: { summary: '安全审计通过' }
    };
  }
}

class PerformanceTeam extends Team {
  async doWork(task, context) {
    return {
      status: 'passed',
      issues: [],
      output: { summary: '性能测试通过' }
    };
  }
}

const TEAM_CLASSES = {
  developer: DeveloperTeam,
  tester: TesterTeam,
  reviewer: ReviewerTeam,
  security: SecurityTeam,
  performance: PerformanceTeam
};

module.exports = {
  Team,
  DeveloperTeam,
  TesterTeam,
  ReviewerTeam,
  SecurityTeam,
  PerformanceTeam,
  TEAM_ROLES,
  TEAM_CLASSES,
  ISSUE_SEVERITY,
  DEFAULT_LOOP_LIMITS
};
