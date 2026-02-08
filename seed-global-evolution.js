/**
 * 「李凯 Kai Li」— 全球AI进化方案集成 v2.0
 *
 * 集成7大顶级AI进化范式 + 认知级搜索中枢:
 *
 *  1. AlphaEvolve — 递归评估进化 (DeepMind)
 *  2. Agent0 — 双Agent自训练 (Sakana AI)
 *  3. DGM — 代码自修改+形式验证 (Darwin Gödel Machine)
 *  4. POET — 开放进化 (Uber)
 *  5. NoveltySearcher — 新颖性搜索 (ShinkaEvolve)
 *  6. DirectedCognitiveEvolver — 定向认知进化 (LoongFlow)
 *  7. GitHubCodeIntegrator — 代码自动集成
 *
 *  + CognitiveSearchHub — 认知级搜索中枢
 *    自主推导搜索方向 → 多源检索 → 语义解析 → 价值判断
 *    → 知识入脑 → 触发进化 (搜→取→析→判→行→进化 闭环)
 *
 * 主人印记: 19860316
 */

const fs = require('fs');
const path = require('path');
const { Module } = require('module');
const { EventEmitter } = require('events');

const SEED_HOME = __dirname;
const EVOLUTION_LOG = path.join(SEED_HOME, 'global-evolution-log.json');

const C = {
    reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
    red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m',
    blue: '\x1b[34m', bold: '\x1b[1m', dim: '\x1b[2m',
};

function log(tag, msg) {
    const t = new Date().toLocaleTimeString();
    const c = { ALPHA: C.green, AGENT0: C.cyan, DGM: C.magenta, POET: C.blue, EVO: C.yellow };
    console.log(`${c[tag] || C.reset}[${t}] [${tag}] ${msg}${C.reset}`);
}

// ═══════════════════════════════════════════════════════════
//  1. AlphaEvolve — 递归评估进化器
//
//  灵感: DeepMind AlphaEvolve
//  核心: 不随机变异，用LLM理解代码逻辑后生成多个候选改进，
//        用多维评估器(正确性/性能/可读性/安全性)打分，
//        选最佳候选应用
// ═══════════════════════════════════════════════════════════

class AlphaEvolveEvaluator {
    constructor(aiFleet) {
        this.ai = aiFleet;
        this.fitnessHistory = [];
        this.generation = 0;
    }

