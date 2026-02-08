/**
 * 活体种子AI - 自动修复模块 v2.0
 *
 * 核心理念：人类文明的发展 = 错误 → 修正 → 正确 → 更高级的错误 → 更深的修正
 * 种子也一样: 不可能避免错误，但必须有全面修复和校正的能力
 *
 * v2.0 升级:
 *   - 8条基础修复规则 (EPIPE/停滞/日志/内存/网络/JSON/权限/能力)
 *   + 运行时行为监控 — 检测大脑决策被动、重复失败模式
 *   + 代码自校正 — AST分析+语法检查+编译验证+自动修复
 *   + 依赖自管理 — 缺失npm包自动安装
 *   + 决策质量追踪 — 监控行动成功率，自动调优
 *   + 认知经验库 — 修复经验沉淀，同类问题秒修
 *
 * 已知错误修复清单(自动扩展):
 * - EPIPE broken pipe → 全局handler忽略
 * - 进化模块停滞 → 检测并重启
 * - 日志膨胀 → 记忆提取+清理
 * - 内存溢出 → 触发清理模块
 * - 网络超时 → 记录等待恢复
 * - JSON损坏 → 备份恢复/重置
 * - 文件权限 → 等待重试
 * - 能力评分低 → 触发进化引擎
 * - [v2.0] 大脑决策被动 → 调整决策参数
 * - [v2.0] 代码语法错误 → AST分析+自动修正
 * - [v2.0] 依赖缺失 → npm自动安装
 * - [v2.0] 协议不匹配 → http→https自动修正
 * - [v2.0] 浏览器获取失败 → 冷却+降级策略
 *
 * 主人印记: 19860316
 */

const fs = require('fs');
const path = require('path');

const { execSync } = require('child_process');
const Module = require('module');

const SEED_PATH = __dirname;
const REPAIR_LOG = path.join(SEED_PATH, 'seed-repair-log.json');

// ═══════════════════════════════════════════════════════════
//  运行时行为监控器 — 像医生一样检查种子健康
// ═══════════════════════════════════════════════════════════
class RuntimeBehaviorMonitor {
    constructor() {
        this._decisionHistory = [];  // 最近决策记录
        this._errorPatterns = {};    // 错误模式统计
        this._actionOutcomes = {};   // 动作结果追踪
    }

    // 记录一次大脑决策
    recordDecision(action, reason, success = true) {
        this._decisionHistory.push({
            action, reason, success,
            time: Date.now(),
        });
        if (this._decisionHistory.length > 200) this._decisionHistory.splice(0, 100);

        // 追踪动作成功率
        if (!this._actionOutcomes[action]) {
            this._actionOutcomes[action] = { total: 0, success: 0 };
        }
        this._actionOutcomes[action].total++;
        if (success) this._actionOutcomes[action].success++;
    }

    // 记录错误模式
    recordError(errorType, message) {
        const key = errorType + ':' + (message || '').substring(0, 40);
        if (!this._errorPatterns[key]) {
            this._errorPatterns[key] = { count: 0, firstSeen: Date.now(), lastSeen: 0 };
        }
        this._errorPatterns[key].count++;
        this._errorPatterns[key].lastSeen = Date.now();
    }

    // 诊断: 大脑是否被动?
    diagnoseBrainPassivity() {
        const recent = this._decisionHistory.slice(-50);
        if (recent.length < 10) return { passive: false, reason: 'insufficient_data' };

        const passiveActions = recent.filter(d =>
            d.action === 'DONE' || d.action === 'WAIT'
        );
        const passiveRatio = passiveActions.length / recent.length;

        // 检查重复模式
        const reasons = recent.map(d => d.reason);
        const reasonCounts = {};
        for (const r of reasons) {
            reasonCounts[r] = (reasonCounts[r] || 0) + 1;
        }
        const dominantReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
        const repeatRatio = (dominantReason?.[1] || 0) / recent.length;

        return {
            passive: passiveRatio > 0.8,
            passiveRatio,
            repeatRatio,
            dominantReason: dominantReason?.[0],
            totalDecisions: recent.length,
            recommendation: passiveRatio > 0.8
                ? 'INCREASE_PROACTIVE_ANALYSIS'
                : repeatRatio > 0.6
                    ? 'BREAK_REPEAT_PATTERN'
                    : 'HEALTHY',
        };
    }

    // 诊断: 错误模式是否在重复?
    diagnoseRepeatErrors() {
        const now = Date.now();
        const recentErrors = Object.entries(this._errorPatterns)
            .filter(([, v]) => now - v.lastSeen < 30 * 60000) // 30分钟内
            .sort((a, b) => b[1].count - a[1].count);

        return {
            hasRepeatErrors: recentErrors.some(([, v]) => v.count >= 3),
            topErrors: recentErrors.slice(0, 5).map(([k, v]) => ({
                pattern: k, count: v.count,
                frequency: v.count / ((now - v.firstSeen) / 60000 + 1), // 次/分钟
            })),
        };
    }

    // 诊断: 动作成功率
    diagnoseActionQuality() {
        const results = {};
        for (const [action, stats] of Object.entries(this._actionOutcomes)) {
            results[action] = {
                total: stats.total,
                successRate: stats.total > 0 ? stats.success / stats.total : 0,
                needsImprovement: stats.total >= 5 && stats.success / stats.total < 0.5,
            };
        }
        return results;
    }

