/**
 * Agent Teams - 迭代控制器
 * 
 * 实现多级循环迭代机制，包含死循环防护
 */

const { getTimestamp, generateId } = require('./utils');

const LOOP_PROTECTION = {
  MAX_ITERATIONS: {
    review: 3,
    test: 3,
    total: 5
  },
  CONVERGENCE: {
    minReduction: 0.3,
    maxSameIssues: 2,
    criticalMustFix: true
  },
  TIMEOUT: {
    perIteration: 30 * 60 * 1000,
    total: 4 * 60 * 60 * 1000
  },
  ESCALATION: {
    maxAutoIterations: 3,
    criticalFailure: true,
    timeoutReached: true
  }
};

const ISSUE_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

const STAGE_ORDER = ['development', 'review', 'test', 'acceptance'];

class IterationController {
  constructor(baseDir, config = {}) {
    this.baseDir = baseDir;
    this.config = { ...LOOP_PROTECTION, ...config };
    
    this.iterationHistory = [];
    this.issueHistory = [];
    this.currentIteration = 0;
    this.stageIterations = {
      development: 0,
      review: 0,
      test: 0
    };
    
    this.startTime = Date.now();
    this.issues = [];
    this.fixedIssues = [];
    this.recurringIssues = new Map();
  }

  canProceed(stage) {
    const checks = [
      this.checkMaxIterations(stage),
      this.checkTimeout(),
      this.checkConvergence(),
      this.checkCriticalIssues()
    ];
    
    const failures = checks.filter(c => !c.passed);
    
    if (failures.length > 0) {
      return {
        canProceed: false,
        reasons: failures.map(f => f.reason),
        action: failures[0].action
      };
    }
    
    return { canProceed: true };
  }

  checkMaxIterations(stage) {
    const stageCount = this.stageIterations[stage] || 0;
    
    if (stageCount >= this.config.MAX_ITERATIONS[stage]) {
      return {
        passed: false,
        reason: `${stage}阶段已达到最大迭代次数 ${this.config.MAX_ITERATIONS[stage]}`,
        action: 'escalate'
      };
    }
    
    if (this.currentIteration >= this.config.MAX_ITERATIONS.total) {
      return {
        passed: false,
        reason: `总迭代次数已达到上限 ${this.config.MAX_ITERATIONS.total}`,
        action: 'escalate'
      };
    }
    
    return { passed: true };
  }

  checkTimeout() {
    const elapsed = Date.now() - this.startTime;
    
    if (elapsed >= this.config.TIMEOUT.total) {
      return {
        passed: false,
        reason: `已超过总时间限制 ${this.config.TIMEOUT.total / 60000} 分钟`,
        action: 'escalate'
      };
    }
    
    return { passed: true };
  }

  checkConvergence() {
    if (this.issueHistory.length < 2) {
      return { passed: true };
    }
    
    const prevIssues = this.issueHistory[this.issueHistory.length - 2];
    const currIssues = this.issueHistory[this.issueHistory.length - 1];
    
    if (currIssues.length >= prevIssues.length) {
      const reduction = 1 - (currIssues.length / prevIssues.length);
      if (reduction < this.config.CONVERGENCE.minReduction) {
        return {
          passed: false,
          reason: `问题数量未有效减少，当前减少比例: ${(reduction * 100).toFixed(1)}%`,
          action: 'escalate'
        };
      }
    }
    
    return { passed: true };
  }

  checkCriticalIssues() {
    if (!this.config.CONVERGENCE.criticalMustFix) {
      return { passed: true };
    }
    
    const criticalIssues = this.issues.filter(
      i => i.severity === ISSUE_SEVERITY.CRITICAL
    );
    
    if (criticalIssues.length > 0) {
      const recurringCritical = criticalIssues.filter(i => {
        const count = this.recurringIssues.get(i.id) || 0;
        return count >= this.config.CONVERGENCE.maxSameIssues;
      });
      
      if (recurringCritical.length > 0) {
        return {
          passed: false,
          reason: `存在重复出现的严重问题: ${recurringCritical.map(i => i.message).join(', ')}`,
          action: 'escalate'
        };
      }
    }
    
    return { passed: true };
  }

  recordIteration(stage, result) {
    this.currentIteration++;
    this.stageIterations[stage] = (this.stageIterations[stage] || 0) + 1;
    
    const iteration = {
      id: generateId('iter'),
      stage,
      iteration: this.currentIteration,
      timestamp: getTimestamp(),
      result: result.status,
      issues: result.issues || [],
      duration: Date.now() - this.startTime
    };
    
    this.iterationHistory.push(iteration);
    
    if (result.issues) {
      this.issueHistory.push([...result.issues]);
      this.updateRecurringIssues(result.issues);
    }
    
    return iteration;
  }

  updateRecurringIssues(issues) {
    issues.forEach(issue => {
      const count = this.recurringIssues.get(issue.id) || 0;
      this.recurringIssues.set(issue.id, count + 1);
    });
  }

  shouldEscalate() {
    if (this.currentIteration >= this.config.ESCALATION.maxAutoIterations) {
      return {
        needed: true,
        reason: '达到自动迭代上限',
        history: this.iterationHistory
      };
    }
    
    const criticalFailures = this.iterationHistory.filter(
      i => i.issues.some(issue => issue.severity === ISSUE_SEVERITY.CRITICAL)
    );
    
    if (criticalFailures.length >= 2) {
      return {
        needed: true,
        reason: '多次出现严重问题',
        history: this.iterationHistory
      };
    }
    
    return { needed: false };
  }

  getNextStage(currentStage, result) {
    const currentIndex = STAGE_ORDER.indexOf(currentStage);
    
    if (result.status === 'passed') {
      return {
        stage: STAGE_ORDER[currentIndex + 1] || 'acceptance',
        action: 'proceed',
        message: `${currentStage}通过，进入下一阶段`
      };
    }
    
    if (currentStage === 'review' || currentStage === 'test') {
      const check = this.canProceed('development');
      if (!check.passed) {
        return {
          stage: 'escalation',
          action: 'escalate',
          message: check.reason || '达到迭代限制'
        };
      }
      
      return {
        stage: 'development',
        action: 'iterate',
        message: `${currentStage}未通过，返回开发修复`,
        issues: result.issues
      };
    }
    
    return {
      stage: currentStage,
      action: 'retry',
      message: `重试当前阶段`
    };
  }

  getReport() {
    return {
      totalIterations: this.currentIteration,
      stageIterations: this.stageIterations,
      duration: Date.now() - this.startTime,
      issueHistory: this.issueHistory.map((issues, idx) => ({
        iteration: idx + 1,
        issueCount: issues.length,
        issues: issues
      })),
      recurringIssues: Object.fromEntries(this.recurringIssues),
      escalationNeeded: this.shouldEscalate()
    };
  }
}

module.exports = {
  IterationController,
  LOOP_PROTECTION,
  ISSUE_SEVERITY,
  STAGE_ORDER
};