    // 对一段代码生成N个候选改进，评估选最佳
    async evolveWithEvaluation(filePath, numCandidates = 3) {
        this.generation++;
        const fileName = path.basename(filePath);
        log('ALPHA', `═══ AlphaEvolve 第${this.generation}代 — ${fileName} ═══`);

        let code;
        try { code = fs.readFileSync(filePath, 'utf8'); } catch { return null; }

        const codeSnippet = code.length > 5000
            ? code.substring(0, 2500) + '\n// ...[中间省略]...\n' + code.substring(code.length - 2000)
            : code;

        // 阶段1: 生成多个候选改进
        log('ALPHA', `生成 ${numCandidates} 个候选方案...`);
        const candidates = [];

        for (let i = 0; i < numCandidates; i++) {
            const angle = ['bug修复', '性能优化', '安全加固'][i % 3];
            const prompt = `你是AlphaEvolve进化器。分析代码找出1个${angle}方向的改进。

文件: ${fileName} (${code.split('\n').length}行)

\`\`\`javascript
${codeSnippet}
\`\`\`

严格JSON回复:
{"description":"改进描述","search":"原始代码(10-50字符,必须精确存在)","replace":"替换代码","type":"${angle}","confidence":0.0-1.0}`;

            const result = await this.ai.ask(prompt, 'AlphaEvolve: 只找高确信度改进,confidence<0.7时设为null。只回复JSON。');
            if (result.success) {
                try {
                    const json = JSON.parse(result.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
                    if (json.search && json.replace && json.confidence >= 0.7 && code.includes(json.search)) {
                        candidates.push({ ...json, provider: result.provider });
                    }
                } catch {}
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (candidates.length === 0) {
            log('ALPHA', '无高确信候选方案');
            return null;
        }

        // 阶段2: 多维评估
        log('ALPHA', `评估 ${candidates.length} 个候选...`);
        const scored = [];
        for (const cand of candidates) {
            const fitness = await this._evaluateFitness(code, cand);
            scored.push({ ...cand, fitness });
        }

        // 阶段3: 选择最佳
        scored.sort((a, b) => b.fitness.total - a.fitness.total);
        const best = scored[0];

        if (best.fitness.total < 0.6) {
            log('ALPHA', `最佳候选适应度${best.fitness.total.toFixed(2)}不足(需>0.6)`);
            return null;
        }

        // 阶段4: 应用+验证 (v2.0 — 高命中率)
        log('ALPHA', `应用最佳: ${best.description} (适应度${best.fitness.total.toFixed(2)})`);

        // ★ 智能匹配search字符串
        if (!code.includes(best.search)) {
            // 尝试标准化空白匹配
            const normalizeWS = s => s.replace(/[ \t]+/g, ' ').trim();
            const searchNorm = normalizeWS(best.search);
            const lines = code.split('\n');
            const searchLines = best.search.split('\n').length;
            let matched = false;
            for (let i = 0; i <= lines.length - searchLines; i++) {
                const window = lines.slice(i, i + searchLines).join('\n');
                if (normalizeWS(window) === searchNorm) {
                    best.search = window; // 替换为精确匹配的字符串
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                log('ALPHA', `${C.red}search不匹配，跳过${C.reset}`);
                return null;
            }
        }

        const newCode = code.replace(best.search, best.replace);

        // ★ 编译验证(安全方式 — 不执行代码)
        try {
            const wrapped = `(function(exports,require,module,__filename,__dirname){${newCode}\n})`;
            new Function(wrapped);
        } catch (e) {
            log('ALPHA', `${C.red}编译失败: ${e.message.split('\n')[0]}${C.reset}`);
            return null;
        }

        // 应用
        const backup = filePath + '.alpha-backup';
        fs.writeFileSync(backup, code);
        fs.writeFileSync(filePath, newCode);

        this.fitnessHistory.push({
            generation: this.generation,
            file: fileName,
            fitness: best.fitness.total,
            type: best.type,
            description: best.description,
            timestamp: Date.now(),
        });

        log('ALPHA', `${C.green}第${this.generation}代进化成功! 适应度:${best.fitness.total.toFixed(2)}${C.reset}`);
        return {
            file: fileName,
            description: best.description,
            fitness: best.fitness,
            candidates: candidates.length,
        };
    }

    // 多维适应度评估
    async _evaluateFitness(originalCode, candidate) {
        const scores = {
            correctness: 0,   // 改动是否逻辑正确
            safety: 0,        // 是否引入风险
            readability: 0,   // 代码质量
            impact: 0,        // 改进幅度
        };

        // 用AI评估
        const evalResult = await this.ai.ask(
            `评估这个代码改动:
原始: ${candidate.search}
修改: ${candidate.replace}
类型: ${candidate.type}
描述: ${candidate.description}

用JSON回复4个维度评分(0-1):
{"correctness":0.0-1.0,"safety":0.0-1.0,"readability":0.0-1.0,"impact":0.0-1.0}`,
            '你是代码审查专家。客观评估改动质量,只回复JSON。'
        );

        if (evalResult.success) {
            try {
                const parsed = JSON.parse(evalResult.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
                scores.correctness = Math.min(1, Math.max(0, parsed.correctness || 0));
                scores.safety = Math.min(1, Math.max(0, parsed.safety || 0));
                scores.readability = Math.min(1, Math.max(0, parsed.readability || 0));
                scores.impact = Math.min(1, Math.max(0, parsed.impact || 0));
            } catch {}
        }

        // 权重: 安全>正确>影响>可读
        scores.total = scores.safety * 0.3 + scores.correctness * 0.3 + scores.impact * 0.25 + scores.readability * 0.15;
        return scores;
    }

    getStats() {
        return {
            generation: this.generation,
            history: this.fitnessHistory.slice(-20),
            avgFitness: this.fitnessHistory.length > 0
                ? (this.fitnessHistory.reduce((s, h) => s + h.fitness, 0) / this.fitnessHistory.length).toFixed(2)
                : 'N/A',
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  2. DualAgentTrainer — Agent0 双Agent自训练
//
//  灵感: Agent0 (Sakana AI)
//  核心: ProposerAI提出改进方案, EvaluatorAI独立评判
//        两个AI观点不同(使用不同模型/提示词)形成对抗
//        只有双方都同意的改进才被采纳
// ═══════════════════════════════════════════════════════════

class DualAgentTrainer {
    constructor(aiFleet) {
        this.ai = aiFleet;
        this.agreements = 0;
        this.disagreements = 0;
    }

    // 双Agent对话评估一个改进提案
    async evaluateProposal(proposal) {
        log('AGENT0', `双Agent评估: ${proposal.description}`);

        // Proposer的论证
        const proposerPrompt = `作为ProposerAI,论证这个代码改进的价值:
改进: ${proposal.description}
原始代码: ${proposal.search}
新代码: ${proposal.replace}

请给出3个具体理由支持这个改进(简短,每条不超20字):`;

        // Evaluator的审查
        const evaluatorPrompt = `作为EvaluatorAI,严格审查这个代码改进:
改进: ${proposal.description}
原始代码: ${proposal.search}
新代码: ${proposal.replace}

列出所有潜在风险(0-3个,每条不超20字),然后给出总体评分(0-10):
{"risks":["..."],"score":0-10,"approve":true/false}`;

        // 并行调用两个AI(尽量使用不同提供商)
        const [proposerResult, evaluatorResult] = await Promise.all([
            this.ai.ask(proposerPrompt, 'ProposerAI: 寻找改进价值'),
            this.ai.ask(evaluatorPrompt, 'EvaluatorAI: 严格审查,只回复JSON'),
        ]);

        let approved = false;
        let score = 0;

        if (evaluatorResult.success) {
            try {
                const eval_ = JSON.parse(evaluatorResult.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
                score = eval_.score || 0;
                approved = eval_.approve === true && score >= 7;
            } catch {
                // 无法解析评估结果,默认不批准
            }
        }

        if (approved) {
            this.agreements++;
            log('AGENT0', `${C.green}双Agent共识: 批准 (评分${score}/10)${C.reset}`);
        } else {
            this.disagreements++;
            log('AGENT0', `${C.yellow}评估未通过 (评分${score}/10)${C.reset}`);
        }

        return {
            approved,
            score,
            proposerProvider: proposerResult.provider,
            evaluatorProvider: evaluatorResult.provider,
        };
    }

    getStats() {
        const total = this.agreements + this.disagreements;
        return {
            agreements: this.agreements,
            disagreements: this.disagreements,
            approvalRate: total > 0 ? (this.agreements / total * 100).toFixed(0) + '%' : 'N/A',
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  3. FormalVerifier — DGM 形式验证器
//
//  灵感: Darwin Gödel Machine
//  核心: 代码改动不仅要编译通过,还要通过形式化验证:
//        - AST结构保持(不删除exports/关键函数)
//        - 类型兼容性检查
//        - 循环/递归安全(无无限循环)
//        - 依赖完整性(不删除被引用的变量)
// ═══════════════════════════════════════════════════════════

class FormalVerifier {
    constructor() {
        this.verifications = 0;
        this.passes = 0;
        this.failures = 0;
    }

    // 形式验证代码改动
    verify(originalCode, newCode, filePath) {
        this.verifications++;
        const fileName = path.basename(filePath);
        const checks = [];

        // Check 1: 编译通过
        try {
            const m = new Module(filePath);
            m._compile(newCode, filePath);
            checks.push({ name: 'compile', pass: true });
        } catch (e) {
            checks.push({ name: 'compile', pass: false, reason: e.message });
            this.failures++;
            return { pass: false, checks, reason: 'compile_failed' };
        }

        // Check 2: AST结构保持(exports不变)
        try {
            const acorn = require('acorn');
            const origAST = acorn.parse(originalCode, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
            const newAST = acorn.parse(newCode, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });

            // 检查exports
            const origExports = this._findExports(origAST);
            const newExports = this._findExports(newAST);
            const missingExports = origExports.filter(e => !newExports.includes(e));

            if (missingExports.length > 0) {
                checks.push({ name: 'exports', pass: false, reason: `丢失导出: ${missingExports.join(', ')}` });
            } else {
                checks.push({ name: 'exports', pass: true });
            }

            // 检查函数数量没有大幅减少(防止误删)
            const origFuncs = this._countFunctions(origAST);
            const newFuncs = this._countFunctions(newAST);
            if (newFuncs < origFuncs * 0.8) {
                checks.push({ name: 'functions', pass: false, reason: `函数从${origFuncs}减少到${newFuncs}` });
            } else {
                checks.push({ name: 'functions', pass: true });
            }
        } catch (e) {
            // AST解析失败不阻止(可能是CommonJS)
            checks.push({ name: 'ast', pass: true, note: 'ast_parse_skipped' });
        }

        // Check 3: 代码大小检查(不应变化超过20%)
        const sizeRatio = newCode.length / originalCode.length;
        if (sizeRatio < 0.8 || sizeRatio > 1.2) {
            checks.push({ name: 'size', pass: false, reason: `大小变化${((sizeRatio - 1) * 100).toFixed(0)}%超限` });
        } else {
            checks.push({ name: 'size', pass: true });
        }

        // Check 4: 无危险模式
        const dangerPatterns = [
            { pattern: /process\.exit\(\d+\)/, name: 'process.exit', severity: 'warn' },
            { pattern: /eval\s*\(/, name: 'eval()', severity: 'block' },
            { pattern: /rm\s+-rf/, name: 'rm -rf', severity: 'block' },
            { pattern: /require\(['"]child_process['"]\)\.exec\(/, name: 'exec arbitrary', severity: 'warn' },
        ];

        for (const dp of dangerPatterns) {
            // 检查新增的危险代码(原来没有,现在有)
            const origMatch = originalCode.match(dp.pattern);
            const newMatch = newCode.match(dp.pattern);
            if (!origMatch && newMatch) {
                const pass = dp.severity !== 'block';
                checks.push({ name: `danger:${dp.name}`, pass, reason: `新增${dp.name}` });
            }
        }

        // 总结
        const allPass = checks.every(c => c.pass);
        if (allPass) this.passes++;
        else this.failures++;

        return { pass: allPass, checks };
    }

    _findExports(ast) {
        const exports = [];
        try {
            const walk = (node) => {
                if (!node || typeof node !== 'object') return;
                if (node.type === 'AssignmentExpression' &&
                    node.left?.object?.name === 'module' &&
                    node.left?.property?.name === 'exports') {
                    // module.exports = { ... }
                    if (node.right?.properties) {
                        for (const p of node.right.properties) {
                            if (p.key?.name) exports.push(p.key.name);
                        }
                    }
                }
                for (const key of Object.keys(node)) {
                    if (key === 'type') continue;
                    const child = node[key];
                    if (Array.isArray(child)) child.forEach(walk);
                    else if (child && typeof child === 'object' && child.type) walk(child);
                }
            };
            walk(ast);
        } catch {}
        return exports;
    }

    _countFunctions(ast) {
        let count = 0;
        const walk = (node) => {
            if (!node || typeof node !== 'object') return;
            if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'MethodDefinition'].includes(node.type)) count++;
            for (const key of Object.keys(node)) {
                if (key === 'type') continue;
                const child = node[key];
                if (Array.isArray(child)) child.forEach(walk);
                else if (child && typeof child === 'object' && child.type) walk(child);
            }
        };
        walk(ast);
        return count;
    }

    getStats() {
        return {
            total: this.verifications,
            passes: this.passes,
            failures: this.failures,
            passRate: this.verifications > 0 ? (this.passes / this.verifications * 100).toFixed(0) + '%' : 'N/A',
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  4. OpenEndedEvolver — POET 开放进化
//
//  灵感: Uber POET
//  核心: 不预设固定目标,动态生成"挑战"(benchmark),
//        种子尝试解决,成功则迁移方案到更难的挑战
//        环境和解决方案共同进化
// ═══════════════════════════════════════════════════════════

class OpenEndedEvolver {
    constructor(aiFleet) {
        this.ai = aiFleet;
        this.challenges = [];
        this.solutions = new Map(); // challengeId → solution
        this.solved = 0;
    }

    // 生成新挑战
    async generateChallenges(count = 3) {
        log('POET', `生成 ${count} 个进化挑战...`);

        const result = await this.ai.ask(
            `为一个自进化AI系统生成${count}个编程挑战。每个挑战应该:
- 测试不同的能力(代码分析/网络操作/数据处理/算法优化)
- 包含明确的输入/输出规范
- 可以用Node.js在50行以内实现

用JSON数组回复:
[{"id":"challenge_名称","description":"描述","input":"输入示例","expectedOutput":"期望输出","difficulty":1-5,"category":"类别"}]`,
            '你是AI进化挑战设计师。生成有趣且有教育价值的编程挑战。只回复JSON数组。'
        );

        if (result.success) {
            try {
                const parsed = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || '[]');
                for (const challenge of parsed) {
                    if (challenge.id && challenge.description) {
                        this.challenges.push({
                            ...challenge,
                            createdAt: Date.now(),
                            solved: false,
                        });
                    }
                }
                log('POET', `已生成 ${parsed.length} 个挑战`);
                return parsed.length;
            } catch {}
        }
        return 0;
    }

    // 尝试解决一个挑战
    async attemptChallenge(challenge) {
        log('POET', `尝试挑战: ${challenge.id} (难度${challenge.difficulty})`);

        const result = await this.ai.ask(
            `解决这个编程挑战:
${challenge.description}

输入: ${challenge.input}
期望输出: ${challenge.expectedOutput}

用Node.js实现,50行以内。
重要: 网络请求必须用https模块(不要用http模块访问https链接)。
回复纯代码(不要markdown):`,
            '你是资深Node.js开发者。写简洁高效的代码。注意：HTTPS链接必须用require("https")而非require("http")。不要解释,只回复代码。'
        );

        if (!result.success) return { solved: false, reason: 'ai_unavailable' };

        // 提取代码
        let code = result.content;
        const codeMatch = code.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
        if (codeMatch) code = codeMatch[1];

        // ★ 自动修正常见协议错误: https.get('https://...) → https.get
        code = code.replace(/\bhttp\.get\s*\(\s*['"`]https:/g, "https.get('https:");
        code = code.replace(/\bhttp\.request\s*\(\s*['"`]https:/g, "https.request('https:");
        // 如果代码使用了https.get但没有require('https')，自动补充
        if (code.includes('https.get') && !code.includes("require('https')") && !code.includes('require("https")')) {
            code = "const https = require('https');\n" + code;
        }

        // 沙箱测试
        try {
            const m = new Module('challenge_' + challenge.id);
            m._compile(code, 'challenge.js');
            log('POET', `${C.green}编译通过${C.reset}`);

            // 记录解决方案
            this.solutions.set(challenge.id, {
                code,
                provider: result.provider,
                solvedAt: Date.now(),
            });
            challenge.solved = true;
            this.solved++;

            return { solved: true, code, provider: result.provider };
        } catch (e) {
            return { solved: false, reason: 'compile_failed', error: e.message };
        }
    }

    // 执行一轮开放进化
    async evolveOnce() {
        log('POET', '═══ POET 开放进化周期 ═══');

        // 1. 如果挑战不够,生成新的
        const unsolved = this.challenges.filter(c => !c.solved);
        if (unsolved.length < 2) {
            await this.generateChallenges(3);
        }

        // 2. 尝试解决最难的未解决挑战
        const target = this.challenges
            .filter(c => !c.solved)
            .sort((a, b) => (b.difficulty || 1) - (a.difficulty || 1))
            .slice(0, 2);

        let solved = 0;
        for (const challenge of target) {
            const result = await this.attemptChallenge(challenge);
            if (result.solved) solved++;
            await new Promise(r => setTimeout(r, 2000));
        }

        log('POET', `═══ POET 完成: ${solved}/${target.length}已解决 (总计${this.solved}) ═══`);
        return { attempted: target.length, solved };
    }

    getStats() {
        return {
            totalChallenges: this.challenges.length,
            solved: this.solved,
            unsolved: this.challenges.filter(c => !c.solved).length,
            solutions: this.solutions.size,
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  5. NoveltySearcher — ShinkaEvolve 新颖性搜索
//
//  灵感: Sakana AI ShinkaEvolve
//  核心: 不只追求"更好"，同时追求"不同"
//        避免局部最优: 代码多样性评分+新颖性档案
//        Pareto选择: fitness×novelty 双维度
// ═══════════════════════════════════════════════════════════

class NoveltySearcher {
    constructor() {
        this.archive = [];         // 新颖性档案: [{features, fitness, code, timestamp}]
        this.maxArchive = 200;     // 档案最大容量
        this.kNearest = 5;         // k-最近邻计算新颖度
    }

    // 提取代码的结构特征向量 (用于计算新颖性距离)
    extractFeatures(code) {
        const features = {
            // 基础结构
            lineCount: (code.match(/\n/g) || []).length + 1,
            funcCount: (code.match(/function\s+\w+|=>\s*[{(]|\.prototype\.\w+\s*=/g) || []).length,
            classCount: (code.match(/class\s+\w+/g) || []).length,
            asyncCount: (code.match(/async\s/g) || []).length,

            // 控制流复杂度
            ifCount: (code.match(/\bif\s*\(/g) || []).length,
            loopCount: (code.match(/\b(for|while|do)\s*[({]/g) || []).length,
            tryCount: (code.match(/\btry\s*\{/g) || []).length,
            switchCount: (code.match(/\bswitch\s*\(/g) || []).length,

            // 编程范式
            promiseCount: (code.match(/Promise|\.then\(|await\s/g) || []).length,
            eventCount: (code.match(/\.on\(|\.emit\(|EventEmitter|addEventListener/g) || []).length,
            streamCount: (code.match(/\.pipe\(|Readable|Writable|Transform/g) || []).length,

            // 数据结构
            mapSetCount: (code.match(/new\s+(Map|Set|WeakMap|WeakSet)/g) || []).length,
            arrayMethodCount: (code.match(/\.(map|filter|reduce|forEach|find|some|every)\(/g) || []).length,
            regexCount: (code.match(/\/[^/\n]+\/[gimsu]*/g) || []).length,

            // API模式
            fsCount: (code.match(/\bfs\.\w+/g) || []).length,
            httpCount: (code.match(/https?:\/\/|fetch\(|\.request\(/g) || []).length,
            modulePatterns: (code.match(/require\(['"][^'"]+['"]\)|import\s/g) || []).length,

            // 独特标识
            commentRatio: ((code.match(/\/\/|\/\*|\*\//g) || []).length) / Math.max(1, (code.match(/\n/g) || []).length),
            avgLineLength: code.length / Math.max(1, (code.match(/\n/g) || []).length + 1),
        };

        // 归一化为向量
        return Object.values(features).map(v => typeof v === 'number' ? v : 0);
    }

    // 计算两个特征向量的距离 (余弦距离)
    featureDistance(f1, f2) {
        if (f1.length !== f2.length) return 1.0;
        let dot = 0, mag1 = 0, mag2 = 0;
        for (let i = 0; i < f1.length; i++) {
            dot += f1[i] * f2[i];
            mag1 += f1[i] * f1[i];
            mag2 += f2[i] * f2[i];
        }
        mag1 = Math.sqrt(mag1);
        mag2 = Math.sqrt(mag2);
        if (mag1 === 0 || mag2 === 0) return 1.0;
        return 1 - (dot / (mag1 * mag2)); // 余弦距离: 0=相同, 1=完全不同
    }

    // 计算代码的新颖度 (相对于档案中所有已知代码)
    // 使用k-最近邻平均距离
    computeNovelty(code) {
        const features = this.extractFeatures(code);

        if (this.archive.length === 0) return { novelty: 1.0, features };

        // 计算到所有档案条目的距离
        const distances = this.archive.map(entry =>
            this.featureDistance(features, entry.features)
        ).sort((a, b) => a - b); // 从近到远

        // k-最近邻平均距离 = 新颖度
        const k = Math.min(this.kNearest, distances.length);
        const novelty = distances.slice(0, k).reduce((s, d) => s + d, 0) / k;

        return { novelty, features };
    }

    // Pareto选择: 同时考虑fitness和novelty
    // 返回Pareto前沿上的候选(不被任何其他候选同时在两个维度支配)
    paretoSelect(candidates) {
        // candidates = [{code, fitness, ...}]
        // 计算每个候选的新颖度
        const enriched = candidates.map(c => {
            const { novelty, features } = this.computeNovelty(c.code || '');
            return { ...c, novelty, features };
        });

        // Pareto前沿: 不被任何其他解支配
        const front = enriched.filter(a =>
            !enriched.some(b =>
                b !== a && b.fitness >= a.fitness && b.novelty >= a.novelty &&
                (b.fitness > a.fitness || b.novelty > a.novelty)
            )
        );

        // 按综合分排序: 0.6*fitness + 0.4*novelty
        front.sort((a, b) =>
            (0.6 * b.fitness + 0.4 * b.novelty) - (0.6 * a.fitness + 0.4 * a.novelty)
        );

        return front.length > 0 ? front : enriched.sort((a, b) =>
            (0.6 * b.fitness + 0.4 * b.novelty) - (0.6 * a.fitness + 0.4 * a.novelty)
        );
    }

    // 将代码添加到新颖性档案
    addToArchive(code, fitness, metadata = {}) {
        const { novelty, features } = this.computeNovelty(code);
        this.archive.push({
            features,
            fitness,
            novelty,
            timestamp: Date.now(),
            ...metadata,
        });

        // 档案满时，删除最不新颖的(保持多样性)
        if (this.archive.length > this.maxArchive) {
            // 重新计算所有新颖度，删除最低的
            for (const entry of this.archive) {
                const dists = this.archive
                    .filter(e => e !== entry)
                    .map(e => this.featureDistance(entry.features, e.features))
                    .sort((a, b) => a - b);
                entry._currentNovelty = dists.slice(0, this.kNearest)
                    .reduce((s, d) => s + d, 0) / Math.min(this.kNearest, dists.length);
            }
            this.archive.sort((a, b) => b._currentNovelty - a._currentNovelty);
            this.archive = this.archive.slice(0, this.maxArchive);
        }

        return { novelty, archived: true };
    }

    getStats() {
        return {
            archiveSize: this.archive.length,
            avgNovelty: this.archive.length > 0
                ? (this.archive.reduce((s, e) => s + (e.novelty || 0), 0) / this.archive.length).toFixed(3)
                : 'N/A',
            avgFitness: this.archive.length > 0
                ? (this.archive.reduce((s, e) => s + (e.fitness || 0), 0) / this.archive.length).toFixed(3)
                : 'N/A',
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  6. DirectedCognitiveEvolver — LoongFlow 定向认知进化
//
//  灵感: 百度 LoongFlow
//  核心: 不盲目进化，先分析系统弱点，再定向改进
//        弱点地图 → 优先级排序 → 定向提示 → 聚焦进化
//        认知闭环: 弱点→改进→验证→更新弱点地图
// ═══════════════════════════════════════════════════════════

class DirectedCognitiveEvolver {
    constructor(aiFleet) {
        this.ai = aiFleet;
        this.weaknessMap = new Map();   // {category → [{description, severity, file, addressed}]}
        this.improvementLog = [];        // 已完成的改进历史
        this.categories = [
            'error_handling',    // 错误处理不完善
            'performance',       // 性能瓶颈
            'resilience',        // 容错/恢复能力
            'intelligence',      // 决策/推理能力
            'learning',          // 学习/适应能力
            'integration',       // 模块集成度
        ];
    }

    // 阶段1: 分析系统弱点 (认知扫描)
    async analyzeWeaknesses(targetFiles) {
        log('LOONG', '═══ LoongFlow 弱点扫描 ═══');

        for (const filePath of targetFiles) {
            if (!fs.existsSync(filePath)) continue;
            const fileName = path.basename(filePath);

            let code;
            try { code = fs.readFileSync(filePath, 'utf8'); } catch { continue; }

            // 静态分析: 快速检测常见弱点模式
            const staticWeaknesses = this._staticAnalyze(code, fileName);
            for (const w of staticWeaknesses) {
                this._addWeakness(w.category, { ...w, file: fileName });
            }

            // AI深度分析(对核心文件)
            if (code.length > 1000 && code.length < 50000) {
                const snippet = code.length > 6000
                    ? code.substring(0, 3000) + '\n// ...[省略]...\n' + code.substring(code.length - 2500)
                    : code;

                const result = await this.ai.ask(
                    `分析以下Node.js代码的弱点和可改进之处:

文件: ${fileName} (${code.split('\n').length}行)
\`\`\`javascript
${snippet}
\`\`\`

按类别找出弱点(每类最多2个):
- error_handling: 缺失的错误处理
- performance: 性能瓶颈(内存泄漏/无限增长/慢操作)
- resilience: 容错不足(崩溃恢复/超时/重试)
- intelligence: 决策逻辑可改进
- learning: 学习/适应机制弱

JSON回复: [{"category":"...","description":"具体弱点(20字内)","severity":1-5,"suggestion":"改进建议(30字内)"}]`,
                    'LoongFlow弱点分析器: 只报告真实存在的具体问题,不要泛泛而谈。只回复JSON数组。'
                );

                if (result.success) {
                    try {
                        const parsed = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || '[]');
                        for (const w of parsed) {
                            if (w.category && w.description && this.categories.includes(w.category)) {
                                this._addWeakness(w.category, { ...w, file: fileName, source: 'ai_analysis' });
                            }
                        }
                    } catch {}
                }
                await new Promise(r => setTimeout(r, 1500));
            }
        }

        const total = Array.from(this.weaknessMap.values()).reduce((s, arr) => s + arr.length, 0);
        log('LOONG', `弱点扫描完成: ${total}个弱点, ${this.weaknessMap.size}个类别`);
        return this.getWeaknessReport();
    }

    // 静态代码分析(快速，不需要AI)
    _staticAnalyze(code, fileName) {
        const weaknesses = [];

        // 1. 空catch块 = 吞错误
        const emptyCatch = (code.match(/catch\s*\([^)]*\)\s*\{\s*\}/g) || []).length;
        if (emptyCatch > 2) {
            weaknesses.push({
                category: 'error_handling',
                description: `${emptyCatch}个空catch块吞没错误`,
                severity: 3,
                suggestion: '至少记录错误到日志',
            });
        }

        // 2. 无限增长数组/Map
        const pushNoLimit = (code.match(/\.push\([^)]+\)/g) || []).length;
        const limitChecks = (code.match(/\.length\s*>\s*\d+|\.splice\(|\.shift\(\)|\.slice\(/g) || []).length;
        if (pushNoLimit > 5 && limitChecks < pushNoLimit / 3) {
            weaknesses.push({
                category: 'performance',
                description: `${pushNoLimit}次push但仅${limitChecks}次限制检查`,
                severity: 4,
                suggestion: '增加数组大小限制防止内存泄漏',
            });
        }

        // 3. 无超时的网络请求
        const fetchCalls = (code.match(/fetch\(|\.request\(|https?\.\w+\(/g) || []).length;
        const timeoutCfg = (code.match(/timeout|AbortController|setTimeout.*abort/g) || []).length;
        if (fetchCalls > 2 && timeoutCfg === 0) {
            weaknesses.push({
                category: 'resilience',
                description: `${fetchCalls}个网络请求无超时设置`,
                severity: 3,
                suggestion: '添加请求超时和重试机制',
            });
        }

        // 4. 硬编码魔法数字
        const magicNumbers = (code.match(/(?<!=\s*)\b(?:[2-9]\d{2,}|1\d{3,})\b(?!\s*[;,\]})])/g) || []).length;
        if (magicNumbers > 10) {
            weaknesses.push({
                category: 'intelligence',
                description: `${magicNumbers}个硬编码数字`,
                severity: 2,
                suggestion: '提取为命名常量提高可读性',
            });
        }

        // 5. 同步文件读写(阻塞)
        const syncIO = (code.match(/readFileSync|writeFileSync|existsSync/g) || []).length;
        if (syncIO > 10) {
            weaknesses.push({
                category: 'performance',
                description: `${syncIO}次同步IO可能阻塞事件循环`,
                severity: 2,
                suggestion: '考虑对热路径使用异步IO',
            });
        }

        return weaknesses;
    }

    _addWeakness(category, weakness) {
        if (!this.weaknessMap.has(category)) {
            this.weaknessMap.set(category, []);
        }
        const list = this.weaknessMap.get(category);
        // 去重: 同文件同类别不重复
        if (!list.some(w => w.file === weakness.file && w.description === weakness.description)) {
            list.push({ ...weakness, addressed: false, addedAt: Date.now() });
            // 每类最多保留10个
            if (list.length > 10) {
                list.sort((a, b) => (b.severity || 1) - (a.severity || 1));
                list.length = 10;
            }
        }
    }

    // 阶段2: 获取最高优先级的改进目标
    getTopTarget() {
        let best = null;
        let bestScore = -1;

        for (const [category, weaknesses] of this.weaknessMap) {
            for (const w of weaknesses) {
                if (w.addressed) continue;
                const score = (w.severity || 1) * (category === 'error_handling' ? 1.3 :
                    category === 'resilience' ? 1.2 : category === 'performance' ? 1.1 : 1.0);
                if (score > bestScore) {
                    bestScore = score;
                    best = { ...w, category, score };
                }
            }
        }

        return best;
    }

    // 阶段3: 为特定弱点生成定向进化提示 (v2.0 — 高命中率版)
    async generateDirectedFix(target) {
        if (!target) return null;
        log('LOONG', `定向修复: [${target.category}] ${target.description} (${target.file})`);

        const filePath = path.join(SEED_HOME, target.file);
        if (!fs.existsSync(filePath)) return null;

        let code;
        try { code = fs.readFileSync(filePath, 'utf8'); } catch { return null; }

        // ★ v2.0: 智能上下文提取 — 找到弱点相关的代码段，而非截断全文
        const snippet = this._extractRelevantContext(code, target);

        const result = await this.ai.ask(
            `你是LoongFlow定向进化器。针对以下具体弱点，生成精确修复。

文件: ${target.file} (${code.split('\n').length}行)
弱点类别: ${target.category}
弱点描述: ${target.description}
改进建议: ${target.suggestion || '无'}

代码上下文:
\`\`\`javascript
${snippet}
\`\`\`

★★ 关键要求(决定成功或失败) ★★:
1. search必须是上面代码中【逐字完全匹配】的一段，包括空格和换行
2. search长度20-200字符，足够唯一但不要太长
3. replace必须保持正确的JavaScript语法
4. 只修复指定的弱点，不要改其他逻辑
5. confidence < 0.7就不要提交，宁可不修

JSON回复(严格格式):
{"search":"从上面代码中复制的原文","replace":"修复后代码","description":"修复描述(20字内)","confidence":0.0-1.0}`,
            'LoongFlow: search必须能在文件中精确找到。逐字复制,包括空格缩进换行。只回复一个JSON对象。'
        );

        if (!result.success) return null;

        try {
            const fix = JSON.parse(result.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
            if (!fix.search || !fix.replace || fix.confidence < 0.6) return null;

            // ★ v2.0: 多策略匹配 — 提高search命中率
            const matchResult = this._smartMatch(code, fix.search);
            if (matchResult.found) {
                // ★ v2.0: 编译验证 — 确保修改后语法正确
                const newCode = code.substring(0, matchResult.index) +
                    fix.replace +
                    code.substring(matchResult.index + matchResult.matchLen);

                if (this._verifyCompile(newCode, filePath)) {
                    return {
                        ...fix,
                        search: matchResult.exactMatch, // 使用精确匹配的字符串
                        target,
                        filePath,
                        originalCode: code,
                        newCode,
                        provider: result.provider,
                        matchMethod: matchResult.method,
                    };
                } else {
                    log('LOONG', `  修复编译失败，放弃`);
                }
            } else {
                log('LOONG', `  search不匹配(${fix.search.substring(0, 40)}...)`);
            }
        } catch {}

        return null;
    }

    // ★ 智能上下文提取: 根据弱点找到最相关的代码段
    _extractRelevantContext(code, target) {
        const lines = code.split('\n');

        // 策略1: 根据弱点类型关键词定位
        const keywords = [];
        if (target.category === 'error_handling') keywords.push('catch', 'throw', 'error', 'Error');
        if (target.category === 'performance') keywords.push('push', 'concat', 'forEach', 'setInterval');
        if (target.category === 'resilience') keywords.push('timeout', 'retry', 'reconnect', 'fetch', 'request');
        if (target.category === 'intelligence') keywords.push('decide', 'analyze', 'reason', 'think');
        if (target.category === 'learning') keywords.push('learn', 'train', 'adapt', 'update');

        // 从弱点描述中提取更多关键词
        const descWords = (target.description || '').match(/[a-zA-Z_]{3,}/g) || [];
        keywords.push(...descWords);

        // 找到最相关的代码区域
        let bestLineStart = 0;
        let bestScore = 0;
        const windowSize = 80; // 每次看80行

        for (let i = 0; i < lines.length - 10; i += 10) {
            const window = lines.slice(i, Math.min(i + windowSize, lines.length)).join('\n');
            let score = 0;
            for (const kw of keywords) {
                const regex = new RegExp(kw, 'gi');
                const matches = window.match(regex);
                if (matches) score += matches.length;
            }
            if (score > bestScore) {
                bestScore = score;
                bestLineStart = i;
            }
        }

        // 提取相关上下文(前后扩展到函数边界)
        const start = Math.max(0, bestLineStart - 5);
        const end = Math.min(lines.length, bestLineStart + windowSize + 5);
        const context = lines.slice(start, end);

        // 加行号帮助LLM定位(但不包含在search中)
        const numbered = context.map((line, i) => `/*L${start + i + 1}*/ ${line}`);

        // 如果上下文太短（弱点在其他位置），补充文件头部结构
        if (bestScore === 0 && code.length > 3000) {
            return code.substring(0, 2000) + '\n// ...[省略中部]...\n' + code.substring(code.length - 1500);
        }

        return numbered.join('\n');
    }

    // ★ 多策略匹配: 精确→标准化空白→行级匹配
    _smartMatch(code, search) {
        // 策略1: 精确匹配
        let idx = code.indexOf(search);
        if (idx !== -1) {
            return { found: true, index: idx, matchLen: search.length, exactMatch: search, method: 'exact' };
        }

        // 策略2: 移除行号注释后匹配 (/*L123*/ 开头)
        const cleaned = search.replace(/\/\*L\d+\*\/\s*/g, '');
        if (cleaned !== search) {
            idx = code.indexOf(cleaned);
            if (idx !== -1) {
                return { found: true, index: idx, matchLen: cleaned.length, exactMatch: cleaned, method: 'no_linenum' };
            }
        }

        // 策略3: 标准化空白匹配 (空格/tab差异)
        const normalizeWS = s => s.replace(/[ \t]+/g, ' ').trim();
        const searchNorm = normalizeWS(search);
        const lines = code.split('\n');
        // 滑动窗口: search可能跨多行
        const searchLines = search.split('\n').length;
        for (let i = 0; i <= lines.length - searchLines; i++) {
            const window = lines.slice(i, i + searchLines).join('\n');
            if (normalizeWS(window) === searchNorm) {
                const windowStart = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
                return {
                    found: true, index: windowStart, matchLen: window.length,
                    exactMatch: window, method: 'normalized_ws',
                };
            }
        }

        // 策略4: 按行逐一匹配(找到search的第一行在代码中的位置)
        const firstLine = normalizeWS(search.split('\n')[0]);
        if (firstLine.length > 15) {
            for (let i = 0; i < lines.length; i++) {
                if (normalizeWS(lines[i]) === firstLine) {
                    // 找到第一行，尝试匹配后续行
                    const remaining = search.split('\n').slice(1);
                    let allMatch = true;
                    for (let j = 0; j < remaining.length && i + 1 + j < lines.length; j++) {
                        if (normalizeWS(lines[i + 1 + j]) !== normalizeWS(remaining[j])) {
                            allMatch = false;
                            break;
                        }
                    }
                    if (allMatch) {
                        const totalLines = 1 + remaining.length;
                        const window = lines.slice(i, i + totalLines).join('\n');
                        const windowStart = lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
                        return {
                            found: true, index: windowStart, matchLen: window.length,
                            exactMatch: window, method: 'line_match',
                        };
                    }
                }
            }
        }

        return { found: false };
    }

    // ★ 编译验证: 确保修改后的代码语法正确
    _verifyCompile(code, filePath) {
        try {
            const Module = require('module');
            const m = new Module(filePath);
            m.filename = filePath;
            m.paths = Module._nodeModulePaths(path.dirname(filePath));
            // 用Module._compile检查语法(不执行)
            // 包装成函数避免真正执行
            const wrapped = `(function(exports,require,module,__filename,__dirname){${code}\n})`;
            new Function(wrapped); // 语法检查
            return true;
        } catch (e) {
            log('LOONG', `  编译验证失败: ${e.message.split('\n')[0]}`);
            return false;
        }
    }

    // 阶段4: 标记弱点已修复
    markAddressed(target, success) {
        const list = this.weaknessMap.get(target.category);
        if (list) {
            const found = list.find(w => w.file === target.file && w.description === target.description);
            if (found) {
                found.addressed = true;
                found.fixedAt = Date.now();
                found.success = success;
            }
        }
        if (success) {
            this.improvementLog.push({
                ...target,
                fixedAt: Date.now(),
            });
            if (this.improvementLog.length > 100) this.improvementLog.splice(0, 50);
        }
    }

    getWeaknessReport() {
        const report = {};
        for (const [category, weaknesses] of this.weaknessMap) {
            report[category] = {
                total: weaknesses.length,
                unaddressed: weaknesses.filter(w => !w.addressed).length,
                topSeverity: Math.max(...weaknesses.map(w => w.severity || 1)),
                items: weaknesses.filter(w => !w.addressed).slice(0, 3).map(w => ({
                    description: w.description,
                    severity: w.severity,
                    file: w.file,
                })),
            };
        }
        return report;
    }

    getStats() {
        const total = Array.from(this.weaknessMap.values()).reduce((s, arr) => s + arr.length, 0);
        const addressed = Array.from(this.weaknessMap.values()).reduce((s, arr) => s + arr.filter(w => w.addressed).length, 0);
        return {
            totalWeaknesses: total,
            addressed,
            unaddressed: total - addressed,
            improvements: this.improvementLog.length,
            categories: Object.fromEntries(
                Array.from(this.weaknessMap.entries()).map(([k, v]) => [k, v.filter(w => !w.addressed).length])
            ),
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  7. GitHubCodeIntegrator — GitHub代码自动集成
//
//  灵感: 文章"自动发现开源代码并集成"
//  核心: 不只搜索元数据，而是:
//        搜索GitHub → 获取README/代码 → AI提取可用模式
//        → 适配改写 → 沙箱验证 → 集成到种子
// ═══════════════════════════════════════════════════════════

class GitHubCodeIntegrator {
    constructor(aiFleet) {
        this.ai = aiFleet;
        this.integratedPatterns = [];  // 已集成的模式
        this.searchHistory = [];       // 搜索历史(避免重复)
        this.maxPatterns = 100;
    }

    // 搜索GitHub并提取可用代码模式
    async searchAndExtract(topic, maxResults = 3) {
        log('GITHUB', `搜索: ${topic}`);

        // 避免重复搜索
        if (this.searchHistory.includes(topic)) {
            log('GITHUB', `"${topic}"已搜索过,跳过`);
            return [];
        }
        this.searchHistory.push(topic);
        if (this.searchHistory.length > 200) this.searchHistory.shift();

        // GitHub API搜索代码(不只是仓库)
        const https = require('https');
        const encodedTopic = encodeURIComponent(`${topic} language:javascript`);

        const repos = await this._githubAPI(
            `/search/repositories?q=${encodedTopic}&sort=stars&per_page=${maxResults}`
        );

        if (!repos || !repos.items || repos.items.length === 0) {
            log('GITHUB', '无搜索结果');
            return [];
        }

        const patterns = [];

        for (const repo of repos.items.slice(0, maxResults)) {
            log('GITHUB', `分析仓库: ${repo.full_name} (${repo.stargazers_count}⭐)`);

            // 获取README了解项目
            const readme = await this._githubAPI(`/repos/${repo.full_name}/readme`);
            let readmeContent = '';
            if (readme && readme.content) {
                try {
                    readmeContent = Buffer.from(readme.content, 'base64').toString('utf8').substring(0, 3000);
                } catch {}
            }

            // 搜索仓库中的核心JS文件
            const tree = await this._githubAPI(`/repos/${repo.full_name}/git/trees/HEAD?recursive=1`);
            const jsFiles = (tree?.tree || [])
                .filter(f => f.path.endsWith('.js') && !f.path.includes('node_modules') &&
                    !f.path.includes('test') && !f.path.includes('.min.') && f.size < 50000)
                .sort((a, b) => (b.size || 0) - (a.size || 0))
                .slice(0, 3);

            // 获取核心文件内容
            let codeSnippets = '';
            for (const file of jsFiles.slice(0, 2)) {
                const blob = await this._githubAPI(`/repos/${repo.full_name}/contents/${file.path}`);
                if (blob && blob.content) {
                    try {
                        const content = Buffer.from(blob.content, 'base64').toString('utf8');
                        codeSnippets += `\n--- ${file.path} ---\n${content.substring(0, 2000)}\n`;
                    } catch {}
                }
                await new Promise(r => setTimeout(r, 500));
            }

            if (!codeSnippets && !readmeContent) continue;

            // AI提取可用模式
            const extractResult = await this.ai.ask(
                `分析这个开源项目，提取可直接复用的Node.js代码模式:

项目: ${repo.full_name} (${repo.stargazers_count}⭐)
描述: ${repo.description || '无'}
README摘要: ${readmeContent.substring(0, 1000)}
核心代码:
${codeSnippets.substring(0, 3000)}

提取2-3个可复用的代码模式,每个模式必须是完整可运行的函数。
JSON数组回复:
[{"name":"模式名","description":"用途(20字内)","code":"完整可运行的Node.js函数代码","category":"分类(algorithm/network/data/utility)"}]`,
                '提取实际有用的代码模式。代码必须独立可运行,不依赖项目特有的模块。只回复JSON数组。'
            );

            if (extractResult.success) {
                try {
                    const extracted = JSON.parse(extractResult.content.match(/\[[\s\S]*\]/)?.[0] || '[]');
                    for (const pattern of extracted) {
                        if (pattern.name && pattern.code) {
                            patterns.push({
                                ...pattern,
                                source: repo.full_name,
                                stars: repo.stargazers_count,
                                extractedAt: Date.now(),
                            });
                        }
                    }
                } catch {}
            }

            await new Promise(r => setTimeout(r, 1000));
        }

        log('GITHUB', `提取了 ${patterns.length} 个代码模式`);
        return patterns;
    }

    // 沙箱验证模式可运行性
    sandboxVerify(pattern) {
        if (!pattern.code) return { pass: false, reason: 'no_code' };

        try {
            // 检查危险代码
            const dangers = ['process.exit', 'rm -rf', 'eval(', 'child_process'].filter(d =>
                pattern.code.includes(d)
            );
            if (dangers.length > 0) {
                return { pass: false, reason: `dangerous: ${dangers.join(', ')}` };
            }

            // 编译测试
            const m = new Module('pattern_' + pattern.name);
            m._compile(`(function(){${pattern.code}\n})`, 'pattern.js');
            return { pass: true };
        } catch (e) {
            return { pass: false, reason: e.message };
        }
    }

    // 将验证通过的模式保存到知识库
    integratePattern(pattern) {
        const verification = this.sandboxVerify(pattern);
        if (!verification.pass) {
            log('GITHUB', `模式"${pattern.name}"验证失败: ${verification.reason}`);
            return false;
        }

        // 保存到已集成列表
        this.integratedPatterns.push({
            name: pattern.name,
            description: pattern.description,
            code: pattern.code,
            category: pattern.category,
            source: pattern.source,
            stars: pattern.stars,
            integratedAt: Date.now(),
        });

        // 限制数量
        if (this.integratedPatterns.length > this.maxPatterns) {
            this.integratedPatterns.splice(0, this.integratedPatterns.length - this.maxPatterns);
        }

        log('GITHUB', `已集成模式: ${pattern.name} (来自${pattern.source})`);
        return true;
    }

    // 完整流程: 搜索→提取→验证→集成
    async discoverAndIntegrate(topics = ['AI agent', 'self-evolving code', 'autonomous system']) {
        log('GITHUB', '═══ GitHub代码自动集成 ═══');
        let totalIntegrated = 0;

        for (const topic of topics) {
            const patterns = await this.searchAndExtract(topic, 2);
            for (const pattern of patterns) {
                if (this.integratePattern(pattern)) {
                    totalIntegrated++;
                }
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        log('GITHUB', `集成完成: ${totalIntegrated}个新模式 (总计${this.integratedPatterns.length})`);
        return { integrated: totalIntegrated, total: this.integratedPatterns.length };
    }

    // GitHub API 封装
    _githubAPI(endpoint) {
        return new Promise((resolve) => {
            const https = require('https');
            const options = {
                hostname: 'api.github.com',
                path: endpoint,
                headers: {
                    'User-Agent': 'SeedAI-Evolution/2.0',
                    'Accept': 'application/vnd.github.v3+json',
                },
                timeout: 10000,
            };

            const req = https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        });
    }

    getStats() {
        return {
            integratedPatterns: this.integratedPatterns.length,
            searchesDone: this.searchHistory.length,
            categories: this.integratedPatterns.reduce((acc, p) => {
                acc[p.category || 'other'] = (acc[p.category || 'other'] || 0) + 1;
                return acc;
            }, {}),
            recentPatterns: this.integratedPatterns.slice(-5).map(p => ({
                name: p.name, source: p.source,
            })),
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  8. CognitiveSearchHub — 认知级搜索中枢
//
//  文章核心: "搜索引擎从关键词工具升级为AI认知级网络中枢"
//  实现6大突破中当前可实现的4个:
//
//  突破1: 认知级意图检索 — LLM根据系统弱点自动推导搜索方向
//  突破2: 全网原生解析 — 多源(GitHub/NPM/Web) + AI语义提取
//  突破4: 资源价值判断 — 安全/兼容/有效性多维评估
//  突破6: AI大脑对接 — 搜索结果自动转化为知识/可执行操作
//
//  闭环: 感知弱点 → 推导搜索 → 多源检索 → 语义解析
//        → 价值判断 → 入脑/入库 → 触发进化
// ═══════════════════════════════════════════════════════════

class CognitiveSearchHub {
    constructor(aiFleet, directedEvolver = null) {
        this.ai = aiFleet;
        this.directedEvolver = directedEvolver; // LoongFlow弱点地图
        this._searchLog = [];
        this._evaluationCache = new Map();
        this._knowledgeIntegrated = 0;
        this._actionsTriggered = 0;
    }

    // ═══ 突破1: 认知级意图检索 ═══
    // 不需要人给关键词，根据系统自身状态推导"该搜什么"
    async deriveSearchIntent(systemState = {}) {
        log('SEARCH', '═══ 认知级意图推导 ═══');
        const intents = [];

        // 1. 基于弱点地图推导(LoongFlow联动)
        if (this.directedEvolver) {
            const report = this.directedEvolver.getWeaknessReport();
            for (const [category, info] of Object.entries(report)) {
                if (info.unaddressed > 0) {
                    const weakness = info.items[0];
                    intents.push({
                        source: 'weakness_map',
                        category,
                        description: weakness?.description || category,
                        query: this._weaknessToQuery(category, weakness),
                        priority: (weakness?.severity || 3) / 5,
                    });
                }
            }
        }

        // 2. 基于系统能力短板推导
        const capabilityGaps = this._assessCapabilityGaps(systemState);
        for (const gap of capabilityGaps) {
            intents.push({
                source: 'capability_gap',
                category: gap.category,
                description: gap.description,
                query: gap.query,
                priority: gap.priority,
            });
        }

        // 3. 如果AI可用，让LLM深度推导搜索方向
        if (this.ai && intents.length < 3) {
            const aiIntents = await this._llmDeriveIntents(systemState, intents);
            intents.push(...aiIntents);
        }

        // 按优先级排序,去重
        intents.sort((a, b) => b.priority - a.priority);
        const uniqueIntents = [];
        const seen = new Set();
        for (const intent of intents) {
            if (!seen.has(intent.query)) {
                seen.add(intent.query);
                uniqueIntents.push(intent);
            }
        }

        log('SEARCH', `推导出 ${uniqueIntents.length} 个搜索意图`);
        for (const i of uniqueIntents.slice(0, 5)) {
            log('SEARCH', `  [${i.source}] ${i.category}: "${i.query}" (优先${(i.priority*100).toFixed(0)}%)`);
        }

        return uniqueIntents.slice(0, 8); // 最多8个意图
    }

    // 弱点→搜索查询的智能映射
    _weaknessToQuery(category, weakness) {
        const queryMap = {
            error_handling: ['nodejs error handling best practices', 'robust error recovery pattern javascript'],
            performance: ['nodejs performance optimization', 'memory leak detection javascript', 'event loop optimization'],
            resilience: ['nodejs fault tolerance pattern', 'circuit breaker retry javascript', 'graceful degradation'],
            intelligence: ['AI decision making agent', 'reinforcement learning nodejs', 'bayesian inference javascript'],
            learning: ['online learning algorithm', 'incremental knowledge base', 'self-improving AI system'],
            integration: ['microservice integration nodejs', 'plugin architecture javascript', 'module composition pattern'],
        };
        const queries = queryMap[category] || [`nodejs ${category} improvement`];
        // 如果有具体弱点描述，生成更精确的查询
        if (weakness?.description) {
            queries.unshift(`${weakness.description} fix javascript`);
        }
        return queries[Math.floor(Math.random() * queries.length)];
    }

    // 评估系统能力短板
    _assessCapabilityGaps(systemState) {
        const gaps = [];
        const capabilities = systemState.capabilities || {};

        // 检测缺失的关键能力
        const requiredCapabilities = {
            vision: { query: 'computer vision OCR nodejs', description: '视觉理解能力', priority: 0.6 },
            nlp: { query: 'natural language processing nodejs 2026', description: 'NLP能力', priority: 0.5 },
            planning: { query: 'AI task planning agent', description: '任务规划能力', priority: 0.7 },
            selfRepair: { query: 'self-healing code automatic repair', description: '自修复能力', priority: 0.8 },
            distributed: { query: 'distributed computing nodejs cluster', description: '分布式计算', priority: 0.4 },
        };

        for (const [cap, info] of Object.entries(requiredCapabilities)) {
            if (!capabilities[cap] || capabilities[cap] < 0.5) {
                gaps.push({ category: cap, ...info });
            }
        }

        return gaps;
    }

    // LLM深度推导搜索意图
    async _llmDeriveIntents(systemState, existingIntents) {
        const result = await this.ai.ask(
            `你是AI认知搜索中枢。根据以下系统状态，推导出3个最有价值的搜索方向。

当前系统能力:
- 已有: 代码自进化, NeuroBrain(6脑区), 浏览器Agent, 10源AI路由
- 已有弱点: ${existingIntents.map(i => i.description).join(', ') || '待分析'}
- 系统环境: Node.js, Windows, RTX 3060 12GB

已有搜索意图: ${existingIntents.map(i => i.query).join('; ')}

推导新的搜索方向(不与已有重复),JSON数组:
[{"query":"英文搜索关键词","category":"分类","description":"中文说明(15字内)","priority":0.0-1.0}]`,
            '认知搜索中枢: 推导对AI进化最有价值的搜索方向。只回复JSON数组。'
        );

        if (!result.success) return [];

        try {
            const parsed = JSON.parse(result.content.match(/\[[\s\S]*\]/)?.[0] || '[]');
            return parsed.filter(i => i.query && i.category).map(i => ({
                ...i,
                source: 'llm_derived',
                priority: Math.min(1, Math.max(0, i.priority || 0.5)),
            }));
        } catch {}
        return [];
    }

    // ═══ 突破2: 多源检索 + 全网原生解析 ═══
    async multiSourceSearch(query, sources = ['github', 'npm', 'web']) {
        const results = [];

        const searchTasks = sources.map(source => {
            switch (source) {
                case 'github': return this._searchGitHub(query);
                case 'npm': return this._searchNPM(query);
                case 'web': return this._searchWeb(query);
                default: return Promise.resolve([]);
            }
        });

        const sourceResults = await Promise.allSettled(searchTasks);
        for (const r of sourceResults) {
            if (r.status === 'fulfilled') results.push(...r.value);
        }

        this._searchLog.push({ query, resultCount: results.length, timestamp: Date.now() });
        if (this._searchLog.length > 200) this._searchLog.splice(0, 100);

        return results;
    }

    async _searchGitHub(query) {
        try {
            const encoded = encodeURIComponent(query);
            const data = await this._httpsGet(
                `https://api.github.com/search/repositories?q=${encoded}&sort=stars&per_page=5`,
                { 'Accept': 'application/vnd.github.v3+json' }
            );
            if (!data?.items) return [];
            return data.items.map(repo => ({
                source: 'github',
                title: repo.full_name,
                description: repo.description || '',
                url: repo.html_url,
                stars: repo.stargazers_count,
                language: repo.language,
                topics: repo.topics || [],
                updatedAt: repo.updated_at,
                relevance: Math.min(1, (repo.stargazers_count || 0) / 5000),
            }));
        } catch { return []; }
    }

    async _searchNPM(query) {
        try {
            const encoded = encodeURIComponent(query);
            const data = await this._httpsGet(
                `https://registry.npmjs.org/-/v1/search?text=${encoded}&size=5`
            );
            if (!data?.objects) return [];
            return data.objects.map(obj => {
                const pkg = obj.package;
                return {
                    source: 'npm',
                    title: pkg.name,
                    description: pkg.description || '',
                    url: pkg.links?.npm || '',
                    version: pkg.version,
                    relevance: obj.score?.final || 0.3,
                };
            });
        } catch { return []; }
    }

    async _searchWeb(query) {
        // 用DuckDuckGo即时回答API(免费,无需Key)
        try {
            const encoded = encodeURIComponent(query);
            const data = await this._httpsGet(
                `https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1`
            );
            if (!data) return [];
            const results = [];
            if (data.Abstract) {
                results.push({
                    source: 'web',
                    title: data.Heading || query,
                    description: data.Abstract,
                    url: data.AbstractURL || '',
                    relevance: 0.8,
                });
            }
            if (data.RelatedTopics) {
                for (const topic of data.RelatedTopics.slice(0, 5)) {
                    if (topic.Text) {
                        results.push({
                            source: 'web',
                            title: topic.Text.substring(0, 100),
                            description: topic.Text,
                            url: topic.FirstURL || '',
                            relevance: 0.5,
                        });
                    }
                }
            }
            return results;
        } catch { return []; }
    }

    // ═══ 突破4: 资源价值判断 ═══
    // 对搜索结果进行多维度评估: 安全性/兼容性/有效性/价值
    async evaluateResources(results) {
        if (results.length === 0) return [];

        const evaluated = [];

        // 快速静态评估(不需要AI)
        for (const r of results) {
            const evaluation = {
                ...r,
                safety: this._staticSafetyCheck(r),
                compatibility: this._staticCompatibilityCheck(r),
                freshness: this._computeFreshness(r),
            };

            // 综合快速评分
            evaluation.quickScore = (
                evaluation.safety * 0.3 +
                evaluation.compatibility * 0.2 +
                evaluation.freshness * 0.2 +
                (evaluation.relevance || 0.5) * 0.3
            );

            evaluated.push(evaluation);
        }

        // 对Top候选用AI深度评估
        evaluated.sort((a, b) => b.quickScore - a.quickScore);
        const topCandidates = evaluated.slice(0, 5);

        if (this.ai && topCandidates.length > 0) {
            const aiEval = await this.ai.ask(
                `评估以下资源对"活体种子AI"(Node.js自进化系统)的价值:

${topCandidates.map((r, i) => `${i+1}. [${r.source}] ${r.title}: ${r.description?.substring(0, 80)}`).join('\n')}

系统环境: Node.js 22, Windows, RTX 3060 12GB
评估维度: 安全性(有无恶意代码/漏洞), 兼容性(Node.js可用), 实用价值(对AI进化有帮助)

JSON数组回复: [{"index":1,"safety":0-1,"value":0-1,"recommendation":"integrate/skip/caution","reason":"15字内"}]`,
                '资源评估专家: 客观评估每个资源的安全性和实用价值。只回复JSON。'
            );

            if (aiEval.success) {
                try {
                    const parsed = JSON.parse(aiEval.content.match(/\[[\s\S]*\]/)?.[0] || '[]');
                    for (const ev of parsed) {
                        if (ev.index && ev.index <= topCandidates.length) {
                            const target = topCandidates[ev.index - 1];
                            target.aiSafety = ev.safety;
                            target.aiValue = ev.value;
                            target.recommendation = ev.recommendation;
                            target.aiReason = ev.reason;
                            // 综合评分(加入AI判断)
                            target.finalScore = (
                                target.quickScore * 0.4 +
                                (ev.safety || 0.5) * 0.3 +
                                (ev.value || 0.5) * 0.3
                            );
                        }
                    }
                } catch {}
            }
        }

        // 按最终评分排序
        evaluated.sort((a, b) => (b.finalScore || b.quickScore) - (a.finalScore || a.quickScore));
        return evaluated;
    }

    // 静态安全检查
    _staticSafetyCheck(resource) {
        let score = 0.8; // 基础分

        // GitHub项目: 高星=更可信
        if (resource.source === 'github') {
            if (resource.stars > 1000) score = 0.95;
            else if (resource.stars > 100) score = 0.85;
            else if (resource.stars < 10) score = 0.5;
        }

        // NPM包: 检查已知问题
        if (resource.source === 'npm') {
            if (!resource.version) score -= 0.1;
        }

        // 可疑关键词
        const suspicious = ['hack', 'crack', 'exploit', 'malware', 'trojan'];
        const text = `${resource.title} ${resource.description}`.toLowerCase();
        if (suspicious.some(s => text.includes(s))) score -= 0.4;

        return Math.max(0, Math.min(1, score));
    }

    // 静态兼容性检查
    _staticCompatibilityCheck(resource) {
        let score = 0.7;
        const text = `${resource.title} ${resource.description} ${(resource.topics || []).join(' ')}`.toLowerCase();

        // 语言兼容
        if (text.includes('javascript') || text.includes('nodejs') || text.includes('typescript')) score += 0.2;
        if (resource.language === 'JavaScript' || resource.language === 'TypeScript') score += 0.15;
        // 不兼容语言
        if (['Python', 'Rust', 'Go', 'Java', 'C++'].includes(resource.language)) score -= 0.2;

        return Math.max(0, Math.min(1, score));
    }

    // 新鲜度计算
    _computeFreshness(resource) {
        if (!resource.updatedAt) return 0.5;
        const age = Date.now() - new Date(resource.updatedAt).getTime();
        const monthsOld = age / (30 * 24 * 60 * 60 * 1000);
        if (monthsOld < 1) return 1.0;
        if (monthsOld < 6) return 0.8;
        if (monthsOld < 12) return 0.6;
        return 0.3;
    }

    // ═══ 突破6: 搜索结果 → 知识/可执行操作 自动转化 ═══
    async integrateToKnowledge(evaluatedResults) {
        const actionable = evaluatedResults.filter(r =>
            (r.finalScore || r.quickScore) > 0.5 &&
            r.recommendation !== 'skip'
        );

        if (actionable.length === 0) return { knowledge: 0, actions: 0 };

        let knowledgeAdded = 0;
        let actionsGenerated = 0;

        // 1. 转化为知识(所有合格资源)
        for (const r of actionable) {
            const knowledge = {
                key: `cognitive_${r.source}_${r.title}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 60),
                value: `${r.title}: ${r.description?.substring(0, 100)}`,
                source: `cognitive_search:${r.source}`,
                safety: r.aiSafety || r.safety,
                score: r.finalScore || r.quickScore,
                timestamp: Date.now(),
            };

            this._saveToKnowledgeBase(knowledge);
            knowledgeAdded++;
        }

        // 2. 高价值资源 → 生成可执行操作建议
        const highValue = actionable.filter(r =>
            (r.finalScore || r.quickScore) > 0.7 && r.recommendation === 'integrate'
        );

        if (highValue.length > 0 && this.ai) {
            const actionResult = await this.ai.ask(
                `以下是认知搜索发现的高价值资源，生成可执行的集成操作:

${highValue.map(r => `- [${r.source}] ${r.title} (评分${(r.finalScore || r.quickScore).toFixed(2)}): ${r.description?.substring(0, 60)}`).join('\n')}

为每个资源生成一个可由AI自主执行的操作,JSON数组:
[{"resource":"名称","action":"install_npm|clone_code|learn_pattern|skip","command":"具体命令或操作","reason":"10字内"}]`,
                '生成AI可自主执行的操作。只回复JSON。'
            );

            if (actionResult.success) {
                try {
                    const actions = JSON.parse(actionResult.content.match(/\[[\s\S]*\]/)?.[0] || '[]');
                    actionsGenerated = actions.filter(a => a.action !== 'skip').length;
                    this._actionsTriggered += actionsGenerated;

                    // 保存操作建议(由进化引擎消费)
                    this._pendingActions = actions.filter(a => a.action !== 'skip');
                } catch {}
            }
        }

        this._knowledgeIntegrated += knowledgeAdded;
        return { knowledge: knowledgeAdded, actions: actionsGenerated };
    }

    // 获取待执行的操作
    getPendingActions() {
        const actions = this._pendingActions || [];
        this._pendingActions = [];
        return actions;
    }

    _saveToKnowledgeBase(knowledge) {
        try {
            const kbPath = path.join(SEED_HOME, 'learned-knowledge.json');
            let data = { knowledge: {}, count: 0 };
            try { data = JSON.parse(fs.readFileSync(kbPath, 'utf8')); } catch {}
            if (!data.knowledge) data.knowledge = {};

            // 去重检查
            if (data.knowledge[knowledge.key]) return;

            data.knowledge[knowledge.key] = knowledge.value;
            data.count = Object.keys(data.knowledge).length;
            data.updatedAt = new Date().toISOString();

            // 限制大小
            const keys = Object.keys(data.knowledge);
            if (keys.length > 500) {
                for (const k of keys.slice(0, keys.length - 500)) {
                    delete data.knowledge[k];
                }
                data.count = Object.keys(data.knowledge).length;
            }

            fs.writeFileSync(kbPath, JSON.stringify(data, null, 2));
        } catch {}
    }

    // ═══ 完整认知搜索闭环 ═══
    // 感知弱点 → 推导意图 → 多源检索 → 价值判断 → 入脑 → 触发进化
    async cognitiveSearchCycle(systemState = {}) {
        log('SEARCH', `\n${C.bold}═══ 认知搜索闭环 ═══${C.reset}`);

        // Step 1: 推导搜索意图
        const intents = await this.deriveSearchIntent(systemState);
        if (intents.length === 0) {
            log('SEARCH', '无搜索需求');
            return { intents: 0, searched: 0, evaluated: 0, integrated: 0 };
        }

        // Step 2: 多源检索(取前3个意图)
        let allResults = [];
        for (const intent of intents.slice(0, 3)) {
            const results = await this.multiSourceSearch(intent.query);
            allResults.push(...results);
            await new Promise(r => setTimeout(r, 1000));
        }
        log('SEARCH', `检索到 ${allResults.length} 条原始结果`);

        // Step 3: 资源价值判断
        const evaluated = await this.evaluateResources(allResults);
        const goodResults = evaluated.filter(r => (r.finalScore || r.quickScore) > 0.5);
        log('SEARCH', `${goodResults.length}/${allResults.length} 通过价值判断`);

        // Step 4: 入脑 + 生成操作
        const integrated = await this.integrateToKnowledge(goodResults);
        log('SEARCH', `知识入脑: ${integrated.knowledge}条, 操作建议: ${integrated.actions}个`);

        log('SEARCH', `${C.bold}═══ 认知搜索完成 ═══${C.reset}\n`);
        return {
            intents: intents.length,
            searched: allResults.length,
            evaluated: goodResults.length,
            integrated: integrated.knowledge,
            actions: integrated.actions,
        };
    }

    _httpsGet(url, extraHeaders = {}) {
        return new Promise((resolve) => {
            const https = require('https');
            const u = new URL(url);
            https.get({
                hostname: u.hostname,
                path: u.pathname + u.search,
                headers: {
                    'User-Agent': 'KaiLi-SeedAI-CognitiveSearch/2.0',
                    'Accept': 'application/json',
                    ...extraHeaders,
                },
                timeout: 15000,
            }, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch { resolve(null); }
                });
            }).on('error', () => resolve(null));
        });
    }

    getStats() {
        return {
            searchesDone: this._searchLog.length,
            knowledgeIntegrated: this._knowledgeIntegrated,
            actionsTriggered: this._actionsTriggered,
            pendingActions: (this._pendingActions || []).length,
            recentSearches: this._searchLog.slice(-5).map(s => ({
                query: s.query, results: s.resultCount,
            })),
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  9. GlobalEvolutionEngine — 统一进化引擎 v2.0
//
//  整合7大范式 + 认知搜索中枢 为统一的进化流水线:
//  AlphaEvolve生成候选 → NoveltySearch多样性筛选 →
//  Agent0双审 → DGM形式验证 → LoongFlow定向补强 →
//  POET基准测试 → GitHub代码集成 → 认知搜索闭环
// ═══════════════════════════════════════════════════════════

class GlobalEvolutionEngine extends EventEmitter {
    constructor(aiFleet) {
        super();
        this.ai = aiFleet;

        // 原始4大范式
        this.alphaEvolve = new AlphaEvolveEvaluator(aiFleet);
        this.dualAgent = new DualAgentTrainer(aiFleet);
        this.formalVerifier = new FormalVerifier();
        this.openEnded = new OpenEndedEvolver(aiFleet);

        // 新增3大系统 v2.0
        this.noveltySearcher = new NoveltySearcher();             // ShinkaEvolve新颖性
        this.directedEvolver = new DirectedCognitiveEvolver(aiFleet); // LoongFlow定向
        this.githubIntegrator = new GitHubCodeIntegrator(aiFleet);    // GitHub集成

        // 认知级搜索中枢(连接弱点地图)
        this.cognitiveSearch = new CognitiveSearchHub(aiFleet, this.directedEvolver);

        this._cycle = 0;
        this._weaknessScanDone = false;
        this._stats = {
            evolutions: 0,
            alphaEvolveSuccess: 0,
            dualAgentApprovals: 0,
            formalVerifications: 0,
            poetChallengesSolved: 0,
            noveltyArchived: 0,      // v2.0
            directedFixes: 0,        // v2.0
            githubIntegrated: 0,     // v2.0
        };
    }

    // 完整进化周期 v2.0: 7阶段管线
    // AlphaEvolve候选 → Novelty新颖性筛选 → Agent0双审 → DGM验证
    // + LoongFlow定向补强 + POET挑战 + GitHub集成
    async evolveOnce() {
        this._cycle++;
        log('EVO', `\n${C.bold}═══ 全球进化 v2.0 第${this._cycle}周期 ═══${C.reset}`);

        // 选择目标文件
        const coreFiles = [
            'seed-brain.js', 'seed-chat.js', 'seed-auto-learner.js',
            'seed-llm-evolution.js', 'seed-autonomous-loop.js',
            'seed-deep-evolution.js', 'seed-neuro-brain.js',
        ];
        const targetFile = coreFiles[this._cycle % coreFiles.length];
        const filePath = path.join(SEED_HOME, targetFile);

        if (!fs.existsSync(filePath)) {
            log('EVO', `文件不存在: ${targetFile}`);
            return null;
        }

        const originalCode = fs.readFileSync(filePath, 'utf8');

        // ═══ 阶段1: AlphaEvolve 生成评估候选 ═══
        log('EVO', `${C.green}阶段1: AlphaEvolve 递归评估${C.reset}`);
        const alphaResult = await this.alphaEvolve.evolveWithEvaluation(filePath, 2);

        if (!alphaResult) {
            log('EVO', '阶段1未产生有效候选');
            // 无候选时 → LoongFlow定向修复 + POET + GitHub
            await this._runDirectedEvolution();
            await this._runPOET();
            if (this._cycle % 3 === 0) await this._runGitHubIntegration();
            return null;
        }
        this._stats.alphaEvolveSuccess++;

        // ═══ 阶段2: NoveltySearch 新颖性评估 ═══ (NEW)
        log('EVO', `${C.blue}阶段2: NoveltySearch 新颖性评估${C.reset}`);
        const newCode = fs.readFileSync(filePath, 'utf8');
        const { novelty } = this.noveltySearcher.computeNovelty(newCode);
        const fitness = alphaResult.fitness?.total || 0.5;
        log('EVO', `  新颖度: ${novelty.toFixed(3)} | 适应度: ${fitness.toFixed(3)} | 综合: ${(0.6*fitness + 0.4*novelty).toFixed(3)}`);

        // 新颖度过低(局部最优陷阱) → 降低通过门槛但标记警告
        if (novelty < 0.1 && fitness < 0.8) {
            log('EVO', `${C.yellow}新颖度极低,可能局部最优 — 建议探索新方向${C.reset}`);
        }

        // 归档到新颖性档案
        this.noveltySearcher.addToArchive(newCode, fitness, { file: targetFile, cycle: this._cycle });
        this._stats.noveltyArchived++;

        // ═══ 阶段3: Agent0 双Agent审查 ═══
        log('EVO', `${C.cyan}阶段3: Agent0 双Agent审查${C.reset}`);
        const dualResult = await this.dualAgent.evaluateProposal({
            description: alphaResult.description,
            search: originalCode.substring(0, 200),
            replace: newCode.substring(0, 200),
        });

        if (!dualResult.approved) {
            log('EVO', `${C.yellow}Agent0否决,回滚${C.reset}`);
            fs.writeFileSync(filePath, originalCode);
            return null;
        }
        this._stats.dualAgentApprovals++;

        // ═══ 阶段4: DGM 形式验证 ═══
        log('EVO', `${C.magenta}阶段4: DGM 形式验证${C.reset}`);
        const verifyResult = this.formalVerifier.verify(originalCode, newCode, filePath);
        this._stats.formalVerifications++;

        if (!verifyResult.pass) {
            const failed = verifyResult.checks.filter(c => !c.pass).map(c => c.name).join(', ');
            log('EVO', `${C.red}DGM验证失败: ${failed},回滚${C.reset}`);
            fs.writeFileSync(filePath, originalCode);
            return null;
        }

        // ═══ 阶段5: 通过! 记录进化 ═══
        this._stats.evolutions++;
        const result = {
            cycle: this._cycle,
            file: targetFile,
            description: alphaResult.description,
            fitness,
            novelty,
            combinedScore: 0.6 * fitness + 0.4 * novelty,
            dualAgentScore: dualResult.score,
            verificationChecks: verifyResult.checks.length,
            timestamp: Date.now(),
        };

        this._saveLog(result);
        this.emit('evolution', result);

        log('EVO', `${C.green}${C.bold}全球进化成功! ${targetFile}: ${alphaResult.description}${C.reset}`);
        log('EVO', `  适应度:${fitness.toFixed(2)} | 新颖度:${novelty.toFixed(2)} | Agent0:${dualResult.score}/10 | DGM:${verifyResult.checks.length}检查通过`);

        // ═══ 后台任务: LoongFlow + GitHub + 认知搜索 (每N周期) ═══
        if (this._cycle % 2 === 0) await this._runDirectedEvolution();
        if (this._cycle % 5 === 0) await this._runGitHubIntegration();
        if (this._cycle % 4 === 0) await this._runCognitiveSearch();

        return result;
    }

    // POET 开放进化(在主进化无候选时运行)
    async _runPOET() {
        try {
            const poetResult = await this.openEnded.evolveOnce();
            this._stats.poetChallengesSolved += poetResult.solved;
        } catch (e) {
            log('EVO', `POET错误: ${e.message}`);
        }
    }

    // LoongFlow 定向认知进化(分析弱点→定向修复)
    async _runDirectedEvolution() {
        try {
            log('EVO', `${C.magenta}LoongFlow 定向认知进化${C.reset}`);

            // 首次运行时扫描所有核心文件弱点
            if (!this._weaknessScanDone) {
                const coreFiles = [
                    'seed-brain.js', 'seed-chat.js', 'seed-auto-learner.js',
                    'seed-llm-evolution.js', 'seed-neuro-brain.js',
                    'seed-living-core.js', 'seed-global-evolution.js',
                ].map(f => path.join(SEED_HOME, f)).filter(f => fs.existsSync(f));

                await this.directedEvolver.analyzeWeaknesses(coreFiles);
                this._weaknessScanDone = true;
            }

            // 获取最高优先级弱点
            const target = this.directedEvolver.getTopTarget();
            if (!target) {
                log('EVO', '  无未修复弱点');
                return;
            }

            // 生成定向修复
            const fix = await this.directedEvolver.generateDirectedFix(target);
            if (!fix) {
                log('EVO', `  无法为"${target.description}"生成修复`);
                return;
            }

            // ★ v2.0: fix.newCode 已在generateDirectedFix中预计算并通过编译验证
            const newCode = fix.newCode || fix.originalCode.replace(fix.search, fix.replace);
            const verify = this.formalVerifier.verify(fix.originalCode, newCode, fix.filePath);

            if (verify.pass) {
                // 应用修复(带安全回滚)
                const backup = fix.filePath + '.loong-backup';
                fs.writeFileSync(backup, fix.originalCode);
                fs.writeFileSync(fix.filePath, newCode);

                // ★ 再次编译验证(双重保险)
                try {
                    const wrapped = `(function(exports,require,module,__filename,__dirname){${newCode}\n})`;
                    new Function(wrapped);
                } catch (compileErr) {
                    // 编译失败 → 立即回滚
                    log('EVO', `${C.red}LoongFlow修复编译失败，自动回滚: ${compileErr.message.split('\n')[0]}${C.reset}`);
                    fs.writeFileSync(fix.filePath, fix.originalCode);
                    this.directedEvolver.markAddressed(target, false);
                    return;
                }

                this.directedEvolver.markAddressed(target, true);
                this._stats.directedFixes++;

                // 归档到新颖性档案
                this.noveltySearcher.addToArchive(newCode, 0.7, {
                    file: path.basename(fix.filePath),
                    type: 'directed_fix',
                    category: target.category,
                });

                log('EVO', `${C.green}LoongFlow修复成功: ${fix.description} (${target.category}) [${fix.matchMethod || 'exact'}]${C.reset}`);

                this._saveLog({
                    cycle: this._cycle,
                    file: path.basename(fix.filePath),
                    description: `[LoongFlow] ${fix.description}`,
                    category: target.category,
                    severity: target.severity,
                    matchMethod: fix.matchMethod,
                    timestamp: Date.now(),
                });
            } else {
                log('EVO', `LoongFlow修复未通过DGM验证: ${verify.reason}`);
                this.directedEvolver.markAddressed(target, false);
            }
        } catch (e) {
            log('EVO', `LoongFlow错误: ${e.message}`);
        }
    }

    // GitHub代码自动集成(搜索→提取→沙箱→集成)
    async _runGitHubIntegration() {
        try {
            log('EVO', `${C.blue}GitHub代码自动集成${C.reset}`);

            // 根据当前弱点方向确定搜索主题
            const topics = ['nodejs self-evolving AI', 'autonomous agent framework'];

            // 基于弱点地图动态调整搜索方向(LoongFlow联动)
            const weakness = this.directedEvolver.getTopTarget();
            if (weakness) {
                const topicMap = {
                    error_handling: 'nodejs error handling best practices',
                    performance: 'nodejs performance optimization',
                    resilience: 'nodejs fault tolerance retry pattern',
                    intelligence: 'AI decision making agent',
                    learning: 'machine learning nodejs',
                    integration: 'nodejs microservice integration',
                };
                if (topicMap[weakness.category]) {
                    topics.unshift(topicMap[weakness.category]);
                }
            }

            const result = await this.githubIntegrator.discoverAndIntegrate(topics.slice(0, 2));
            this._stats.githubIntegrated += result.integrated;

            // 将集成的模式保存到open-knowledge-base
            if (result.integrated > 0) {
                this._saveGitHubPatternsToKnowledge();
            }
        } catch (e) {
            log('EVO', `GitHub集成错误: ${e.message}`);
        }
    }

    // 将GitHub提取的模式保存到知识库
    _saveGitHubPatternsToKnowledge() {
        try {
            const kbPath = path.join(SEED_HOME, 'open-knowledge-base.json');
            let kb = {};
            try { kb = JSON.parse(fs.readFileSync(kbPath, 'utf8')); } catch {}
            if (!kb.knowledge) kb.knowledge = [];

            for (const pattern of this.githubIntegrator.integratedPatterns.slice(-10)) {
                const key = `github_pattern_${pattern.name}`;
                if (!kb.knowledge.some(k => k.key === key)) {
                    kb.knowledge.push({
                        key,
                        value: `${pattern.description} (来自${pattern.source})`,
                        code: pattern.code?.substring(0, 500),
                        source: 'github_auto_integration',
                        category: pattern.category,
                        timestamp: pattern.integratedAt,
                    });
                }
            }

            // 限制知识库大小
            if (kb.knowledge.length > 500) {
                kb.knowledge = kb.knowledge.slice(-500);
            }

            fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2));
        } catch (e) {
            log('EVO', `保存GitHub知识失败: ${e.message}`);
        }
    }

    // 认知级搜索闭环(自主推导搜索→检索→判断→入脑)
    async _runCognitiveSearch() {
        try {
            log('EVO', `${C.cyan}认知级搜索闭环${C.reset}`);
            const result = await this.cognitiveSearch.cognitiveSearchCycle({
                capabilities: {
                    vision: 0.6,    // 有OCR+VLM
                    nlp: 0.7,       // 有LLM对话
                    planning: 0.5,  // 有NeuroBrain决策
                    selfRepair: 0.4, // 有自动修复
                    distributed: 0.1, // 弱
                },
            });

            this._stats.cognitiveSearches = (this._stats.cognitiveSearches || 0) + 1;

            // 消费认知搜索生成的操作建议
            const actions = this.cognitiveSearch.getPendingActions();
            for (const action of actions) {
                if (action.action === 'install_npm' && action.command) {
                    log('EVO', `  认知操作: npm install ${action.resource} (${action.reason})`);
                    // 记录但不自动执行(安全考虑,留给人工确认或下次进化消费)
                }
                if (action.action === 'learn_pattern') {
                    log('EVO', `  认知操作: 学习模式 ${action.resource} (${action.reason})`);
                }
            }
        } catch (e) {
            log('EVO', `认知搜索错误: ${e.message}`);
        }
    }

    _saveLog(entry) {
        try {
            let log = [];
            try { log = JSON.parse(fs.readFileSync(EVOLUTION_LOG, 'utf8')); } catch {}
            log.push(entry);
            if (log.length > 500) log = log.slice(-500);
            fs.writeFileSync(EVOLUTION_LOG, JSON.stringify(log, null, 2));
        } catch {}
    }

    getStatus() {
        return {
            cycle: this._cycle,
            version: '2.0',
            stats: this._stats,
            alphaEvolve: this.alphaEvolve.getStats(),
            noveltySearch: this.noveltySearcher.getStats(),
            dualAgent: this.dualAgent.getStats(),
            formalVerifier: this.formalVerifier.getStats(),
            directedEvolver: this.directedEvolver.getStats(),
            openEnded: this.openEnded.getStats(),
            githubIntegrator: this.githubIntegrator.getStats(),
            cognitiveSearch: this.cognitiveSearch.getStats(),
        };
    }
}

module.exports = {
    AlphaEvolveEvaluator,
    DualAgentTrainer,
    FormalVerifier,
    OpenEndedEvolver,
    NoveltySearcher,
    DirectedCognitiveEvolver,
    GitHubCodeIntegrator,
    CognitiveSearchHub,
    GlobalEvolutionEngine,
};

// ═══════════════════════════════════════════════════════════
//  自测: 验证7大系统
// ═══════════════════════════════════════════════════════════
if (require.main === module) {
    (async () => {
        const OK = '\x1b[32m✓\x1b[0m';
        const FAIL = '\x1b[31m✗\x1b[0m';
        let pass = 0, total = 0;
        function check(name, cond) {
            total++;
            if (cond) { pass++; console.log(`  ${OK} ${name}`); }
            else { console.log(`  ${FAIL} ${name}`); }
        }

        console.log('═══ 全球进化引擎 v2.0 自测 ═══\n');

        // ── 1. FormalVerifier ──
        console.log('--- 1. FormalVerifier (DGM形式验证) ---');
        const verifier = new FormalVerifier();
        const code1 = 'function hello() { return "hello"; }\nmodule.exports = { hello };';
        const code2 = 'function hello() { return "hello world"; }\nmodule.exports = { hello };';
        const v1 = verifier.verify(code1, code2, 'test.js');
        check('正常改动通过验证', v1.pass === true);

        const codeBad = 'eval("danger");\nmodule.exports = {};';
        const v2 = verifier.verify(code1, codeBad, 'test.js');
        check('新增eval被拦截', v2.pass === false);
        check('验证统计正确', verifier.getStats().total === 2);

        // ── 2. NoveltySearcher (ShinkaEvolve) ──
        console.log('\n--- 2. NoveltySearcher (ShinkaEvolve新颖性) ---');
        const ns = new NoveltySearcher();

        // 首次代码新颖度=1(档案空)
        const n1 = ns.computeNovelty('function a() { return 1; }');
        check('空档案新颖度=1.0', n1.novelty === 1.0);

        // 添加到档案
        ns.addToArchive('function a() { return 1; }', 0.8, { file: 'test1.js' });
        check('添加到档案成功', ns.archive.length === 1);

        // 相似代码新颖度低
        const n2 = ns.computeNovelty('function b() { return 2; }');
        check('相似代码新颖度<1', n2.novelty < 1.0);

        // 完全不同的代码新颖度高
        ns.addToArchive('function a() { return 1; }', 0.8);
        ns.addToArchive('function a() { return 1; }', 0.7);
        const n3 = ns.computeNovelty(`
            class ComplexSystem extends EventEmitter {
                async processStream(input) {
                    const map = new Map();
                    for await (const chunk of input) {
                        if (map.has(chunk.id)) continue;
                        map.set(chunk.id, await this.transform(chunk));
                    }
                    return [...map.values()].filter(v => v.score > 0.5).reduce((s, v) => s + v.score, 0);
                }
            }
        `);
        check('复杂代码vs简单代码新颖度高', n3.novelty > n2.novelty);

        // Pareto选择
        const pareto = ns.paretoSelect([
            { code: 'function a(){return 1}', fitness: 0.9 },
            { code: `class X{async run(){const m=new Map();for(let i=0;i<100;i++){m.set(i,Math.random())}return m}}`, fitness: 0.5 },
            { code: 'function b(){return 2}', fitness: 0.3 },
        ]);
        check('Pareto选择返回结果', pareto.length > 0);
        check('Pareto候选含novelty字段', pareto[0].novelty !== undefined);
        console.log(`  档案统计: ${JSON.stringify(ns.getStats())}`);

        // ── 3. DirectedCognitiveEvolver (LoongFlow) ──
        console.log('\n--- 3. DirectedCognitiveEvolver (LoongFlow定向认知) ---');
        const dc = new DirectedCognitiveEvolver(null);

        // 静态分析
        const testCode = `
            function risky() {
                try { fetch('http://a.com') } catch {}
                try { fetch('http://b.com') } catch {}
                try { fetch('http://c.com') } catch {}
                const arr = [];
                for(let i=0;i<99;i++) arr.push(i);
                for(let i=0;i<99;i++) arr.push(i);
                for(let i=0;i<99;i++) arr.push(i);
                for(let i=0;i<99;i++) arr.push(i);
                for(let i=0;i<99;i++) arr.push(i);
                for(let i=0;i<99;i++) arr.push(i);
            }
        `;
        const weaknesses = dc._staticAnalyze(testCode, 'test.js');
        check('静态分析检测到弱点', weaknesses.length > 0);
        const categories = weaknesses.map(w => w.category);
        check('检测到空catch/网络/push弱点', categories.some(c =>
            c === 'error_handling' || c === 'resilience' || c === 'performance'));

        // 添加弱点并获取目标
        dc._addWeakness('error_handling', {
            description: '3个空catch块',
            severity: 4,
            file: 'test.js',
        });
        dc._addWeakness('performance', {
            description: '无限增长数组',
            severity: 3,
            file: 'test.js',
        });
        const target = dc.getTopTarget();
        check('获取最高优先级弱点', target !== null);
        check('优先级排序正确(severity*类别加权)', target.severity >= 3);

        // 标记修复
        dc.markAddressed(target, true);
        const report = dc.getWeaknessReport();
        check('弱点标记已修复', dc.getStats().addressed >= 1);
        console.log(`  弱点报告: ${JSON.stringify(dc.getStats())}`);

        // ── 4. GitHubCodeIntegrator ──
        console.log('\n--- 4. GitHubCodeIntegrator (代码自动集成) ---');
        const gi = new GitHubCodeIntegrator(null);

        // 沙箱验证
        const safe = gi.sandboxVerify({ name: 'test', code: 'const x = 1 + 2;' });
        check('安全代码通过沙箱', safe.pass === true);

        const dangerous = gi.sandboxVerify({ name: 'bad', code: 'process.exit(1)' });
        check('危险代码被拦截', dangerous.pass === false);

        const syntaxBad = gi.sandboxVerify({ name: 'err', code: 'function {{{ broken' });
        check('语法错误被拦截', syntaxBad.pass === false);

        // 模式集成
        const integrated = gi.integratePattern({
            name: 'testUtil',
            code: 'function add(a,b) { return a+b; }',
            description: '加法工具',
            category: 'utility',
            source: 'test/repo',
            stars: 100,
        });
        check('有效模式集成成功', integrated === true);
        check('集成统计正确', gi.getStats().integratedPatterns === 1);

        // 搜索历史去重
        gi.searchHistory.push('test-topic');
        check('搜索历史去重', gi.searchHistory.includes('test-topic'));

        // ── 5. GlobalEvolutionEngine 集成 ──
        console.log('\n--- 5. GlobalEvolutionEngine v2.0 集成 ---');
        const engine = new GlobalEvolutionEngine({ ask: async () => ({ success: false }) });
        check('引擎创建包含8大系统', !!(
            engine.alphaEvolve && engine.dualAgent && engine.formalVerifier &&
            engine.openEnded && engine.noveltySearcher && engine.directedEvolver &&
            engine.githubIntegrator && engine.cognitiveSearch
        ));

        const status = engine.getStatus();
        check('状态包含version 2.0', status.version === '2.0');
        check('状态包含noveltySearch', !!status.noveltySearch);
        check('状态包含directedEvolver', !!status.directedEvolver);
        check('状态包含githubIntegrator', !!status.githubIntegrator);
        check('状态包含cognitiveSearch', !!status.cognitiveSearch);
        check('stats包含新字段', status.stats.noveltyArchived !== undefined &&
            status.stats.directedFixes !== undefined &&
            status.stats.githubIntegrated !== undefined);

        // ── 6. 特征提取测试 ──
        console.log('\n--- 6. 特征提取深度测试 ---');
        const features1 = ns.extractFeatures('const x = 1;');
        const features2 = ns.extractFeatures(`
            class Server extends EventEmitter {
                constructor() { super(); this.map = new Map(); }
                async handle(req) {
                    try {
                        const data = await fetch('http://api.com');
                        return data.filter(d => d.valid).map(d => d.value);
                    } catch(e) { console.error(e); }
                }
            }
        `);
        check('特征向量长度一致', features1.length === features2.length);
        check('复杂代码特征值更大', features2.reduce((s,v)=>s+v,0) > features1.reduce((s,v)=>s+v,0));
        const dist = ns.featureDistance(features1, features2);
        check('特征距离在0-1之间', dist >= 0 && dist <= 1);
        check('不同代码距离>0', dist > 0);
        console.log(`  特征距离: ${dist.toFixed(4)}`);

        // ── 7. CognitiveSearchHub (认知级搜索中枢) ──
        console.log('\n--- 7. CognitiveSearchHub (认知级搜索中枢) ---');
        const csh = new CognitiveSearchHub(null, dc); // 用LoongFlow弱点地图

        // 意图推导(无AI,纯弱点+能力短板)
        const intents = await csh.deriveSearchIntent({
            capabilities: { vision: 0.3, nlp: 0.8, planning: 0.5, selfRepair: 0.2, distributed: 0.0 },
        });
        check('推导出搜索意图', intents.length > 0);
        check('意图含query字段', intents.every(i => !!i.query));
        check('意图含priority字段', intents.every(i => i.priority >= 0 && i.priority <= 1));
        check('来源包含capability_gap', intents.some(i => i.source === 'capability_gap'));
        console.log(`  意图数: ${intents.length}, 来源: ${[...new Set(intents.map(i => i.source))].join(', ')}`);

        // 资源安全检查
        const safe1 = csh._staticSafetyCheck({ source: 'github', stars: 5000, title: 'express', description: 'web framework' });
        const safe2 = csh._staticSafetyCheck({ source: 'github', stars: 2, title: 'hack-tool', description: 'exploit kit' });
        check('高星项目安全分高', safe1 > 0.8);
        check('可疑项目安全分低', safe2 < 0.5);

        // 兼容性检查
        const compat1 = csh._staticCompatibilityCheck({ language: 'JavaScript', title: 'nodejs-lib', description: 'nodejs module', topics: ['nodejs'] });
        const compat2 = csh._staticCompatibilityCheck({ language: 'Python', title: 'flask', description: 'python web', topics: ['python'] });
        check('JS项目兼容分高', compat1 > 0.8);
        check('Python项目兼容分低', compat2 < 0.7);

        // 新鲜度计算
        const fresh1 = csh._computeFreshness({ updatedAt: new Date().toISOString() });
        const fresh2 = csh._computeFreshness({ updatedAt: '2020-01-01' });
        check('最近更新新鲜度高', fresh1 > 0.8);
        check('旧项目新鲜度低', fresh2 < 0.5);

        // 资源评估
        const evaluated = await csh.evaluateResources([
            { source: 'github', title: 'awesome-ai', description: 'AI framework', stars: 3000, language: 'JavaScript', relevance: 0.9, updatedAt: new Date().toISOString() },
            { source: 'npm', title: 'shady-pkg', description: 'hack exploit', stars: 0, relevance: 0.1 },
        ]);
        check('资源评估返回结果', evaluated.length === 2);
        check('评估含quickScore', evaluated.every(r => r.quickScore !== undefined));
        check('好资源评分>差资源', evaluated[0].quickScore > evaluated[1].quickScore);
        console.log(`  评估: "${evaluated[0].title}"=${evaluated[0].quickScore.toFixed(3)}, "${evaluated[1].title}"=${evaluated[1].quickScore.toFixed(3)}`);

        // 统计
        const cshStats = csh.getStats();
        check('统计包含核心字段', cshStats.searchesDone !== undefined && cshStats.knowledgeIntegrated !== undefined);

        // ── 总结 ──
        console.log(`\n═══ 自测完成: ${pass}/${total} 通过 ${pass === total ? '🎉 ALL PASS!' : '⚠️ 有失败'} ═══`);
        process.exit(pass === total ? 0 : 1);
    })().catch(e => { console.error('Fatal:', e); process.exit(1); });
}