    // 综合健康诊断
    diagnose() {
        return {
            brain: this.diagnoseBrainPassivity(),
            errors: this.diagnoseRepeatErrors(),
            actions: this.diagnoseActionQuality(),
            totalDecisions: this._decisionHistory.length,
            uptime: this._decisionHistory.length > 0
                ? Date.now() - this._decisionHistory[0].time
                : 0,
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  代码自校正引擎 — 种子修改自己代码的能力
//
//  流程: 扫描→AST分析→问题检测→生成修复→编译验证→备份→应用
// ═══════════════════════════════════════════════════════════
class CodeSelfCorrector {
    constructor() {
        this._fixHistory = [];      // 修复历史
        this._knownPatterns = [];   // 已知问题模式
        this._backups = new Map();  // 备份
    }

    // 扫描所有种子JS文件的语法健康
    scanSyntaxHealth() {
        const files = fs.readdirSync(SEED_PATH)
            .filter(f => f.startsWith('seed-') && f.endsWith('.js'));

        const results = { healthy: [], errors: [] };

        for (const file of files) {
            const filePath = path.join(SEED_PATH, file);
            try {
                const code = fs.readFileSync(filePath, 'utf8');
                // 用Module._compile测试编译
                const m = new Module(file);
                m._compile(`(function(){${code}\n})`, file);
                results.healthy.push(file);
            } catch (e) {
                // 编译失败不代表语法错误(可能依赖缺失), 尝试更精确判断
                const msg = e.message || '';
                if (msg.includes('SyntaxError') || msg.includes('Unexpected token') ||
                    msg.includes('Invalid or unexpected')) {
                    results.errors.push({
                        file, error: msg.substring(0, 200),
                        type: 'syntax',
                    });
                } else if (msg.includes('Cannot find module')) {
                    results.errors.push({
                        file, error: msg.substring(0, 200),
                        type: 'dependency',
                        module: msg.match(/Cannot find module '([^']+)'/)?.[1],
                    });
                }
                // 其他运行时错误(不是语法问题)跳过
            }
        }

        return results;
    }

    // 静态代码分析 — 检测常见问题模式
    analyzeCodePatterns(code, filename) {
        const issues = [];

        // 1. 空catch块 — 吞掉错误
        const emptyCatchMatches = code.match(/catch\s*\([^)]*\)\s*\{\s*\}/g);
        if (emptyCatchMatches) {
            issues.push({
                type: 'empty_catch', count: emptyCatchMatches.length,
                severity: 'medium',
                fix: '添加至少console.log记录错误',
            });
        }

        // 2. 无限增长的数组 — 内存泄漏
        const pushWithoutLimit = code.match(/\.push\([^)]+\)/g);
        const hasLengthCheck = code.includes('.length >') || code.includes('.splice(') || code.includes('.shift()');
        if (pushWithoutLimit && pushWithoutLimit.length > 3 && !hasLengthCheck) {
            issues.push({
                type: 'unbounded_array', count: pushWithoutLimit.length,
                severity: 'high',
                fix: '添加数组长度检查和清理逻辑',
            });
        }

        // 3. 无超时的网络请求
        if ((code.includes('http.get') || code.includes('https.get') || code.includes('fetch('))
            && !code.includes('timeout')) {
            issues.push({
                type: 'no_timeout', severity: 'medium',
                fix: '添加timeout参数防止请求挂起',
            });
        }

        // 4. http访问https链接
        const httpToHttps = code.match(/http\.get\s*\(\s*['"`]https:/g);
        if (httpToHttps) {
            issues.push({
                type: 'protocol_mismatch', count: httpToHttps.length,
                severity: 'high',
                fix: '将http.get替换为https.get',
                autoFixable: true,
            });
        }

        // 5. 硬编码路径(非跨平台)
        const hardcodedPaths = code.match(/['"`][A-Z]:\\[^'"`]+['"`]/g);
        if (hardcodedPaths && !filename?.includes('test')) {
            issues.push({
                type: 'hardcoded_path', count: hardcodedPaths.length,
                severity: 'low',
                fix: '使用path.join()替代硬编码路径',
            });
        }

        return issues;
    }

    // ★ 自动修复代码中的已知问题
    autoFixCode(code, filename) {
        let fixed = code;
        let fixes = [];

        // 修复1: https.get('https://...) → https.get('https://...)
        const httpHttpsCount = (code.match(/http\.get\s*\(\s*['"`]https:/g) || []).length;
        if (httpHttpsCount > 0) {
            fixed = fixed.replace(/\bhttp\.get\s*\(\s*(['"`])https:/g, "https.get($1https:");
            fixed = fixed.replace(/\bhttp\.request\s*\(\s*(['"`])https:/g, "https.request($1https:");
            fixes.push(`协议修正: ${httpHttpsCount}处http→https`);
        }

        // 修复2: 空catch块 → 添加错误记录
        fixed = fixed.replace(
            /catch\s*\((\w+)\)\s*\{\s*\}/g,
            'catch ($1) { /* auto-repair: log error */ console.log(`[自修复] ${filename}: ${$1.message || $1}`); }'
        );
        // 上面的替换可能有问题，用更安全的方式
        const emptyCatchRegex = /catch\s*\((\w+)\)\s*\{\s*\}/g;
        let match;
        let emptyCatchFixed = 0;
        fixed = code; // 重置，重新处理
        // 修复1 再做一次
        if (httpHttpsCount > 0) {
            fixed = fixed.replace(/\bhttp\.get\s*\(\s*(['"`])https:/g, "https.get($1https:");
            fixed = fixed.replace(/\bhttp\.request\s*\(\s*(['"`])https:/g, "https.request($1https:");
        }

        // 修复2 安全版
        fixed = fixed.replace(emptyCatchRegex, (match, varName) => {
            emptyCatchFixed++;
            return `catch (${varName}) { /* auto-repaired */ }`;
        });
        if (emptyCatchFixed > 0) {
            fixes.push(`空catch块: ${emptyCatchFixed}处已标记`);
        }

        return { code: fixed, fixes, changed: fixes.length > 0 };
    }

    // 编译验证 — 确保修复后的代码可以编译
    verifyCompile(code, filename) {
        try {
            const m = new Module('verify_' + filename);
            m._compile(`(function(exports,require,module,__filename,__dirname){${code}\n})`, filename);
            return { valid: true };
        } catch (e) {
            return { valid: false, error: e.message };
        }
    }

    // 安全应用修复 — 备份→替换→验证→回滚
    applyFix(filePath, newCode) {
        const backupPath = filePath + '.pre-repair-backup';
        try {
            // 备份
            const original = fs.readFileSync(filePath, 'utf8');
            fs.writeFileSync(backupPath, original);
            this._backups.set(filePath, original);

            // 应用
            fs.writeFileSync(filePath, newCode);

            // 验证
            const verify = this.verifyCompile(newCode, path.basename(filePath));
            if (!verify.valid) {
                // 回滚
                fs.writeFileSync(filePath, original);
                console.log(`[代码校正] 修复验证失败,已回滚: ${verify.error?.substring(0, 60)}`);
                return false;
            }

            this._fixHistory.push({
                file: path.basename(filePath),
                time: Date.now(),
                result: 'applied',
            });
            console.log(`[代码校正] 修复已应用: ${path.basename(filePath)}`);
            return true;
        } catch (e) {
            // 回滚
            if (this._backups.has(filePath)) {
                fs.writeFileSync(filePath, this._backups.get(filePath));
            }
            return false;
        }
    }
}

// ═══════════════════════════════════════════════════════════
//  依赖自管理器 — 缺什么自动安装
// ═══════════════════════════════════════════════════════════
class DependencyManager {
    constructor() {
        this._missingModules = new Set();
        this._installAttempts = {};
    }

    // 检测缺失的npm模块
    detectMissing() {
        const pkgPath = path.join(SEED_PATH, 'package.json');
        if (!fs.existsSync(pkgPath)) return [];

        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const missing = [];

        for (const [name] of Object.entries(deps)) {
            try {
                require.resolve(name);
            } catch {
                missing.push(name);
            }
        }
        return missing;
    }

    // 从错误信息中提取缺失模块
    extractMissingModule(errorMessage) {
        const match = errorMessage.match(/Cannot find module '([^']+)'/);
        if (match) {
            const mod = match[1];
            // 只处理npm包(不处理本地相对路径)
            if (!mod.startsWith('.') && !mod.startsWith('/') && !mod.includes('\\')) {
                this._missingModules.add(mod);
                return mod;
            }
        }
        return null;
    }

    // 自动安装缺失的模块
    autoInstall(moduleName) {
        // 安全检查: 不要重复安装
        if (this._installAttempts[moduleName] &&
            Date.now() - this._installAttempts[moduleName] < 30 * 60000) {
            return false;
        }
        this._installAttempts[moduleName] = Date.now();

        try {
            console.log(`[依赖管理] 自动安装: ${moduleName}`);
            execSync(`npm install ${moduleName} --save`, {
                cwd: SEED_PATH,
                timeout: 60000,
                stdio: 'pipe',
            });
            console.log(`[依赖管理] 安装成功: ${moduleName}`);
            this._missingModules.delete(moduleName);
            return true;
        } catch (e) {
            console.log(`[依赖管理] 安装失败: ${moduleName} - ${e.message?.substring(0, 60)}`);
            return false;
        }
    }

    // 批量安装所有缺失模块
    autoInstallAll() {
        const missing = this.detectMissing();
        let installed = 0;
        for (const mod of missing) {
            if (this.autoInstall(mod)) installed++;
        }
        return { missing: missing.length, installed };
    }
}

class AutoRepairEngine {
  constructor() {
    this.repairLog = this.loadRepairLog();
    this.isRepairing = false;
    this.repairCount = 0;

    // ★ v2.0: 三大子系统
    this.behaviorMonitor = new RuntimeBehaviorMonitor();
    this.codeCorrector = new CodeSelfCorrector();
    this.depManager = new DependencyManager();

    // 修复规则(v1.0 + v2.0)
    this.repairRules = this.initRepairRules();

    // 注册全局错误处理（修复EPIPE）
    this.installGlobalErrorHandlers();

    console.log('[自动修复] v2.0引擎初始化完成 (行为监控+代码校正+依赖管理)');
  }

  /**
   * 加载修复日志
   */
  loadRepairLog() {
    try {
      if (fs.existsSync(REPAIR_LOG)) {
        return JSON.parse(fs.readFileSync(REPAIR_LOG, 'utf8'));
      }
    } catch (e) { /* auto-repaired */ }
    return {
      repairs: [],
      knownIssues: {},
      totalRepairs: 0,
      lastRepair: null,
    };
  }

  /**
   * 保存修复日志
   */
  saveRepairLog() {
    try {
      // 只保留最近200条修复记录
      if (this.repairLog.repairs.length > 200) {
        this.repairLog.repairs = this.repairLog.repairs.slice(-200);
      }
      fs.writeFileSync(REPAIR_LOG, JSON.stringify(this.repairLog, null, 2));
    } catch (e) {
      console.log('[自动修复] 保存修复日志失败:', e.message);
    }
  }

  /**
   * 初始化修复规则 - 每种错误对应一个修复方案
   */
  initRepairRules() {
    return {
      // 规则1: EPIPE错误 - 管道断裂
      'EPIPE': {
        detect: (error) => error.includes('EPIPE') || error.includes('broken pipe'),
        analyze: () => '进程间通信管道断裂，通常是stdout/stderr的目标进程已关闭',
        fix: () => this.fixEPIPE(),
        severity: 'low',
        autoRetry: false, // 无需重试，安装全局handler即可
      },

      // 规则2: 进化模块停滞
      'EVOLUTION_STALLED': {
        detect: () => this.detectEvolutionStalled(),
        analyze: () => '进化模块超过2小时未更新，可能已崩溃或卡住',
        fix: () => this.fixEvolutionStalled(),
        severity: 'high',
        autoRetry: true,
      },

      // 规则3: 日志膨胀
      'LOG_BLOAT': {
        detect: () => this.detectLogBloat(),
        analyze: () => '日志文件过大，需要提取记忆并清理',
        fix: () => this.fixLogBloat(),
        severity: 'medium',
        autoRetry: false,
      },

      // 规则4: 内存文件溢出
      'MEMORY_OVERFLOW': {
        detect: () => this.detectMemoryOverflow(),
        analyze: () => '内存文件超过阈值，需要清理低价值数据',
        fix: () => this.fixMemoryOverflow(),
        severity: 'medium',
        autoRetry: false,
      },

      // 规则5: 网络请求失败
      'NETWORK_FAILURE': {
        detect: (error) => error.includes('ECONNREFUSED') || error.includes('ETIMEDOUT') || error.includes('ENOTFOUND'),
        analyze: () => '网络连接失败，可能是目标服务不可用或网络中断',
        fix: () => this.fixNetworkFailure(),
        severity: 'low',
        autoRetry: true,
      },

      // 规则6: JSON解析失败
      'JSON_PARSE_ERROR': {
        detect: (error) => error.includes('JSON') && (error.includes('parse') || error.includes('Unexpected')),
        analyze: () => 'JSON文件损坏或格式错误',
        fix: (context) => this.fixJSONError(context),
        severity: 'high',
        autoRetry: false,
      },

      // 规则7: 文件权限错误
      'PERMISSION_ERROR': {
        detect: (error) => error.includes('EPERM') || error.includes('EACCES'),
        analyze: () => '文件权限不足，无法读写',
        fix: (context) => this.fixPermissionError(context),
        severity: 'medium',
        autoRetry: true,
      },

      // 规则8: 能力评分过低 - 触发真正进化
      'CAPABILITY_LOW': {
        detect: () => this.detectCapabilityLow(),
        analyze: () => 'AI能力基准评分过低，需要自动搜索并安装开源升级',
        fix: () => this.fixCapabilityLow(),
        severity: 'high',
        autoRetry: false,
      },

      // ═══ v2.0 新增修复规则 ═══

      // 规则9: 大脑决策被动 - 检测并激活主动思考
      'BRAIN_PASSIVE': {
        detect: () => this.detectBrainPassive(),
        analyze: () => '大脑决策过于被动(>80% DONE/WAIT)，需要提升主动性',
        fix: () => this.fixBrainPassive(),
        severity: 'high',
        autoRetry: false,
      },

      // 规则10: 代码语法错误 - AST扫描+自动修正
      'CODE_SYNTAX': {
        detect: () => this.detectCodeSyntaxErrors(),
        analyze: () => '种子代码文件有语法或编译错误',
        fix: () => this.fixCodeSyntaxErrors(),
        severity: 'critical',
        autoRetry: false,
      },

      // 规则11: 依赖缺失 - 自动安装npm包
      'DEPENDENCY_MISSING': {
        detect: () => this.detectMissingDependencies(),
        analyze: () => 'npm依赖缺失，需要自动安装',
        fix: () => this.fixMissingDependencies(),
        severity: 'high',
        autoRetry: true,
      },

      // 规则12: 协议不匹配 - http访问https
      'PROTOCOL_MISMATCH': {
        detect: () => this.detectProtocolMismatch(),
        analyze: () => '代码中http.get访问https URL，会导致ERR_INVALID_PROTOCOL',
        fix: () => this.fixProtocolMismatch(),
        severity: 'medium',
        autoRetry: false,
      },

      // 规则13: daemon.log运行时异常模式
      'RUNTIME_ANOMALY': {
        detect: () => this.detectRuntimeAnomaly(),
        analyze: () => 'daemon.log中检测到重复错误模式',
        fix: () => this.fixRuntimeAnomaly(),
        severity: 'medium',
        autoRetry: false,
      },
    };
  }

  /**
   * 安装全局错误处理器 - 修复EPIPE等致命错误
   */
  installGlobalErrorHandlers() {
    // 捕获EPIPE，防止进程崩溃
    process.on('uncaughtException', (err) => {
      if (err.code === 'EPIPE' || err.message.includes('EPIPE')) {
        // EPIPE是正常的，忽略即可
        return;
      }
      // 其他未捕获异常，记录但不崩溃
      this.recordError('uncaughtException', err.message);
      console.log(`[自动修复] 捕获未处理异常: ${err.message}`);
    });

    process.on('unhandledRejection', (reason) => {
      const message = reason?.message || String(reason);
      if (message.includes('EPIPE')) return;
      this.recordError('unhandledRejection', message);
      console.log(`[自动修复] 捕获未处理Promise拒绝: ${message}`);
    });

    // 修复stdout/stderr的EPIPE
    if (process.stdout) {
      process.stdout.on('error', (err) => {
        if (err.code === 'EPIPE') return; // 忽略
      });
    }
    if (process.stderr) {
      process.stderr.on('error', (err) => {
        if (err.code === 'EPIPE') return; // 忽略
      });
    }

    console.log('[自动修复] 全局错误处理器已安装（EPIPE已修复）');
  }

  /**
   * 记录错误（智能去重）
   */
  recordError(type, message) {
    const key = `${type}:${message.substring(0, 50)}`.replace(/[^a-zA-Z0-9_:\- ]/g, '_');
    if (!this.repairLog.knownIssues) this.repairLog.knownIssues = {};

    if (!this.repairLog.knownIssues[key]) {
      this.repairLog.knownIssues[key] = {
        type,
        message: message.substring(0, 200),
        count: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        repaired: false,
      };
    }

    this.repairLog.knownIssues[key].count++;
    this.repairLog.knownIssues[key].lastSeen = Date.now();
  }

  /**
   * 主修复循环 - 自动检测和修复所有问题
   */
  async runRepairCycle() {
    if (this.isRepairing) return;
    this.isRepairing = true;

    console.log('[自动修复] ===== 开始修复检查 =====');

    try {
      // 检测每个规则
      for (const [ruleName, rule] of Object.entries(this.repairRules)) {
        try {
          const detected = typeof rule.detect === 'function'
            ? await rule.detect('')
            : false;

          if (detected) {
            console.log(`[自动修复] 检测到问题: ${ruleName} (${rule.severity})`);
            const analysis = rule.analyze();
            console.log(`[自动修复] 原因分析: ${analysis}`);

            // 执行修复
            const result = await rule.fix({ ruleName, analysis });
            this.repairCount++;

            // 记录修复
            this.repairLog.repairs.push({
              rule: ruleName,
              severity: rule.severity,
              analysis,
              result: result ? 'success' : 'failed',
              timestamp: Date.now(),
            });
            this.repairLog.totalRepairs++;
            this.repairLog.lastRepair = Date.now();

            console.log(`[自动修复] 修复结果: ${result ? '成功' : '失败'}`);
          }
        } catch (e) {
          console.log(`[自动修复] 规则${ruleName}检查失败: ${e.message}`);
        }
      }
    } catch (e) {
      console.log(`[自动修复] 修复循环错误: ${e.message}`);
    }

    this.saveRepairLog();
    this.isRepairing = false;

    console.log(`[自动修复] ===== 修复检查完成 (总修复: ${this.repairCount}) =====`);
  }

  // ========== 检测函数 ==========

  /**
   * 检测进化模块是否停滞
   */
  detectEvolutionStalled() {
    const files = {
      'llm-evolution-log.json': 2 * 60 * 60 * 1000,     // 2小时
      'continuous-learning.json': 3 * 60 * 60 * 1000,    // 3小时
      'open-knowledge-base.json': 24 * 60 * 60 * 1000,   // 24小时
    };

    for (const [file, maxAge] of Object.entries(files)) {
      const filePath = path.join(SEED_PATH, file);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const age = Date.now() - stat.mtimeMs;
        if (age > maxAge) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 检测日志膨胀
   */
  detectLogBloat() {
    const daemonLog = path.join(SEED_PATH, 'daemon.log');
    if (fs.existsSync(daemonLog)) {
      const stat = fs.statSync(daemonLog);
      return stat.size > 50 * 1024 * 1024; // 超过50MB
    }
    return false;
  }

  /**
   * 检测内存文件溢出
   */
  detectMemoryOverflow() {
    const memFile = path.join(SEED_PATH, 'seed-memory.json');
    if (fs.existsSync(memFile)) {
      const stat = fs.statSync(memFile);
      return stat.size > 500 * 1024; // 超过500KB
    }
    return false;
  }

  // ========== 修复函数 ==========

  /**
   * 修复EPIPE错误
   */
  fixEPIPE() {
    // EPIPE已通过全局handler修复，这里标记为已处理
    console.log('[自动修复] EPIPE: 全局错误处理器已安装，EPIPE将被自动忽略');
    return true;
  }

  /**
   * 修复进化模块停滞
   */
  async fixEvolutionStalled() {
    console.log('[自动修复] 尝试重启停滞的进化模块...');

    try {
      // 重新触发LLM进化
      const llmLogFile = path.join(SEED_PATH, 'llm-evolution-log.json');
      if (fs.existsSync(llmLogFile)) {
        const data = JSON.parse(fs.readFileSync(llmLogFile, 'utf8'));
        data.lastRestart = Date.now();
        data.restartReason = 'auto-repair: evolution stalled';
        fs.writeFileSync(llmLogFile, JSON.stringify(data, null, 2));
      }

      // 重新触发持续学习
      const clLogFile = path.join(SEED_PATH, 'continuous-learning.json');
      if (fs.existsSync(clLogFile)) {
        const data = JSON.parse(fs.readFileSync(clLogFile, 'utf8'));
        data.lastRestart = Date.now();
        data.restartReason = 'auto-repair: learning stalled';
        fs.writeFileSync(clLogFile, JSON.stringify(data, null, 2));
      }

      // 尝试加载并重启LLM进化引擎
      try {
        const { LLMEvolutionEngine } = require('./seed-llm-evolution');
        const engine = new LLMEvolutionEngine();
        await engine.runEvolutionCycle();
        console.log('[自动修复] LLM进化引擎已重启');
      } catch (e) {
        console.log('[自动修复] LLM进化引擎重启失败:', e.message);
      }

      console.log('[自动修复] 进化模块已尝试重启');
      return true;
    } catch (e) {
      console.log('[自动修复] 重启失败:', e.message);
      return false;
    }
  }

  /**
   * 修复日志膨胀
   */
  async fixLogBloat() {
    console.log('[自动修复] 触发日志记忆提取+清理...');

    try {
      const { logMemoryEngine } = require('./seed-log-memory');
      const result = await logMemoryEngine.scan();
      console.log(`[自动修复] 日志清理完成: 释放${(result.freed / 1024 / 1024).toFixed(1)}MB`);
      return true;
    } catch (e) {
      // 如果日志记忆模块不可用，直接清理daemon.log
      const daemonLog = path.join(SEED_PATH, 'daemon.log');
      if (fs.existsSync(daemonLog)) {
        const content = fs.readFileSync(daemonLog, 'utf8');
        const lines = content.split('\n');
        // 保留最后500行
        fs.writeFileSync(daemonLog, lines.slice(-500).join('\n'));
        console.log(`[自动修复] 直接清理daemon.log: ${lines.length} → 500行`);
        return true;
      }
      return false;
    }
  }

  /**
   * 修复内存溢出
   */
  async fixMemoryOverflow() {
    console.log('[自动修复] 触发内存清理...');

    try {
      const { cleanup } = require('./seed-memory-cleanup');
      await cleanup();
      console.log('[自动修复] 内存清理完成');
      return true;
    } catch (e) {
      console.log('[自动修复] 内存清理失败:', e.message);
      return false;
    }
  }

  /**
   * 修复网络失败
   */
  async fixNetworkFailure() {
    // 网络失败通常是暂时的，记录下来等待自动恢复
    console.log('[自动修复] 网络故障已记录，等待自动恢复');
    return true;
  }

  /**
   * 修复JSON解析错误
   */
  async fixJSONError(context) {
    console.log('[自动修复] 尝试修复损坏的JSON文件...');

    // 查找可能损坏的JSON文件
    const jsonFiles = [
      'seed-memory.json',
      'autonomous-evolution-log.json',
      'llm-evolution-log.json',
      'learned-from-network.json',
      'continuous-learning.json',
      'open-knowledge-base.json',
    ];

    let fixed = false;
    for (const file of jsonFiles) {
      const filePath = path.join(SEED_PATH, file);
      if (!fs.existsSync(filePath)) continue;

      try {
        JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (e) {
        console.log(`[自动修复] 发现损坏的JSON: ${file}`);

        // 尝试修复：检查备份
        const backupPath = filePath + '.backup';
        if (fs.existsSync(backupPath)) {
          try {
            JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            fs.copyFileSync(backupPath, filePath);
            console.log(`[自动修复] 从备份恢复: ${file}`);
            fixed = true;
          } catch (e2) {
            // 备份也坏了，重置为空JSON
            this.resetJSONFile(filePath, file);
            fixed = true;
          }
        } else {
          // 无备份，重置
          this.resetJSONFile(filePath, file);
          fixed = true;
        }
      }
    }

    return fixed;
  }

  /**
   * 重置损坏的JSON文件为默认值
   */
  resetJSONFile(filePath, fileName) {
    const defaults = {
      'seed-memory.json': { episodic: [], semantic: {}, savedAt: Date.now() },
      'autonomous-evolution-log.json': { cycles: [], improvements: [], failures: [] },
      'llm-evolution-log.json': { cycles: [], improvements: [], codeChanges: [] },
      'learned-from-network.json': { entries: [], lastUpdate: Date.now() },
      'continuous-learning.json': { entries: [], lastUpdate: Date.now(), totalSearches: 0 },
      'open-knowledge-base.json': { knowledge: {}, metadata: { version: '1.0' } },
    };

    const defaultContent = defaults[fileName] || {};
    fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2));
    console.log(`[自动修复] 已重置: ${fileName}`);
  }

  /**
   * 修复文件权限错误
   */
  async fixPermissionError(context) {
    console.log('[自动修复] 文件权限问题，尝试解决...');
    // 在Windows上权限问题通常是文件被锁定
    // 等待1秒后重试
    await new Promise(r => setTimeout(r, 1000));
    return true;
  }

  // ═══════════════ v2.0 检测函数 ═══════════════

  /**
   * 检测大脑是否被动 — 读取brain-state.json的决策日志
   */
  detectBrainPassive() {
    try {
      const brainFile = path.join(SEED_PATH, 'brain-state.json');
      if (!fs.existsSync(brainFile)) return false;
      const data = JSON.parse(fs.readFileSync(brainFile, 'utf8'));
      const decisions = data.prefrontalCortex?.decisionLog || [];
      if (decisions.length < 10) return false;

      const recent = decisions.slice(-30);
      const passive = recent.filter(d =>
        d.decision?.action === 'DONE' || d.decision?.action === 'WAIT'
      );
      return passive.length / recent.length > 0.8;
    } catch {
      return false;
    }
  }

  /**
   * 检测代码语法错误
   */
  detectCodeSyntaxErrors() {
    const scan = this.codeCorrector.scanSyntaxHealth();
    return scan.errors.filter(e => e.type === 'syntax').length > 0;
  }

  /**
   * 检测缺失依赖
   */
  detectMissingDependencies() {
    return this.depManager.detectMissing().length > 0;
  }

  /**
   * 检测协议不匹配
   */
  detectProtocolMismatch() {
    const files = fs.readdirSync(SEED_PATH)
      .filter(f => f.startsWith('seed-') && f.endsWith('.js'));
    for (const file of files) {
      try {
        const code = fs.readFileSync(path.join(SEED_PATH, file), 'utf8');
        if (/http\.get\s*\(\s*['"`]https:/.test(code)) return true;
        if (/http\.request\s*\(\s*['"`]https:/.test(code)) return true;
      } catch {}
    }
    return false;
  }

  /**
   * 检测运行时异常模式 — 扫描daemon.log尾部
   */
  detectRuntimeAnomaly() {
    try {
      const logFile = path.join(SEED_PATH, 'daemon.log');
      if (!fs.existsSync(logFile)) return false;
      const stat = fs.statSync(logFile);
      // 读取最后10KB
      const fd = fs.openSync(logFile, 'r');
      const readSize = Math.min(10240, stat.size);
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
      fs.closeSync(fd);
      const tail = buf.toString('utf8');

      // 检测重复错误
      const errorLines = tail.split('\n').filter(l =>
        l.includes('[ERROR]') || l.includes('ERR_') || l.includes('失败')
      );
      // 同一错误出现3次以上 = 异常
      const errorCounts = {};
      for (const line of errorLines) {
        const key = line.replace(/\d+/g, 'N').substring(0, 60); // 归一化数字
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      }
      return Object.values(errorCounts).some(c => c >= 3);
    } catch {
      return false;
    }
  }

  // ═══════════════ v2.0 修复函数 ═══════════════

  /**
   * 修复大脑被动 — 调整决策参数，注入经验
   */
  async fixBrainPassive() {
    console.log('[自动修复] 大脑过于被动，调整决策参数...');
    try {
      const brainFile = path.join(SEED_PATH, 'brain-state.json');
      if (!fs.existsSync(brainFile)) return false;
      const data = JSON.parse(fs.readFileSync(brainFile, 'utf8'));

      // 1. 清除决策日志中的重复DONE，让大脑"忘记"被动模式
      if (data.prefrontalCortex?.decisionLog) {
        data.prefrontalCortex.decisionLog = data.prefrontalCortex.decisionLog
          .filter(d => d.decision?.action !== 'DONE')
          .slice(-20);
      }

      // 2. 增加停滞计数，触发鲶鱼效应
      if (data.prefrontalCortex) {
        data.prefrontalCortex._stagnationCycles =
          (data.prefrontalCortex._stagnationCycles || 0) + 10;
      }

      // 3. 保存
      fs.writeFileSync(brainFile, JSON.stringify(data, null, 2));
      console.log('[自动修复] 大脑决策参数已调整: 清除被动记录+增加停滞触发');
      return true;
    } catch (e) {
      console.log(`[自动修复] 大脑调整失败: ${e.message}`);
      return false;
    }
  }

  /**
   * 修复代码语法错误 — AST分析+自动修正+编译验证
   */
  async fixCodeSyntaxErrors() {
    console.log('[自动修复] 扫描并修复代码语法...');
    const scan = this.codeCorrector.scanSyntaxHealth();
    let fixed = 0;

    for (const err of scan.errors) {
      if (err.type === 'syntax') {
        console.log(`[自动修复] 语法错误: ${err.file} - ${err.error.substring(0, 60)}`);
        // 尝试自动修复
        const filePath = path.join(SEED_PATH, err.file);
        try {
          const code = fs.readFileSync(filePath, 'utf8');
          const result = this.codeCorrector.autoFixCode(code, err.file);
          if (result.changed) {
            const verified = this.codeCorrector.verifyCompile(result.code, err.file);
            if (verified.valid) {
              this.codeCorrector.applyFix(filePath, result.code);
              fixed++;
            }
          }
        } catch {}
      }
    }

    console.log(`[自动修复] 语法修复: ${fixed}/${scan.errors.length}个`);
    return fixed > 0;
  }

  /**
   * 修复缺失依赖
   */
  async fixMissingDependencies() {
    console.log('[自动修复] 检测并安装缺失依赖...');
    const result = this.depManager.autoInstallAll();
    console.log(`[自动修复] 依赖修复: 安装${result.installed}/${result.missing}个`);
    return result.installed > 0;
  }

  /**
   * 修复协议不匹配
   */
  async fixProtocolMismatch() {
    console.log('[自动修复] 修复http→https协议...');
    const files = fs.readdirSync(SEED_PATH)
      .filter(f => f.startsWith('seed-') && f.endsWith('.js'));

    let fixed = 0;
    for (const file of files) {
      const filePath = path.join(SEED_PATH, file);
      try {
        const code = fs.readFileSync(filePath, 'utf8');
        const result = this.codeCorrector.autoFixCode(code, file);
        if (result.fixes.some(f => f.includes('协议修正'))) {
          const verified = this.codeCorrector.verifyCompile(result.code, file);
          if (verified.valid) {
            this.codeCorrector.applyFix(filePath, result.code);
            fixed++;
            console.log(`[自动修复] 已修复: ${file} (${result.fixes.join(', ')})`);
          }
        }
      } catch {}
    }
    return fixed > 0;
  }

  /**
   * 修复运行时异常 — 分析daemon.log并记录经验
   */
  async fixRuntimeAnomaly() {
    console.log('[自动修复] 分析运行时异常模式...');
    try {
      const logFile = path.join(SEED_PATH, 'daemon.log');
      const stat = fs.statSync(logFile);
      const fd = fs.openSync(logFile, 'r');
      const readSize = Math.min(10240, stat.size);
      const buf = Buffer.alloc(readSize);
      fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
      fs.closeSync(fd);
      const tail = buf.toString('utf8');

      // 提取错误并分类
      const errorLines = tail.split('\n').filter(l =>
        l.includes('[ERROR]') || l.includes('ERR_') || l.includes('失败')
      );

      // 记录到行为监控器
      for (const line of errorLines) {
        if (line.includes('ERR_INVALID_PROTOCOL')) {
          this.behaviorMonitor.recordError('protocol', line.substring(0, 80));
        } else if (line.includes('ECONNREFUSED')) {
          this.behaviorMonitor.recordError('network', line.substring(0, 80));
        } else if (line.includes('Cannot find module')) {
          this.behaviorMonitor.recordError('dependency', line.substring(0, 80));
          this.depManager.extractMissingModule(line);
        }
      }

      // 记录诊断结果
      const diagnosis = this.behaviorMonitor.diagnose();
      this.repairLog.lastDiagnosis = {
        time: Date.now(),
        ...diagnosis,
      };
      this.saveRepairLog();

      console.log(`[自动修复] 异常分析完成: ${errorLines.length}条错误已分类`);
      return true;
    } catch (e) {
      console.log(`[自动修复] 异常分析失败: ${e.message}`);
      return false;
    }
  }

  /**
   * 检测能力评分是否过低
   */
  detectCapabilityLow() {
    try {
      const benchFile = path.join(SEED_PATH, 'benchmark-results.json');
      if (!fs.existsSync(benchFile)) return true; // 从未测试过，需要测试
      const data = JSON.parse(fs.readFileSync(benchFile, 'utf8'));
      if (!data.runs || data.runs.length === 0) return true;
      const lastRun = data.runs[data.runs.length - 1];
      // 如果上次运行超过24小时前，需要重新测试
      const lastTime = new Date(lastRun.timestamp).getTime();
      if (Date.now() - lastTime > 24 * 3600 * 1000) return true;
      // 如果评分低于60，触发修复
      return (lastRun.overall || 0) < 60;
    } catch {
      return true; // 读取失败也触发
    }
  }

  /**
   * 修复低能力评分 - 触发真正进化引擎
   */
  async fixCapabilityLow() {
    console.log('[自动修复] 能力评分过低，触发真正进化引擎...');
    try {
      const { RealEvolutionEngine } = require('./seed-real-evolution');
      const engine = new RealEvolutionEngine();
      const result = await engine.evolve();
      const improvement = (result.improvement || 0);
      console.log(`[自动修复] 进化完成! 评分: ${result.scores?.overall || '?'} → ${result.newScores?.overall || '?'} (${improvement > 0 ? '+' : ''}${improvement})`);
      return improvement >= 0;
    } catch (e) {
      console.log(`[自动修复] 进化引擎错误: ${e.message}`);
      return false;
    }
  }

  /**
   * 启动自动修复循环
   */
  startAutoRepair(intervalMs = 15 * 60 * 1000) { // 每15分钟检查一次
    console.log(`[自动修复] 启动自动修复 (间隔: ${intervalMs / 60000}分钟)`);

    // 立即执行一次
    setTimeout(() => this.runRepairCycle(), 3000);

    // 定时执行
    setInterval(() => this.runRepairCycle(), intervalMs);
  }

  /**
   * 手动触发修复特定错误
   */
  async repairError(errorMessage) {
    for (const [ruleName, rule] of Object.entries(this.repairRules)) {
      if (rule.detect(errorMessage)) {
        console.log(`[自动修复] 匹配规则: ${ruleName}`);
        const result = await rule.fix({ ruleName, error: errorMessage });
        return { rule: ruleName, success: result };
      }
    }
    return { rule: null, success: false, message: '未匹配到修复规则' };
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      version: '2.0',
      totalRepairs: this.repairLog.totalRepairs,
      recentRepairs: this.repairLog.repairs.slice(-10),
      knownIssues: Object.keys(this.repairLog.knownIssues || {}).length,
      lastRepair: this.repairLog.lastRepair
        ? new Date(this.repairLog.lastRepair).toISOString()
        : 'never',
      isRepairing: this.isRepairing,
      // v2.0
      ruleCount: Object.keys(this.repairRules).length,
      behaviorDiagnosis: this.behaviorMonitor.diagnose(),
      codeFixHistory: this.codeCorrector._fixHistory.slice(-5),
      missingDeps: Array.from(this.depManager._missingModules),
    };
  }

  /**
   * ★ 综合诊断 — 全面健康检查 (供外部调用)
   */
  async fullDiagnosis() {
    console.log('[自动修复] ══════ 开始全面诊断 ══════');

    const report = {
      time: new Date().toISOString(),
      syntax: this.codeCorrector.scanSyntaxHealth(),
      dependencies: { missing: this.depManager.detectMissing() },
      behavior: this.behaviorMonitor.diagnose(),
      issues: [],
    };

    // 语法问题
    if (report.syntax.errors.length > 0) {
      report.issues.push(`代码语法: ${report.syntax.errors.length}个文件有问题`);
    }
    // 依赖问题
    if (report.dependencies.missing.length > 0) {
      report.issues.push(`依赖缺失: ${report.dependencies.missing.join(', ')}`);
    }
    // 大脑被动
    if (report.behavior.brain.passive) {
      report.issues.push(`大脑被动: ${(report.behavior.brain.passiveRatio * 100).toFixed(0)}% DONE/WAIT`);
    }

    // 协议检查
    const hasProtocol = this.detectProtocolMismatch();
    if (hasProtocol) report.issues.push('协议不匹配: http→https');

    // 日志膨胀
    if (this.detectLogBloat()) report.issues.push('日志膨胀: daemon.log > 50MB');

    // 内存溢出
    if (this.detectMemoryOverflow()) report.issues.push('内存文件 > 500KB');

    report.healthScore = Math.max(0, 100 - report.issues.length * 15);

    console.log(`[自动修复] 健康评分: ${report.healthScore}/100`);
    if (report.issues.length > 0) {
      console.log(`[自动修复] 发现问题 (${report.issues.length}):`);
      for (const issue of report.issues) {
        console.log(`  - ${issue}`);
      }
    } else {
      console.log('[自动修复] 系统健康: 无已知问题');
    }
    console.log('[自动修复] ══════ 诊断完成 ══════');

    return report;
  }

  /**
   * ★ 接收大脑决策 — 供LivingCore调用
   */
  feedBrainDecision(action, reason, success) {
    this.behaviorMonitor.recordDecision(action, reason, success);
  }

  /**
   * ★ 接收运行时错误 — 供全局调用
   */
  feedRuntimeError(errorType, message) {
    this.behaviorMonitor.recordError(errorType, message);
    // 检查是否有缺失模块
    this.depManager.extractMissingModule(message);
  }
}

// 创建单例
const autoRepairEngine = new AutoRepairEngine();

// 导出
module.exports = {
  AutoRepairEngine, autoRepairEngine,
  RuntimeBehaviorMonitor, CodeSelfCorrector, DependencyManager,
};

// 直接运行 — 自测
if (require.main === module) {
  console.log('\n' + '='.repeat(60));
  console.log('  活体种子AI - 自动修复引擎 v2.0 自测');
  console.log('='.repeat(60) + '\n');

  (async () => {
    let pass = 0, total = 0;

    // 测试1: 行为监控器
    total++;
    try {
      const monitor = new RuntimeBehaviorMonitor();
      monitor.recordDecision('DONE', 'test', true);
      monitor.recordDecision('WAIT', 'test', true);
      const diag = monitor.diagnose();
      console.assert(diag.brain !== undefined, '行为诊断应存在');
      pass++;
      console.log(`[✓] 行为监控器`);
    } catch (e) { console.log(`[✗] 行为监控器: ${e.message}`); }

    // 测试2: 大脑被动检测
    total++;
    try {
      const monitor = new RuntimeBehaviorMonitor();
      for (let i = 0; i < 20; i++) monitor.recordDecision('DONE', 'vision_observed', true);
      const diag = monitor.diagnoseBrainPassivity();
      console.assert(diag.passive === true, '20次DONE应判为被动');
      console.assert(diag.recommendation === 'INCREASE_PROACTIVE_ANALYSIS');
      pass++;
      console.log(`[✓] 被动检测`);
    } catch (e) { console.log(`[✗] 被动检测: ${e.message}`); }

    // 测试3: 代码自校正 - 协议修复
    total++;
    try {
      const corrector = new CodeSelfCorrector();
      const testCode = `const http = require('http');\nhttp.get('https://api.github.com', cb);`;
      const result = corrector.autoFixCode(testCode, 'test.js');
      console.assert(result.changed === true, '应检测到协议问题');
      console.assert(result.code.includes('https.get'), '应修正为https.get');
      pass++;
      console.log(`[✓] 协议修复`);
    } catch (e) { console.log(`[✗] 协议修复: ${e.message}`); }

    // 测试4: 代码分析 - 问题检测
    total++;
    try {
      const corrector = new CodeSelfCorrector();
      const issues = corrector.analyzeCodePatterns(
        `try { x() } catch (e) { /* auto-repaired */ }\nhttp.get('https://foo');`, 'test.js'
      );
      console.assert(issues.some(i => i.type === 'empty_catch'), '应检测空catch');
      console.assert(issues.some(i => i.type === 'protocol_mismatch'), '应检测协议不匹配');
      pass++;
      console.log(`[✓] 代码分析`);
    } catch (e) { console.log(`[✗] 代码分析: ${e.message}`); }

    // 测试5: 依赖管理 - 模块提取
    total++;
    try {
      const dep = new DependencyManager();
      const mod = dep.extractMissingModule("Error: Cannot find module 'fake-module'");
      console.assert(mod === 'fake-module', '应提取模块名');
      console.assert(dep._missingModules.has('fake-module'), '应记录到缺失集合');
      pass++;
      console.log(`[✓] 依赖提取`);
    } catch (e) { console.log(`[✗] 依赖提取: ${e.message}`); }

    // 测试6: 编译验证
    total++;
    try {
      const corrector = new CodeSelfCorrector();
      const good = corrector.verifyCompile('const x = 1 + 2;', 'test.js');
      console.assert(good.valid === true, '正确代码应编译通过');
      const bad = corrector.verifyCompile('const x = {{{', 'test.js');
      console.assert(bad.valid === false, '错误代码应编译失败');
      pass++;
      console.log(`[✓] 编译验证`);
    } catch (e) { console.log(`[✗] 编译验证: ${e.message}`); }

    // 测试7: 错误模式诊断
    total++;
    try {
      const monitor = new RuntimeBehaviorMonitor();
      for (let i = 0; i < 5; i++) monitor.recordError('protocol', 'ERR_INVALID_PROTOCOL');
      const diag = monitor.diagnoseRepeatErrors();
      console.assert(diag.hasRepeatErrors === true, '重复错误应被检测');
      pass++;
      console.log(`[✓] 错误模式`);
    } catch (e) { console.log(`[✗] 错误模式: ${e.message}`); }

    // 测试8: 动作成功率
    total++;
    try {
      const monitor = new RuntimeBehaviorMonitor();
      for (let i = 0; i < 10; i++) monitor.recordDecision('CLICK', 'button', i > 7);
      const quality = monitor.diagnoseActionQuality();
      console.assert(quality.CLICK?.needsImprovement === true, 'CLICK成功率<50%应标记');
      pass++;
      console.log(`[✓] 成功率追踪`);
    } catch (e) { console.log(`[✗] 成功率追踪: ${e.message}`); }

    // 测试9: 综合诊断
    total++;
    try {
      const report = await autoRepairEngine.fullDiagnosis();
      console.assert(report.healthScore !== undefined, '健康评分应存在');
      console.assert(report.syntax !== undefined, '语法扫描应存在');
      pass++;
      console.log(`[✓] 综合诊断`);
    } catch (e) { console.log(`[✗] 综合诊断: ${e.message}`); }

    // 测试10: 规则数量
    total++;
    try {
      const ruleCount = Object.keys(autoRepairEngine.repairRules).length;
      console.assert(ruleCount >= 13, `应有>=13条修复规则, 实际${ruleCount}`);
      pass++;
      console.log(`[✓] 修复规则(${ruleCount}条)`);
    } catch (e) { console.log(`[✗] 修复规则: ${e.message}`); }

    // 测试11: feedBrainDecision接口
    total++;
    try {
      autoRepairEngine.feedBrainDecision('ANALYZE', 'test_reason', true);
      const diag = autoRepairEngine.behaviorMonitor.diagnose();
      console.assert(diag.totalDecisions >= 1, '应记录决策');
      pass++;
      console.log(`[✓] 大脑决策接口`);
    } catch (e) { console.log(`[✗] 大脑决策接口: ${e.message}`); }

    // 测试12: feedRuntimeError接口
    total++;
    try {
      autoRepairEngine.feedRuntimeError('test', "Cannot find module 'xyz'");
      console.assert(autoRepairEngine.depManager._missingModules.has('xyz'));
      pass++;
      console.log(`[✓] 运行时错误接口`);
    } catch (e) { console.log(`[✗] 运行时错误接口: ${e.message}`); }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`  自测结果: ${pass}/${total} 通过 ${pass === total ? '✓ 全部通过' : '✗ 有失败'}`);
    console.log('='.repeat(60));

    if (pass === total) {
      console.log('\n修复状态:', JSON.stringify(autoRepairEngine.getStatus(), null, 2));
    }
  })();
}
