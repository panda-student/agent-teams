/**
 * Agent Teams - 流转规则引擎
 * 
 * 实现动态流转规则和路径规划
 */

const { ISSUE_SEVERITY } = require('./teams');

const TRANSITION_RULES = {
  issues_found: {
    id: 'issues_found',
    name: '发现问题',
    description: '发现问题返回开发团队修复',
    condition: (result) => result.status === 'failed' || (result.issues && result.issues.length > 0),
    action: 'developer',
    priority: 10
  },
  
  check_passed: {
    id: 'check_passed',
    name: '检查通过',
    description: '检查通过，继续下一团队',
    condition: (result) => result.status === 'passed',
    action: 'next',
    priority: 5
  },
  
  critical_found: {
    id: 'critical_found',
    name: '发现严重问题',
    description: '发现严重问题，立即返回开发',
    condition: (result) => result.issues && result.issues.some(i => i.severity === ISSUE_SEVERITY.CRITICAL),
    action: 'developer',
    priority: 20
  },
  
  escalate: {
    id: 'escalate',
    name: '升级处理',
    description: '需要人工介入',
    condition: () => false,
    action: 'escalation',
    priority: 100
  }
};

class TransitionEngine {
  constructor(config = {}) {
    this.config = config;
    this.rules = { ...TRANSITION_RULES, ...(config.rules || {}) };
    this.transitions = [];
    this.currentPath = [];
    this.loopCounts = {};
  }

  determineNext(currentTeam, result, context) {
    const applicableRules = [];
    
    for (const [id, rule] of Object.entries(this.rules)) {
      if (rule.condition(result, context)) {
        applicableRules.push({ ...rule, id });
      }
    }
    
    applicableRules.sort((a, b) => b.priority - a.priority);
    
    if (applicableRules.length === 0) {
      return {
        action: 'proceed',
        nextTeam: this.getNextTeam(currentTeam, context),
        rule: 'default',
        message: '继续下一团队'
      };
    }
    
    const selectedRule = applicableRules[0];
    
    if (selectedRule.action === 'developer' && currentTeam !== 'developer') {
      const transitionCheck = this.checkLoopLimit(currentTeam, 'developer', context);
      if (!transitionCheck.allowed) {
        return {
          action: 'escalate',
          nextTeam: 'escalation',
          rule: 'loop_limit',
          message: transitionCheck.reason
        };
      }
    }
    
    const transition = {
      from: currentTeam,
      to: selectedRule.action === 'next' ? this.getNextTeam(currentTeam, context) : selectedRule.action,
      rule: selectedRule.id,
      ruleName: selectedRule.name,
      timestamp: new Date().toISOString(),
      result: result.status,
      issueCount: result.issues ? result.issues.length : 0
    };
    
    this.transitions.push(transition);
    this.currentPath.push(transition);
    
    if (currentTeam !== 'developer' && selectedRule.action === 'developer') {
      const key = `${currentTeam}_developer`;
      this.loopCounts[key] = (this.loopCounts[key] || 0) + 1;
    }
    
    if (selectedRule.action === 'developer') {
      return {
        action: 'return_to_developer',
        nextTeam: 'developer',
        rule: selectedRule.id,
        message: `${selectedRule.name}，返回开发团队修复`,
        issues: result.issues
      };
    }
    
    if (selectedRule.action === 'escalation') {
      return {
        action: 'escalate',
        nextTeam: 'escalation',
        rule: selectedRule.id,
        message: '需要人工介入处理'
      };
    }
    
    return {
      action: 'proceed',
      nextTeam: this.getNextTeam(currentTeam, context),
      rule: selectedRule.id,
      message: `${selectedRule.name}，继续执行`
    };
  }

  getNextTeam(currentTeam, context) {
    const { pendingTeams, completedTeams } = context;
    
    if (!pendingTeams || pendingTeams.length === 0) {
      return 'summary';
    }
    
    const nextTeam = pendingTeams.find(t => !completedTeams.includes(t));
    
    return nextTeam || 'summary';
  }

  planRoute(entryTeam, requiredTeams = []) {
    const route = {
      entry: entryTeam,
      sequence: [],
      parallel: [],
      required: requiredTeams
    };
    
    if (entryTeam !== 'developer') {
      route.sequence.push(entryTeam);
    }
    
    route.sequence.push('developer');
    
    const verificationTeams = requiredTeams.filter(t => 
      t !== 'developer' && t !== entryTeam
    );
    
    if (verificationTeams.length > 1) {
      route.parallel = verificationTeams;
      route.sequence.push('parallel_verification');
    } else if (verificationTeams.length === 1) {
      route.sequence.push(...verificationTeams);
    }
    
    route.sequence.push('summary');
    
    return route;
  }

  checkLoopLimit(from, to, context) {
    const loopLimits = context.loopLimits || {};
    
    const pairKey = `${from}_${to}`;
    const pairLimit = loopLimits[pairKey];
    const currentCount = this.loopCounts[pairKey] || 0;
    
    if (pairLimit && currentCount >= pairLimit) {
      return {
        allowed: false,
        reason: `${from}→${to} 循环次数已达上限 ${pairLimit}`
      };
    }
    
    const totalLimit = loopLimits.total_transitions;
    if (totalLimit && this.transitions.length >= totalLimit) {
      return {
        allowed: false,
        reason: `总流转次数已达上限 ${totalLimit}`
      };
    }
    
    return { allowed: true };
  }

  getTransitionHistory() {
    return this.transitions;
  }

  getCurrentPath() {
    return this.currentPath;
  }

  detectLoopPattern() {
    const patterns = {};
    
    for (const transition of this.transitions) {
      const key = `${transition.from}->${transition.to}`;
      patterns[key] = (patterns[key] || 0) + 1;
    }
    
    const loops = Object.entries(patterns)
      .filter(([_, count]) => count >= 2)
      .map(([path, count]) => ({ path, count }));
    
    return loops;
  }

  getReport() {
    return {
      totalTransitions: this.transitions.length,
      transitions: this.transitions,
      loopCounts: this.loopCounts,
      loopPatterns: this.detectLoopPattern(),
      currentPath: this.currentPath
    };
  }
}

module.exports = {
  TransitionEngine,
  TRANSITION_RULES
};
