/**
 * 活体种子AI - 向量大脑升级 v1.0
 *
 * 4大突破，从L3推向L4:
 *   1. VectorMemory    — 向量记忆 + 语义检索 (替代hash去重)
 *   2. RealQLearner    — 真正Q-Learning决策 (替代规则匹配)
 *   3. MCTSPlanner     — 蒙特卡洛搜索树 (多步规划)
 *   4. KnowledgeGraph  — 知识图谱 (实体+关系+图推理)
 *
 * 依赖: Ollama nomic-embed-text (768维, 274MB)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const C = {
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
    reset: '\x1b[0m', bold: '\x1b[1m',
};

// ═══════════════════════════════════════════════
//  1. 向量记忆系统 (Vector Memory)
//     Ollama embedding → 余弦相似 → 语义检索
// ═══════════════════════════════════════════════

class VectorMemory {
    constructor(options = {}) {
        this._embedModel = options.model || 'nomic-embed-text';
        this._dim = 768;  // nomic-embed-text 输出768维
        this._vectors = [];     // [{id, text, vector, metadata, timestamp}]
        this._maxSize = options.maxSize || 5000;
        this._dbPath = options.dbPath || path.join(__dirname, 'vector-memory.json');
        this._ollamaHost = options.ollamaHost || 'localhost';
        this._ollamaPort = options.ollamaPort || 11434;
        this._cache = new Map(); // text → vector 缓存
        this._stats = { embedCalls: 0, searches: 0, hits: 0 };
        this._load();
    }

    // ═══ 核心: 获取文本的向量表示 ═══
    async embed(text) {
        if (!text || text.length === 0) return null;

        // 缓存命中
        const cacheKey = text.substring(0, 200);
        if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);

        try {
            const vector = await this._ollamaEmbed(text);
            if (vector && vector.length === this._dim) {
                this._cache.set(cacheKey, vector);
                if (this._cache.size > 1000) {
                    // LRU: 删除前500个
                    const keys = [...this._cache.keys()].slice(0, 500);
                    keys.forEach(k => this._cache.delete(k));
                }
                this._stats.embedCalls++;
                return vector;
            }
        } catch (e) {}
        return null;
    }

    // ═══ 添加记忆 (自动去重: 语义相似度>0.92则视为重复) ═══
    async add(text, metadata = {}) {
        const vector = await this.embed(text);
        if (!vector) return false;

        // 语义去重: 找最相似的现有记忆
        const similar = this._findSimilar(vector, 1);
        if (similar.length > 0 && similar[0].similarity > 0.92) {
            return false; // 语义重复，跳过
        }

        const entry = {
            id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            text: text.substring(0, 2000),
            vector,
            metadata,
            timestamp: Date.now(),
            accessCount: 0,
        };

        this._vectors.push(entry);

        // 超过上限，删除最老最少访问的
        if (this._vectors.length > this._maxSize) {
            this._vectors.sort((a, b) => {
                const scoreA = a.accessCount * 0.3 + (a.timestamp / 1e12);
                const scoreB = b.accessCount * 0.3 + (b.timestamp / 1e12);
                return scoreA - scoreB;
            });
            this._vectors.splice(0, Math.floor(this._maxSize * 0.1));
        }

        // 每100次添加自动保存
        if (this._vectors.length % 100 === 0) this._save();

        return true;
    }

    // ═══ 语义搜索: 找最相似的k条记忆 ═══
    async search(query, k = 5, minSimilarity = 0.5) {
        const queryVector = await this.embed(query);
        if (!queryVector) return [];

        this._stats.searches++;
        const results = this._findSimilar(queryVector, k)
            .filter(r => r.similarity >= minSimilarity);

        // 更新访问计数
        for (const r of results) {
            const entry = this._vectors.find(v => v.id === r.id);
            if (entry) entry.accessCount++;
        }

        if (results.length > 0) this._stats.hits++;
        return results;
    }

    // ═══ 余弦相似度搜索 (纯CPU，无需GPU) ═══
    _findSimilar(queryVector, k) {
        const results = [];

        for (const entry of this._vectors) {
            const sim = this._cosineSimilarity(queryVector, entry.vector);
            results.push({
                id: entry.id,
                text: entry.text,
                metadata: entry.metadata,
                similarity: sim,
                timestamp: entry.timestamp,
            });
        }

        return results.sort((a, b) => b.similarity - a.similarity).slice(0, k);
    }

    // ═══ 余弦相似度 ═══
    _cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;
        let dot = 0, normA = 0, normB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom > 0 ? dot / denom : 0;
    }

    // ═══ Ollama Embedding API ═══
    _ollamaEmbed(text) {
        return new Promise((resolve) => {
            const data = JSON.stringify({ model: this._embedModel, prompt: text.substring(0, 8000) });
            const req = http.request({
                hostname: this._ollamaHost, port: this._ollamaPort,
                path: '/api/embeddings', method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
            }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(body);
                        resolve(result.embedding || null);
                    } catch { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.write(data);
            req.end();
        });
    }

    // ═══ 持久化 ═══
    _save() {
        try {
            // 只保存向量的前32维(压缩存储)，搜索时用完整向量
            const compact = this._vectors.map(v => ({
                id: v.id,
                text: v.text,
                // 存完整向量会很大，用Float32压缩
                v: Buffer.from(new Float32Array(v.vector).buffer).toString('base64'),
                m: v.metadata,
                t: v.timestamp,
                a: v.accessCount,
            }));
            fs.writeFileSync(this._dbPath, JSON.stringify({
                version: 1,
                dim: this._dim,
                count: compact.length,
                entries: compact,
            }));
        } catch (e) {
            console.log(`${C.yellow}[VectorMem]${C.reset} 保存失败: ${e.message}`);
        }
    }

    _load() {
        try {
            if (!fs.existsSync(this._dbPath)) return;
            const data = JSON.parse(fs.readFileSync(this._dbPath, 'utf8'));
            if (data.version !== 1 || data.dim !== this._dim) return;

            this._vectors = (data.entries || []).map(e => ({
                id: e.id,
                text: e.text,
                vector: [...new Float32Array(Buffer.from(e.v, 'base64').buffer)],
                metadata: e.m || {},
                timestamp: e.t,
                accessCount: e.a || 0,
            }));

            console.log(`${C.green}[VectorMem]${C.reset} 加载${this._vectors.length}条向量记忆 (${this._dim}维)`);
        } catch (e) {
            console.log(`${C.yellow}[VectorMem]${C.reset} 加载失败: ${e.message}`);
        }
    }

    save() { this._save(); }

    getStats() {
        return {
            totalMemories: this._vectors.length,
            dimension: this._dim,
            model: this._embedModel,
            ...this._stats,
            cacheSize: this._cache.size,
        };
    }
}

// ═══════════════════════════════════════════════
//  2. 真正Q-Learning决策器
//     状态→动作→奖励→更新 持久化Q-table
// ═══════════════════════════════════════════════

class RealQLearner {
    constructor(options = {}) {
        this._alpha = options.learningRate || 0.15;    // 学习率
        this._gamma = options.discountFactor || 0.9;   // 折扣因子
        this._epsilon = options.epsilon || 0.15;       // 探索率
        this._epsilonDecay = 0.999;                    // 探索衰减
        this._minEpsilon = 0.05;

        // 动作空间
        this._actions = [
            'ANALYZE', 'LEARN', 'EVOLVE', 'REPAIR', 'DEPLOY',
            'SEARCH', 'WAIT', 'EXPLORE', 'OPTIMIZE', 'COMMUNICATE',
        ];

        // Q-table: Map<stateKey, Map<action, qValue>>
        this._qTable = new Map();

        // 经验回放缓冲
        this._replayBuffer = [];
        this._maxReplaySize = 1000;
        this._batchSize = 16;

        // 状态追踪
        this._lastState = null;
        this._lastAction = null;
        this._totalReward = 0;
        this._episodeRewards = [];
        this._stats = {
            decisions: 0, explorations: 0, exploitations: 0,
            totalReward: 0, avgReward: 0, episodes: 0,
        };

        this._dbPath = options.dbPath || path.join(__dirname, 'q-learning-table.json');
        this._load();
    }

    // ═══ 核心: 状态→特征向量→离散化 ═══
    encodeState(perception) {
        // 将连续感知转化为离散状态键
        const features = [];

        // 内存压力: low/medium/high
        const memPct = perception.memUsedPct || 50;
        features.push(memPct < 40 ? 'mem_low' : memPct < 75 ? 'mem_med' : 'mem_high');

        // 知识水平: few/some/many
        const knowledge = perception.knowledgeCount || 0;
        features.push(knowledge < 50 ? 'know_few' : knowledge < 200 ? 'know_some' : 'know_many');

        // 时段: 根据运行周期
        const cycle = perception.cycle || 0;
        features.push(cycle < 10 ? 'early' : cycle < 100 ? 'mid' : 'late');

        // 错误状态
        const hasError = perception.keywords?.some(k => k.type === 'error') || false;
        features.push(hasError ? 'error' : 'ok');

        // 进化停滞
        const stagnation = perception.stagnationCycles || 0;
        features.push(stagnation > 5 ? 'stagnant' : 'active');

        // AI资源
        const aiAvailable = perception.aiProviders || 3;
        features.push(aiAvailable > 5 ? 'ai_rich' : aiAvailable > 2 ? 'ai_ok' : 'ai_poor');

        return features.join('|');
    }

    // ═══ 核心: 选择动作 (ε-greedy) ═══
    selectAction(stateKey) {
        this._stats.decisions++;

        // ε-greedy 探索
        if (Math.random() < this._epsilon) {
            this._stats.explorations++;
            const action = this._actions[Math.floor(Math.random() * this._actions.length)];
            this._lastState = stateKey;
            this._lastAction = action;
            return { action, method: 'explore', epsilon: this._epsilon };
        }

        // 利用: 选择Q值最高的动作
        this._stats.exploitations++;
        const qValues = this._getQValues(stateKey);
        let bestAction = this._actions[0];
        let bestQ = -Infinity;

        for (const action of this._actions) {
            const q = qValues.get(action) || 0;
            if (q > bestQ) {
                bestQ = q;
                bestAction = action;
            }
        }

        this._lastState = stateKey;
        this._lastAction = bestAction;

        // 衰减探索率
        this._epsilon = Math.max(this._minEpsilon, this._epsilon * this._epsilonDecay);

        return { action: bestAction, method: 'exploit', qValue: bestQ, epsilon: this._epsilon };
    }

    // ═══ 核心: 接收奖励并更新Q-table ═══
    receiveReward(reward, newStateKey) {
        if (!this._lastState || !this._lastAction) return;

        // Q-Learning更新公式:
        // Q(s,a) = Q(s,a) + α * (r + γ * max(Q(s',a')) - Q(s,a))
        const oldQ = this._getQ(this._lastState, this._lastAction);
        const maxNextQ = this._getMaxQ(newStateKey);
        const newQ = oldQ + this._alpha * (reward + this._gamma * maxNextQ - oldQ);

        this._setQ(this._lastState, this._lastAction, newQ);

        // 经验回放
        this._replayBuffer.push({
            state: this._lastState,
            action: this._lastAction,
            reward,
            nextState: newStateKey,
        });
        if (this._replayBuffer.length > this._maxReplaySize) {
            this._replayBuffer.splice(0, Math.floor(this._maxReplaySize * 0.2));
        }

        // 小批量经验回放
        this._replayLearn();

        this._totalReward += reward;
        this._stats.totalReward += reward;
        this._stats.avgReward = this._stats.totalReward / this._stats.decisions;

        return { oldQ, newQ, reward, delta: newQ - oldQ };
    }

    // ═══ 经验回放学习 ═══
    _replayLearn() {
        if (this._replayBuffer.length < this._batchSize) return;

        // 随机抽取一批经验
        for (let i = 0; i < this._batchSize; i++) {
            const idx = Math.floor(Math.random() * this._replayBuffer.length);
            const exp = this._replayBuffer[idx];

            const oldQ = this._getQ(exp.state, exp.action);
            const maxNextQ = this._getMaxQ(exp.nextState);
            const newQ = oldQ + this._alpha * 0.5 * (exp.reward + this._gamma * maxNextQ - oldQ);
            this._setQ(exp.state, exp.action, newQ);
        }
    }

    // ═══ Q-table操作 ═══
    _getQValues(state) {
        if (!this._qTable.has(state)) {
            this._qTable.set(state, new Map());
        }
        return this._qTable.get(state);
    }

    _getQ(state, action) {
        return this._getQValues(state).get(action) || 0;
    }

    _setQ(state, action, value) {
        this._getQValues(state).set(action, value);
    }

    _getMaxQ(state) {
        const qValues = this._getQValues(state);
        let maxQ = 0;
        for (const q of qValues.values()) {
            if (q > maxQ) maxQ = q;
        }
        return maxQ;
    }

    // ═══ 计算奖励信号 (从环境反馈) ═══
    static computeReward(beforeState, afterState, actionResult) {
        let reward = 0;

        // 知识增长 → 正奖励
        const knowledgeDelta = (afterState.knowledgeCount || 0) - (beforeState.knowledgeCount || 0);
        reward += knowledgeDelta * 0.5;

        // 错误修复 → 大正奖励
        if (beforeState.hasError && !afterState.hasError) reward += 3.0;

        // 产生新错误 → 大负奖励
        if (!beforeState.hasError && afterState.hasError) reward -= 5.0;

        // 进化成功 → 正奖励
        if (actionResult?.evolved) reward += 2.0;

        // 停滞 → 小负奖励
        if (afterState.stagnationCycles > beforeState.stagnationCycles) reward -= 0.5;

        // 内存泄漏 → 负奖励
        const memDelta = (afterState.memUsedPct || 0) - (beforeState.memUsedPct || 0);
        if (memDelta > 10) reward -= 1.0;

        // WAIT惩罚 (鼓励行动)
        if (actionResult?.action === 'WAIT') reward -= 0.2;

        return Math.max(-10, Math.min(10, reward)); // 裁剪到[-10, 10]
    }

    // ═══ 持久化 ═══
    _save() {
        try {
            const tableData = {};
            for (const [state, actions] of this._qTable) {
                tableData[state] = Object.fromEntries(actions);
            }
            fs.writeFileSync(this._dbPath, JSON.stringify({
                version: 1,
                qTable: tableData,
                epsilon: this._epsilon,
                stats: this._stats,
                replaySize: this._replayBuffer.length,
            }, null, 2));
        } catch {}
    }

    _load() {
        try {
            if (!fs.existsSync(this._dbPath)) return;
            const data = JSON.parse(fs.readFileSync(this._dbPath, 'utf8'));
            if (data.version !== 1) return;

            for (const [state, actions] of Object.entries(data.qTable || {})) {
                this._qTable.set(state, new Map(Object.entries(actions)));
            }
            if (data.epsilon) this._epsilon = data.epsilon;
            if (data.stats) Object.assign(this._stats, data.stats);

            const states = this._qTable.size;
            console.log(`${C.green}[QLearner]${C.reset} 加载Q-table: ${states}个状态, ε=${this._epsilon.toFixed(3)}`);
        } catch {}
    }

    save() { this._save(); }

    getStats() {
        return {
            ...this._stats,
            epsilon: this._epsilon,
            statesLearned: this._qTable.size,
            replayBufferSize: this._replayBuffer.length,
        };
    }

    // 获取当前最佳策略摘要
    getPolicy() {
        const policy = {};
        for (const [state, actions] of this._qTable) {
            let bestAction = 'WAIT', bestQ = -Infinity;
            for (const [action, q] of actions) {
                if (q > bestQ) { bestQ = q; bestAction = action; }
            }
            policy[state] = { action: bestAction, qValue: bestQ };
        }
        return policy;
    }
}

// ═══════════════════════════════════════════════
//  3. MCTS决策规划器
//     蒙特卡洛树搜索: 模拟→选择→扩展→回溯
// ═══════════════════════════════════════════════

class MCTSPlanner {
    constructor(options = {}) {
        this._simulations = options.simulations || 100;   // 每次决策模拟次数
        this._explorationC = options.explorationC || 1.41; // UCB1探索常数 (√2)
        this._maxDepth = options.maxDepth || 5;            // 最大搜索深度
        this._qLearner = options.qLearner || null;         // 复用Q-table评估

        this._actions = [
            'ANALYZE', 'LEARN', 'EVOLVE', 'REPAIR', 'DEPLOY',
            'SEARCH', 'WAIT', 'EXPLORE', 'OPTIMIZE',
        ];
    }

    // ═══ 核心: 规划最佳动作序列 ═══
    plan(currentState, stateEncoder) {
        // 创建根节点
        const root = this._createNode(currentState, null, null);

        // 运行N次模拟
        for (let i = 0; i < this._simulations; i++) {
            this._simulate(root, 0, stateEncoder);
        }

        // 选择访问次数最多的子节点 (最稳健)
        let bestChild = null, bestVisits = -1;
        for (const child of root.children) {
            if (child.visits > bestVisits) {
                bestVisits = child.visits;
                bestChild = child;
            }
        }

        // 收集完整规划路径
        const plan = [];
        let node = bestChild;
        while (node) {
            plan.push({
                action: node.action,
                visits: node.visits,
                avgValue: node.visits > 0 ? node.totalValue / node.visits : 0,
            });
            // 跟随最高访问子节点
            node = node.children.reduce((best, c) =>
                c.visits > (best?.visits || 0) ? c : best, null);
        }

        return {
            bestAction: bestChild?.action || 'WAIT',
            confidence: bestVisits / this._simulations,
            plan: plan.slice(0, this._maxDepth),
            rootVisits: root.visits,
            method: 'mcts',
        };
    }

    // ═══ MCTS四阶段: 选择→扩展→模拟→回溯 ═══
    _simulate(node, depth, stateEncoder) {
        // 终止条件
        if (depth >= this._maxDepth) {
            const value = this._evaluate(node.state);
            this._backpropagate(node, value);
            return;
        }

        // 选择 (UCB1)
        if (node.children.length > 0 && node.children.length >= this._actions.length) {
            const selected = this._selectUCB1(node);
            this._simulate(selected, depth + 1, stateEncoder);
            return;
        }

        // 扩展: 添加一个未尝试的动作
        const triedActions = new Set(node.children.map(c => c.action));
        const untried = this._actions.filter(a => !triedActions.has(a));

        if (untried.length > 0) {
            const action = untried[Math.floor(Math.random() * untried.length)];
            const nextState = this._transitionModel(node.state, action);
            const child = this._createNode(nextState, action, node);
            node.children.push(child);

            // 模拟 (rollout)
            const value = this._rollout(nextState, depth + 1);
            this._backpropagate(child, value);
        }
    }

    // ═══ UCB1选择 ═══
    _selectUCB1(node) {
        let bestChild = node.children[0];
        let bestUCB = -Infinity;

        for (const child of node.children) {
            const exploitation = child.visits > 0 ? child.totalValue / child.visits : 0;
            const exploration = this._explorationC *
                Math.sqrt(Math.log(node.visits + 1) / (child.visits + 1));
            const ucb = exploitation + exploration;

            if (ucb > bestUCB) {
                bestUCB = ucb;
                bestChild = child;
            }
        }

        return bestChild;
    }

    // ═══ 快速rollout (随机策略) ═══
    _rollout(state, depth) {
        let currentState = { ...state };
        let totalValue = 0;
        let discount = 1;

        for (let d = depth; d < this._maxDepth; d++) {
            const action = this._actions[Math.floor(Math.random() * this._actions.length)];
            currentState = this._transitionModel(currentState, action);
            totalValue += discount * this._evaluate(currentState);
            discount *= 0.9;
        }

        return totalValue;
    }

    // ═══ 回溯更新 ═══
    _backpropagate(node, value) {
        while (node) {
            node.visits++;
            node.totalValue += value;
            node = node.parent;
        }
    }

    // ═══ 状态转移模型 (简化) ═══
    _transitionModel(state, action) {
        const next = { ...state };

        switch (action) {
            case 'LEARN':
                next.knowledgeCount = (next.knowledgeCount || 0) + 1;
                next.stagnationCycles = 0;
                break;
            case 'EVOLVE':
                next.stagnationCycles = 0;
                next.memUsedPct = Math.min(100, (next.memUsedPct || 50) + 5);
                break;
            case 'REPAIR':
                next.hasError = false;
                next.memUsedPct = Math.max(20, (next.memUsedPct || 50) - 10);
                break;
            case 'ANALYZE':
                next.knowledgeCount = (next.knowledgeCount || 0) + 0.5;
                break;
            case 'DEPLOY':
                next.instances = (next.instances || 1) + 1;
                break;
            case 'WAIT':
                next.stagnationCycles = (next.stagnationCycles || 0) + 1;
                break;
            case 'OPTIMIZE':
                next.memUsedPct = Math.max(20, (next.memUsedPct || 50) - 5);
                break;
            default:
                next.stagnationCycles = (next.stagnationCycles || 0) + 0.5;
        }

        return next;
    }

    // ═══ 状态评估函数 ═══
    _evaluate(state) {
        let value = 0;

        // 知识越多越好
        value += Math.min(5, (state.knowledgeCount || 0) * 0.02);

        // 错误是坏的
        if (state.hasError) value -= 3;

        // 停滞是坏的
        value -= (state.stagnationCycles || 0) * 0.3;

        // 内存不能太高
        if ((state.memUsedPct || 50) > 80) value -= 2;

        // 实例越多越好
        value += Math.min(3, (state.instances || 1) * 0.5);

        // 利用Q-table提供更准确的评估
        if (this._qLearner) {
            const stateKey = this._qLearner.encodeState(state);
            const maxQ = this._qLearner._getMaxQ(stateKey);
            value += maxQ * 0.5; // 混合评估
        }

        return value;
    }

    _createNode(state, action, parent) {
        return {
            state, action, parent,
            children: [],
            visits: 0,
            totalValue: 0,
        };
    }
}

// ═══════════════════════════════════════════════
//  4. 知识图谱 (Knowledge Graph)
//     实体→关系→图遍历→推理
// ═══════════════════════════════════════════════

class KnowledgeGraph {
    constructor(options = {}) {
        this._nodes = new Map();   // id → {id, type, name, properties}
        this._edges = [];          // [{from, to, relation, weight}]
        this._dbPath = options.dbPath || path.join(__dirname, 'knowledge-graph.json');
        this._maxNodes = options.maxNodes || 2000;
        this._load();
    }

    // ═══ 添加实体 ═══
    addEntity(name, type = 'concept', properties = {}) {
        const id = this._normalizeId(name);
        if (this._nodes.has(id)) {
            // 合并属性
            const existing = this._nodes.get(id);
            Object.assign(existing.properties, properties);
            existing.accessCount = (existing.accessCount || 0) + 1;
            return id;
        }

        this._nodes.set(id, {
            id, type, name,
            properties,
            accessCount: 1,
            createdAt: Date.now(),
        });

        // 超限清理
        if (this._nodes.size > this._maxNodes) {
            this._pruneOldest();
        }

        return id;
    }

    // ═══ 添加关系 ═══
    addRelation(fromName, toName, relation, weight = 1.0) {
        const fromId = this._normalizeId(fromName);
        const toId = this._normalizeId(toName);

        // 确保节点存在
        if (!this._nodes.has(fromId)) this.addEntity(fromName);
        if (!this._nodes.has(toId)) this.addEntity(toName);

        // 检查重复
        const exists = this._edges.some(e =>
            e.from === fromId && e.to === toId && e.relation === relation
        );
        if (!exists) {
            this._edges.push({ from: fromId, to: toId, relation, weight, createdAt: Date.now() });
        }
    }

    // ═══ 从文本自动提取实体和关系 ═══
    extractFromText(text, metadata = {}) {
        const entities = [];
        const relations = [];

        // 简单NER: 提取技术术语
        const techTerms = text.match(/\b(?:JavaScript|Node\.js|Python|React|AI|LLM|GPU|CPU|API|HTTP|Docker|Kubernetes|Git|GitHub|Linux|Windows|SQL|NoSQL|Redis|MongoDB|TensorFlow|PyTorch|Ollama|embedding|vector|neural|brain|agent|evolution|memory|learning)\b/gi);

        if (techTerms) {
            const unique = [...new Set(techTerms.map(t => t.toLowerCase()))];
            for (const term of unique) {
                const id = this.addEntity(term, 'technology');
                entities.push(id);
            }

            // 自动建立共现关系
            for (let i = 0; i < unique.length; i++) {
                for (let j = i + 1; j < unique.length; j++) {
                    this.addRelation(unique[i], unique[j], 'co_occurs', 0.5);
                    relations.push(`${unique[i]}-co_occurs-${unique[j]}`);
                }
            }
        }

        // 提取 "X是Y" 模式
        const isPatterns = text.match(/(\w+(?:\.\w+)*)(?:是|用于|基于|支持|依赖|包含)(\w+(?:\.\w+)*)/g);
        if (isPatterns) {
            for (const pattern of isPatterns) {
                const match = pattern.match(/(\w+(?:\.\w+)*)(?:是|用于|基于|支持|依赖|包含)(\w+(?:\.\w+)*)/);
                if (match) {
                    const relation = pattern.includes('是') ? 'is_a' :
                        pattern.includes('用于') ? 'used_for' :
                        pattern.includes('基于') ? 'based_on' :
                        pattern.includes('包含') ? 'contains' : 'related_to';
                    this.addRelation(match[1], match[2], relation);
                    relations.push(`${match[1]}-${relation}-${match[2]}`);
                }
            }
        }

        return { entities: entities.length, relations: relations.length };
    }

    // ═══ 图遍历: 查找相关实体 (BFS) ═══
    findRelated(name, maxDepth = 2, maxResults = 20) {
        const startId = this._normalizeId(name);
        if (!this._nodes.has(startId)) return [];

        const visited = new Set([startId]);
        const queue = [{ id: startId, depth: 0, path: [] }];
        const results = [];

        while (queue.length > 0 && results.length < maxResults) {
            const { id, depth, path: currentPath } = queue.shift();
            if (depth > maxDepth) continue;

            // 找所有相邻边
            const neighbors = this._edges.filter(e => e.from === id || e.to === id);

            for (const edge of neighbors) {
                const neighborId = edge.from === id ? edge.to : edge.from;
                if (visited.has(neighborId)) continue;

                visited.add(neighborId);
                const node = this._nodes.get(neighborId);
                if (!node) continue;

                const newPath = [...currentPath, { relation: edge.relation, weight: edge.weight }];

                results.push({
                    entity: node.name,
                    type: node.type,
                    depth: depth + 1,
                    relation: edge.relation,
                    path: newPath,
                    relevance: edge.weight / (depth + 1), // 越近越相关
                });

                if (depth + 1 < maxDepth) {
                    queue.push({ id: neighborId, depth: depth + 1, path: newPath });
                }
            }
        }

        return results.sort((a, b) => b.relevance - a.relevance);
    }

    // ═══ 推理: 两实体之间的关系链 ═══
    findPath(fromName, toName, maxDepth = 4) {
        const fromId = this._normalizeId(fromName);
        const toId = this._normalizeId(toName);
        if (!this._nodes.has(fromId) || !this._nodes.has(toId)) return null;

        // BFS找最短路径
        const visited = new Set([fromId]);
        const queue = [{ id: fromId, path: [fromName] }];

        while (queue.length > 0) {
            const { id, path: currentPath } = queue.shift();
            if (currentPath.length > maxDepth + 1) continue;

            const neighbors = this._edges.filter(e => e.from === id || e.to === id);

            for (const edge of neighbors) {
                const neighborId = edge.from === id ? edge.to : edge.from;
                if (visited.has(neighborId)) continue;

                visited.add(neighborId);
                const node = this._nodes.get(neighborId);
                if (!node) continue;

                const newPath = [...currentPath, `--[${edge.relation}]-->`, node.name];

                if (neighborId === toId) {
                    return { found: true, path: newPath, length: (newPath.length - 1) / 2 };
                }

                queue.push({ id: neighborId, path: newPath });
            }
        }

        return { found: false };
    }

    // ═══ 工具方法 ═══
    _normalizeId(name) {
        return String(name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '_');
    }

    _pruneOldest() {
        const sorted = [...this._nodes.entries()]
            .sort((a, b) => (a[1].accessCount || 0) - (b[1].accessCount || 0));
        const toRemove = sorted.slice(0, Math.floor(this._maxNodes * 0.1)).map(([k]) => k);
        for (const id of toRemove) {
            this._nodes.delete(id);
            this._edges = this._edges.filter(e => e.from !== id && e.to !== id);
        }
    }

    save() {
        try {
            fs.writeFileSync(this._dbPath, JSON.stringify({
                version: 1,
                nodes: Object.fromEntries(this._nodes),
                edges: this._edges,
            }));
        } catch {}
    }

    _load() {
        try {
            if (!fs.existsSync(this._dbPath)) return;
            const data = JSON.parse(fs.readFileSync(this._dbPath, 'utf8'));
            if (data.version !== 1) return;

            for (const [id, node] of Object.entries(data.nodes || {})) {
                this._nodes.set(id, node);
            }
            this._edges = data.edges || [];

            console.log(`${C.green}[KnowledgeGraph]${C.reset} 加载: ${this._nodes.size}实体, ${this._edges.length}关系`);
        } catch {}
    }

    getStats() {
        return {
            entities: this._nodes.size,
            relations: this._edges.length,
            types: [...new Set([...this._nodes.values()].map(n => n.type))],
        };
    }
}

// ═══════════════════════════════════════════════
//  导出 + 自测
// ═══════════════════════════════════════════════

module.exports = { VectorMemory, RealQLearner, MCTSPlanner, KnowledgeGraph };

// 自测
if (require.main === module) {
    (async () => {
        console.log(`\n${C.magenta}═══ 向量大脑升级 v1.0 自测 ═══${C.reset}\n`);
        let passed = 0, total = 0;

        // 1. VectorMemory
        console.log(`${C.cyan}[1] 向量记忆测试${C.reset}`);
        total++;
        const vm = new VectorMemory({ dbPath: path.join(__dirname, 'test-vector-mem.json') });
        const added1 = await vm.add('JavaScript是一种动态类型的编程语言');
        const added2 = await vm.add('Python是用于机器学习的流行语言');
        const added3 = await vm.add('JavaScript是一种动态编程语言'); // 语义重复
        console.log(`  添加: ${added1} ${added2} ${added3}(应为false-语义重复)`);
        const results = await vm.search('编程语言设计模式', 3);
        console.log(`  搜索"编程语言设计模式": ${results.length}条 (top: ${results[0]?.text?.substring(0, 30)}... sim=${results[0]?.similarity?.toFixed(3)})`);
        if (added1 && added2 && !added3 && results.length > 0) {
            console.log(`  ${C.green}✓ 通过${C.reset}`); passed++;
        } else {
            console.log(`  ${C.red}✗ 失败${C.reset}`);
        }

        // 2. Q-Learning
        console.log(`\n${C.cyan}[2] Q-Learning测试${C.reset}`);
        total++;
        const ql = new RealQLearner({ dbPath: path.join(__dirname, 'test-q-table.json') });
        const state = ql.encodeState({ memUsedPct: 45, knowledgeCount: 120, cycle: 50, stagnationCycles: 0, aiProviders: 5 });
        console.log(`  状态编码: ${state}`);

        // 模拟10次决策+奖励
        for (let i = 0; i < 10; i++) {
            const decision = ql.selectAction(state);
            const reward = Math.random() > 0.5 ? 1.0 : -0.5;
            ql.receiveReward(reward, state);
        }
        const stats = ql.getStats();
        console.log(`  ${stats.decisions}次决策, ε=${stats.epsilon.toFixed(3)}, 状态${stats.statesLearned}个`);
        const policy = ql.getPolicy();
        console.log(`  策略: ${JSON.stringify(policy).substring(0, 100)}`);
        if (stats.decisions === 10 && stats.statesLearned > 0) {
            console.log(`  ${C.green}✓ 通过${C.reset}`); passed++;
        } else {
            console.log(`  ${C.red}✗ 失败${C.reset}`);
        }

        // 3. MCTS
        console.log(`\n${C.cyan}[3] MCTS搜索树测试${C.reset}`);
        total++;
        const mcts = new MCTSPlanner({ simulations: 50, qLearner: ql });
        const mctsState = { knowledgeCount: 100, memUsedPct: 50, stagnationCycles: 0, hasError: false };
        const plan = mcts.plan(mctsState);
        console.log(`  最佳动作: ${plan.bestAction} (置信度${(plan.confidence * 100).toFixed(0)}%)`);
        console.log(`  规划路径: ${plan.plan.map(p => p.action).join(' → ')}`);
        if (plan.bestAction && plan.confidence > 0 && plan.plan.length > 0) {
            console.log(`  ${C.green}✓ 通过${C.reset}`); passed++;
        } else {
            console.log(`  ${C.red}✗ 失败${C.reset}`);
        }

        // 4. KnowledgeGraph
        console.log(`\n${C.cyan}[4] 知识图谱测试${C.reset}`);
        total++;
        const kg = new KnowledgeGraph({ dbPath: path.join(__dirname, 'test-knowledge-graph.json') });
        kg.addEntity('JavaScript', 'language');
        kg.addEntity('Node.js', 'runtime');
        kg.addEntity('V8', 'engine');
        kg.addRelation('Node.js', 'JavaScript', 'runs');
        kg.addRelation('Node.js', 'V8', 'uses');
        kg.addRelation('V8', 'JavaScript', 'compiles');

        const related = kg.findRelated('Node.js', 2);
        console.log(`  Node.js相关: ${related.map(r => `${r.entity}(${r.relation})`).join(', ')}`);

        const kgPath = kg.findPath('Node.js', 'JavaScript');
        console.log(`  路径: ${kgPath?.path?.join(' ')}`);

        const extracted = kg.extractFromText('React是基于JavaScript的UI框架，用于构建Web应用');
        console.log(`  文本提取: ${extracted.entities}实体, ${extracted.relations}关系`);

        if (related.length >= 2 && kgPath?.found && extracted.entities > 0) {
            console.log(`  ${C.green}✓ 通过${C.reset}`); passed++;
        } else {
            console.log(`  ${C.red}✗ 失败${C.reset}`);
        }

        console.log(`\n${C.magenta}═══ 结果: ${passed}/${total} 通过 ═══${C.reset}\n`);

        // 清理测试文件
        for (const f of ['test-vector-mem.json', 'test-q-table.json', 'test-knowledge-graph.json']) {
            try { fs.unlinkSync(path.join(__dirname, f)); } catch {}
        }

        process.exit(passed === total ? 0 : 1);
    })();
}
