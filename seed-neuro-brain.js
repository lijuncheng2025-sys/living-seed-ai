/**
 * 活体种子AI - 神经科学级大脑架构 v1.0
 *
 * 真正的仿人脑结构 — 不是if-else，是神经通路
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    种子大脑 (NeuroBrain)                      ║
 * ║                                                              ║
 * ║  感知输入(Eyes)                                               ║
 * ║     ↓                                                        ║
 * ║  丘脑(Thalamus) ── 信息中继，路由到正确脑区                    ║
 * ║     ↓                                                        ║
 * ║  感知皮层(SensoryCortex) ── 处理视觉/文字/声音               ║
 * ║     ↓                 ↘                                      ║
 * ║  海马体(Hippocampus)   杏仁核(Amygdala)                       ║
 * ║  记忆形成/检索          重要性评估/情感标记                     ║
 * ║     ↓                     ↓                                  ║
 * ║  前额叶(PrefrontalCortex) ←──────┘                           ║
 * ║  规划/决策/推理/目标管理                                       ║
 * ║     ↓                                                        ║
 * ║  基底神经节(BasalGanglia) ── 动作选择/奖惩学习                ║
 * ║     ↓                                                        ║
 * ║  小脑(Cerebellum) ── 运动规划/习惯自动化                      ║
 * ║     ↓                                                        ║
 * ║  运动输出(Hands) ── 鼠标/键盘/浏览器操作                      ║
 * ║                                                              ║
 * ║  记忆系统:                                                    ║
 * ║    工作记忆(7±2槽) → 情景记忆 → 语义记忆 → 程序记忆           ║
 * ║                                                              ║
 * ║  进化机制:                                                    ║
 * ║    Hebbian学习 + 突触修剪 + 神经可塑性 + 睡眠整合             ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * 兼容:
 *   - seed-global-eyes.js (RealTimeEyes) — 全局实时视觉
 *   - seed-ai-agent.js (BrowserAgent) — 浏览器操控
 *   - seed-computer-agent.js — 桌面操控
 *   - Ollama 本地LLM — 高级推理
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { EventEmitter } = require('events');

const BRAIN_STATE_FILE = path.join(__dirname, 'neuro-brain-state.json');
const MEMORY_FILE = path.join(__dirname, 'neuro-memories.json');

// ═══════════════════════════════════════════════
//  神经元 & 突触 — 最基础的计算单元
// ═══════════════════════════════════════════════

class Synapse {
    constructor(fromId, toId, weight = null) {
        this.from = fromId;
        this.to = toId;
        this.weight = weight !== null ? weight : (Math.random() * 0.4 - 0.2);
        this.delta = 0;          // 最近权重变化
        this.fireCount = 0;      // 共同激活次数 (Hebbian)
        this.lastFire = 0;       // 上次激活时间
        this.myelination = 0;    // 髓鞘化程度 (0-1, 越高传导越快)
    }

    // Hebbian学习: "一起激活的突触变强"
    strengthen(amount = 0.01) {
        this.weight = Math.min(1.0, this.weight + amount);
        this.fireCount++;
        this.lastFire = Date.now();
        // 频繁使用 → 髓鞘化 → 传导更快
        this.myelination = Math.min(1.0, this.myelination + 0.001);
    }

    // 抑制: "不一起激活的突触变弱"
    weaken(amount = 0.005) {
        this.weight = Math.max(-1.0, this.weight - amount);
    }

    // 突触可塑性 — 时间衰减
    decay(rate = 0.0001) {
        // 长期不用的突触权重向0衰减
        const timeSinceUse = Date.now() - this.lastFire;
        if (timeSinceUse > 3600000) { // 1小时
            this.weight *= (1 - rate);
            this.myelination *= (1 - rate * 0.5);
        }
    }

    // 传导效率 (髓鞘化加速)
    get conductance() {
        return 1 + this.myelination * 2; // 1x-3x速度
    }
}

class Neuron {
    constructor(id, type = 'excitatory') {
        this.id = id;
        this.type = type;         // excitatory(兴奋) / inhibitory(抑制)
        this.activation = 0;      // 当前激活值
        this.threshold = 0.3;     // 激活阈值
        this.bias = 0;
        this.synapses = [];       // 输出突触
        this.inputSynapses = [];  // 输入突触
        this.lastActivation = 0;
        this.refractory = false;  // 不应期
    }

    // 接收输入信号
    receive(signal) {
        if (this.refractory) return 0;
        this.activation += signal;
        return this.activation;
    }

    // 激活函数 (类似生物神经元的全或无)
    fire() {
        if (this.activation < this.threshold) return 0;

        // 激活!
        const output = this._sigmoid(this.activation + this.bias);
        this.lastActivation = Date.now();

        // 短暂不应期
        this.refractory = true;
        setTimeout(() => { this.refractory = false; }, 1);

        // 通过突触传递信号
        for (const syn of this.synapses) {
            const signal = output * syn.weight * syn.conductance;
            syn.strengthen(0.002); // Hebbian: 激活时加强
        }

        // 重置激活值
        this.activation *= 0.1; // 保留10%残余

        return output;
    }

    _sigmoid(x) {
        return 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, x))));
    }

    reset() {
        this.activation = 0;
        this.refractory = false;
    }
}

// ═══════════════════════════════════════════════
//  脑区基类 — 所有脑区的公共接口
// ═══════════════════════════════════════════════

class BrainRegion extends EventEmitter {
    constructor(name, neuronCount = 64) {
        super();
        this.name = name;
        this.neurons = [];
        this.active = false;
        this._lastProcess = 0;

        // 创建神经元群
        for (let i = 0; i < neuronCount; i++) {
            this.neurons.push(new Neuron(`${name}_${i}`, i % 5 === 0 ? 'inhibitory' : 'excitatory'));
        }
    }

    // 接收输入信号并处理
    async process(input) {
        this.active = true;
        this._lastProcess = Date.now();
        const result = await this._compute(input);
        this.active = false;
        return result;
    }

    // 子类必须实现
    async _compute(input) {
        throw new Error(`${this.name}._compute() not implemented`);
    }

    // 将输入编码为神经元激活模式 (文本→向量)
    _encode(text) {
        if (typeof text !== 'string') text = JSON.stringify(text).substring(0, 500);
        const vec = new Float32Array(this.neurons.length).fill(0);
        for (let i = 0; i < text.length && i < vec.length * 4; i++) {
            const idx = i % vec.length;
            vec[idx] += text.charCodeAt(i) / 65536;
        }
        // 归一化
        let maxVal = 0;
        for (let i = 0; i < vec.length; i++) maxVal = Math.max(maxVal, Math.abs(vec[i]));
        if (maxVal > 0) for (let i = 0; i < vec.length; i++) vec[i] /= maxVal;
        return vec;
    }

    // 将神经元激活模式解码
    _decode(vec) {
        let sum = 0;
        for (let i = 0; i < vec.length; i++) sum += vec[i];
        return sum / vec.length;
    }

    getState() {
        return {
            name: this.name,
            active: this.active,
            neuronCount: this.neurons.length,
            lastProcess: this._lastProcess,
        };
    }
}

// ═══════════════════════════════════════════════
//  丘脑 (Thalamus) — 信息中继站
//  所有感知输入先到这里，路由到正确的脑区
// ═══════════════════════════════════════════════

class Thalamus extends BrainRegion {
    constructor() {
        super('thalamus', 32);
        this.routes = new Map(); // 信号类型 → 目标脑区
        this.filterThreshold = 0.1; // 太弱的信号过滤掉
    }

    registerRoute(signalType, targetRegion) {
        if (!this.routes.has(signalType)) this.routes.set(signalType, []);
        this.routes.get(signalType).push(targetRegion);
    }

    async _compute(input) {
        // input: { type, data, intensity }
        const { type, data, intensity = 1.0 } = input;

        // 过滤低强度信号 (注意力门控)
        if (intensity < this.filterThreshold) {
            return { routed: false, reason: 'below_threshold' };
        }

        // 路由到对应脑区
        const targets = this.routes.get(type) || this.routes.get('default') || [];
        const results = [];

        for (const target of targets) {
            const result = await target.process({ type, data, intensity, source: 'thalamus' });
            results.push({ region: target.name, result });
        }

        return { routed: true, type, targetCount: results.length, results };
    }

    // 动态调整注意力阈值
    adjustAttention(urgency) {
        // 紧急情况降低阈值(让更多信号通过)
        this.filterThreshold = urgency > 0.7 ? 0.01 : 0.1;
    }
}

// ═══════════════════════════════════════════════
//  感知皮层 (SensoryCortex) — 处理感知输入
//  视觉、文字、窗口变化等
// ═══════════════════════════════════════════════

class SensoryCortex extends BrainRegion {
    constructor() {
        super('sensory_cortex', 128);
        this._lastScene = null;
        this._featureMap = new Map(); // 特征缓存
    }

    async _compute(input) {
        const { type, data } = input;

        switch (type) {
            case 'visual_change':
                return this._processVisualChange(data);
            case 'ocr_text':
                return this._processText(data);
            case 'window_switch':
                return this._processWindowSwitch(data);
            case 'vlm_understanding':
            case 'vision_understanding':
                return this._processVLMUnderstanding(data);
            case 'system_status':
                return this._processSystemStatus(data);
            case 'evolution_status':
                return this._processEvolutionStatus(data);
            case 'user_input':
                return this._processUserInput(data);
            default:
                return { processed: false, type };
        }
    }

    _processVisualChange(data) {
        const { changeRatio, windows, foreground } = data;

        // 提取场景特征
        const scene = {
            changeLevel: changeRatio > 0.5 ? 'major' : changeRatio > 0.1 ? 'moderate' : 'minor',
            windowCount: windows?.length || 0,
            foregroundApp: foreground?.appName || 'unknown',
            foregroundTitle: foreground?.title || '',
            timestamp: Date.now(),
        };

        // 与上一帧对比，提取变化特征
        const features = [];
        if (this._lastScene) {
            if (scene.foregroundApp !== this._lastScene.foregroundApp) {
                features.push({ type: 'app_switch', from: this._lastScene.foregroundApp, to: scene.foregroundApp, importance: 0.9 });
            }
            if (scene.changeLevel === 'major') {
                features.push({ type: 'major_change', importance: 0.8 });
            }
        }

        this._lastScene = scene;

        return {
            processed: true,
            type: 'visual',
            scene,
            features,
            importance: Math.min(1.0, changeRatio * 2 + features.length * 0.3),
        };
    }

    _processText(data) {
        const { text, words } = data;
        if (!text || text.length < 5) return { processed: false, reason: 'empty' };

        // 提取关键信息
        const keywords = [];
        const patterns = {
            apiKey: /(?:AIza|gsk_|sk-|hf_)[A-Za-z0-9_-]{10,}/g,
            url: /https?:\/\/[^\s<>"]+/g,
            error: /(?:error|错误|失败|failed|exception)/gi,
            success: /(?:success|成功|完成|done|saved)/gi,
            button: /(?:click|点击|按钮|button|submit|确认)/gi,
            number: /\b\d+\.?\d*\b/g,
        };

        for (const [name, regex] of Object.entries(patterns)) {
            const matches = text.match(regex);
            if (matches) {
                keywords.push({ type: name, values: matches.slice(0, 5) });
            }
        }

        // Vision-Agent action grounding: 提取可交互目标
        const actionTargets = this._extractActionTargets(data);

        return {
            processed: true,
            type: 'text',
            textLength: text.length,
            keywords,
            actionTargets,
            summary: text.substring(0, 300),
            importance: keywords.some(k => k.type === 'apiKey' || k.type === 'error') ? 0.9 : 0.3,
        };
    }

    // ── Vision-Agent Action Grounding ──
    // 从OCR文字中提取可交互元素 (Computer-Use-Agent模式)
    _extractActionTargets(ocrData) {
        const targets = [];
        const text = ocrData.text || '';
        const targetPatterns = {
            button: /(?:Sign in|Log in|Create|Get|Copy|Submit|OK|Cancel|确认|取消|登录|注册|获取|创建|复制)/gi,
            input: /(?:Email|Password|Username|Search|用户名|密码|搜索|输入)/gi,
            link: /https?:\/\/[^\s<>"]+/g,
            apiKey: /(?:AIza|gsk_|sk-|hf_)[A-Za-z0-9_-]{10,}/g,
        };
        for (const [type, regex] of Object.entries(targetPatterns)) {
            let match;
            while ((match = regex.exec(text)) !== null) {
                targets.push({ type, text: match[0], index: match.index });
            }
        }
        return targets;
    }

    _processWindowSwitch(data) {
        return {
            processed: true,
            type: 'window',
            app: data.app,
            title: data.title,
            importance: 0.7,
        };
    }

    _processVLMUnderstanding(data) {
        return {
            processed: true,
            type: 'vision_understanding',  // 保持type一致，让_fastDecide能匹配
            understanding: data.understanding,
            content: data.understanding,
            changeRatio: data.changeRatio,
            importance: 0.8,
        };
    }

    _processSystemStatus(data) {
        return {
            processed: true,
            type: 'system_status',
            memUsedPct: data.memUsedPct,
            memFreeMB: data.memFreeMB,
            cpuLoad: data.cpuLoad,
            uptime: data.uptime,
            heapMB: data.heapMB,
            cycle: data.cycle,
            stats: data.stats,
            importance: data.memUsedPct > 85 ? 0.9 : 0.4,
        };
    }

    _processEvolutionStatus(data) {
        return {
            processed: true,
            type: 'evolution_status',
            knowledgeCount: data.knowledgeCount,
            lastLearn: data.lastLearn,
            fleetHealth: data.fleetHealth,
            importance: 0.3,
        };
    }

    _processUserInput(data) {
        return {
            processed: true,
            type: 'user_input',
            text: data.text,
            intent: this._quickIntentDetect(data.text),
            importance: 1.0, // 用户输入最高优先级
        };
    }

    _quickIntentDetect(text) {
        const lower = text.toLowerCase();
        const intents = [
            { name: 'navigate', keywords: ['打开', '去', '访问', 'open', 'go to', 'navigate'] },
            { name: 'click', keywords: ['点击', '按', 'click', 'press', 'tap'] },
            { name: 'type', keywords: ['输入', '填写', 'type', 'enter', 'write'] },
            { name: 'search', keywords: ['搜索', '查找', 'search', 'find', 'look'] },
            { name: 'create', keywords: ['创建', '新建', 'create', 'new', 'make'] },
            { name: 'learn', keywords: ['学习', '进化', 'learn', 'evolve', 'improve'] },
            { name: 'observe', keywords: ['看', '监控', 'watch', 'monitor', 'observe'] },
            { name: 'stop', keywords: ['停止', '关闭', 'stop', 'close', 'quit'] },
        ];

        for (const { name, keywords } of intents) {
            if (keywords.some(k => lower.includes(k))) return name;
        }
        return 'unknown';
    }
}

// ═══════════════════════════════════════════════
//  海马体 (Hippocampus) — 记忆形成与检索
//  四层记忆系统的核心
// ═══════════════════════════════════════════════

class Hippocampus extends BrainRegion {
    constructor() {
        super('hippocampus', 64);

        // ── 四层记忆系统 ──
        this.workingMemory = [];      // 工作记忆 (7±2个槽位, 秒级)
        this.episodicMemory = [];     // 情景记忆 (带时间的经历, 天级)
        this.semanticMemory = new Map(); // 语义记忆 (事实/知识, 永久)
        this.proceduralMemory = new Map(); // 程序记忆 (技能/流程, 永久)

        this.WM_CAPACITY = 7;     // 工作记忆容量 (Miller's law)
        this.EM_MAX = 2000;       // 情景记忆最大条数
        this.consolidationQueue = []; // 待整合的短期记忆

        this._loadFromDisk();
    }

    async _compute(input) {
        const { data, source } = input;

        // 来自感知皮层的信号 → 存入工作记忆
        if (source === 'sensory_cortex' || source === 'thalamus') {
            return this._encodeNewMemory(data);
        }

        // 来自前额叶的检索请求
        if (data?.action === 'recall') {
            return this._recall(data.query, data.type);
        }

        // 来自前额叶的存储请求
        if (data?.action === 'store') {
            return this._store(data);
        }

        return { processed: false };
    }

    // ── 工作记忆 ──
    _encodeNewMemory(perceptData) {
        const memory = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            content: perceptData,
            importance: perceptData?.importance || 0.5,
            timestamp: Date.now(),
            accessCount: 0,
            emotionalTag: null, // 由杏仁核标记
        };

        // 存入工作记忆
        this.workingMemory.push(memory);

        // 工作记忆溢出 → 推入整合队列
        while (this.workingMemory.length > this.WM_CAPACITY) {
            const evicted = this.workingMemory.shift();
            this.consolidationQueue.push(evicted);
        }

        // 定期整合
        if (this.consolidationQueue.length >= 5) {
            this._consolidate();
        }

        return { stored: true, memoryId: memory.id, wmSize: this.workingMemory.length };
    }

    // ── 记忆整合 (短期 → 长期) ──
    _consolidate() {
        const toConsolidate = this.consolidationQueue.splice(0);

        for (const mem of toConsolidate) {
            // 重要的 → 情景记忆
            if (mem.importance >= 0.5 || mem.emotionalTag) {
                this.episodicMemory.push({
                    ...mem,
                    consolidatedAt: Date.now(),
                });

                // 非常重要的 → 同时提取到语义记忆
                if (mem.importance >= 0.8) {
                    this._extractSemantic(mem);
                }
            }

            // 动作序列 → 程序记忆
            if (mem.content?.type === 'action_sequence') {
                this._storeProceduralMemory(mem);
            }
        }

        // 情景记忆容量限制
        while (this.episodicMemory.length > this.EM_MAX) {
            // 淘汰最旧且最少访问的
            let weakest = 0;
            let weakestScore = Infinity;
            for (let i = 0; i < this.episodicMemory.length; i++) {
                const score = this.episodicMemory[i].importance * 0.4 +
                    this.episodicMemory[i].accessCount * 0.3 +
                    (1 - (Date.now() - this.episodicMemory[i].timestamp) / (86400000 * 30)) * 0.3;
                if (score < weakestScore) {
                    weakestScore = score;
                    weakest = i;
                }
            }
            this.episodicMemory.splice(weakest, 1);
        }

        this._saveToDisk();
    }

    // ── 语义记忆提取 ──
    _extractSemantic(mem) {
        const content = mem.content;
        if (!content) return;

        // 从感知数据中提取事实
        if (content.keywords) {
            for (const kw of content.keywords) {
                const key = `${kw.type}:${kw.values?.[0] || ''}`;
                const existing = this.semanticMemory.get(key);
                if (existing) {
                    existing.confidence = Math.min(1.0, existing.confidence + 0.1);
                    existing.lastSeen = Date.now();
                } else {
                    this.semanticMemory.set(key, {
                        type: kw.type,
                        value: kw.values,
                        confidence: 0.5,
                        firstSeen: Date.now(),
                        lastSeen: Date.now(),
                        source: mem.content?.type || 'unknown',
                    });
                }
            }
        }

        // 从场景中提取
        if (content.scene) {
            const key = `app:${content.scene.foregroundApp}`;
            const existing = this.semanticMemory.get(key);
            if (existing) {
                existing.encounters = (existing.encounters || 0) + 1;
                existing.lastSeen = Date.now();
            } else {
                this.semanticMemory.set(key, {
                    type: 'app_knowledge',
                    app: content.scene.foregroundApp,
                    title: content.scene.foregroundTitle,
                    encounters: 1,
                    firstSeen: Date.now(),
                    lastSeen: Date.now(),
                });
            }
        }
    }

    // ── 程序记忆 (技能自动化) ──
    _storeProceduralMemory(mem) {
        const seq = mem.content;
        const key = seq.goal || seq.pattern || `proc_${this.proceduralMemory.size}`;

        const existing = this.proceduralMemory.get(key);
        if (existing) {
            existing.successCount += seq.success ? 1 : 0;
            existing.totalCount += 1;
            existing.successRate = existing.successCount / existing.totalCount;
            existing.lastUsed = Date.now();
            // 更新步骤（如果新的更短/更成功）
            if (seq.success && seq.steps.length < existing.steps.length) {
                existing.steps = seq.steps;
            }
        } else {
            this.proceduralMemory.set(key, {
                goal: key,
                steps: seq.steps || [],
                successCount: seq.success ? 1 : 0,
                totalCount: 1,
                successRate: seq.success ? 1.0 : 0,
                createdAt: Date.now(),
                lastUsed: Date.now(),
            });
        }
    }

    // ── 记忆检索 ──
    _recall(query, memType = 'all') {
        const results = [];
        const queryLower = (typeof query === 'string' ? query : JSON.stringify(query)).toLowerCase();

        // 1. 工作记忆 (最快)
        if (memType === 'all' || memType === 'working') {
            for (const mem of this.workingMemory) {
                const content = JSON.stringify(mem.content).toLowerCase();
                if (content.includes(queryLower)) {
                    mem.accessCount++;
                    results.push({ source: 'working', memory: mem, relevance: 1.0 });
                }
            }
        }

        // 2. 情景记忆 (按相关度排序)
        if (memType === 'all' || memType === 'episodic') {
            const scored = [];
            for (const mem of this.episodicMemory) {
                const content = JSON.stringify(mem.content).toLowerCase();
                if (content.includes(queryLower)) {
                    mem.accessCount++;
                    const recency = 1 - Math.min(1, (Date.now() - mem.timestamp) / (86400000 * 7));
                    scored.push({
                        source: 'episodic',
                        memory: mem,
                        relevance: 0.5 + recency * 0.3 + mem.importance * 0.2,
                    });
                }
            }
            scored.sort((a, b) => b.relevance - a.relevance);
            results.push(...scored.slice(0, 10));
        }

        // 3. 语义记忆 (事实查找)
        if (memType === 'all' || memType === 'semantic') {
            for (const [key, fact] of this.semanticMemory) {
                if (key.toLowerCase().includes(queryLower) ||
                    JSON.stringify(fact).toLowerCase().includes(queryLower)) {
                    results.push({ source: 'semantic', key, fact, relevance: fact.confidence || 0.5 });
                }
            }
        }

        // 4. 程序记忆 (技能检索)
        if (memType === 'all' || memType === 'procedural') {
            for (const [key, proc] of this.proceduralMemory) {
                if (key.toLowerCase().includes(queryLower)) {
                    results.push({
                        source: 'procedural',
                        goal: key,
                        steps: proc.steps,
                        successRate: proc.successRate,
                        relevance: proc.successRate * 0.7 + 0.3,
                    });
                }
            }
        }

        results.sort((a, b) => b.relevance - a.relevance);
        return { found: results.length, results: results.slice(0, 20) };
    }

    // ── 手动存储 ──
    _store(data) {
        if (data.type === 'semantic') {
            this.semanticMemory.set(data.key, {
                ...data.value,
                storedAt: Date.now(),
            });
            this._saveToDisk();
            return { stored: true, type: 'semantic', key: data.key };
        }

        if (data.type === 'procedural') {
            this._storeProceduralMemory({ content: data.value });
            this._saveToDisk();
            return { stored: true, type: 'procedural' };
        }

        if (data.type === 'episodic') {
            this.episodicMemory.push({
                id: Date.now().toString(36),
                content: data.value,
                importance: data.importance || 0.5,
                timestamp: Date.now(),
                accessCount: 0,
                emotionalTag: data.emotion || null,
            });
            this._saveToDisk();
            return { stored: true, type: 'episodic' };
        }

        return { stored: false };
    }

    // ── 持久化 ──
    _saveToDisk() {
        try {
            const state = {
                episodicMemory: this.episodicMemory.slice(-this.EM_MAX),
                semanticMemory: Object.fromEntries(this.semanticMemory),
                proceduralMemory: Object.fromEntries(this.proceduralMemory),
                savedAt: new Date().toISOString(),
            };
            fs.writeFileSync(MEMORY_FILE, JSON.stringify(state, null, 2));
        } catch (e) {
            console.log('[Hippocampus] 保存失败:', e.message);
        }
    }

    _loadFromDisk() {
        try {
            if (!fs.existsSync(MEMORY_FILE)) return;
            const state = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));

            if (state.episodicMemory) this.episodicMemory = state.episodicMemory;
            if (state.semanticMemory) {
                this.semanticMemory = new Map(Object.entries(state.semanticMemory));
            }
            if (state.proceduralMemory) {
                this.proceduralMemory = new Map(Object.entries(state.proceduralMemory));
            }

            console.log(`[Hippocampus] 加载记忆: ${this.episodicMemory.length}情景, ${this.semanticMemory.size}语义, ${this.proceduralMemory.size}程序`);
        } catch (e) {
            console.log('[Hippocampus] 加载记忆失败:', e.message);
        }
    }

    // ── 睡眠整合 (定期执行，类似人类睡眠时的记忆整合) ──
    sleepConsolidate() {
        console.log('[Hippocampus] 开始睡眠整合...');

        // 1. 认知更新公式: Kt = K(t-1)*(1-δ) + η*ΔK 更新记忆重要性
        for (const mem of this.episodicMemory) {
            const delta = mem.accessCount > 5 ? 0.2 : mem.accessCount > 2 ? 0.05 : -0.05;
            mem.importance = QuantFormulas.cognitiveUpdate(mem.importance, delta, 0.02, 0.3);
            mem.importance = Math.max(0, Math.min(1.0, mem.importance));
        }

        // 2. 从情景记忆中提取反复出现的模式 → 语义记忆
        const patterns = new Map();
        for (const mem of this.episodicMemory) {
            const key = mem.content?.type || 'unknown';
            if (!patterns.has(key)) patterns.set(key, 0);
            patterns.set(key, patterns.get(key) + 1);
        }

        for (const [pattern, count] of patterns) {
            if (count >= 3) {
                const smKey = `pattern:${pattern}`;
                if (!this.semanticMemory.has(smKey)) {
                    this.semanticMemory.set(smKey, {
                        type: 'extracted_pattern',
                        pattern,
                        occurrences: count,
                        extractedAt: Date.now(),
                        confidence: Math.min(1.0, count / 10),
                    });
                }
            }
        }

        // 3. 遗忘过旧且不重要的记忆
        const cutoff = Date.now() - 86400000 * 30; // 30天
        this.episodicMemory = this.episodicMemory.filter(mem =>
            mem.timestamp > cutoff || mem.importance > 0.7 || mem.accessCount > 3
        );

        this._saveToDisk();
        console.log(`[Hippocampus] 整合完成. 情景:${this.episodicMemory.length} 语义:${this.semanticMemory.size} 程序:${this.proceduralMemory.size}`);
    }

    getMemoryStats() {
        return {
            working: this.workingMemory.length,
            episodic: this.episodicMemory.length,
            semantic: this.semanticMemory.size,
            procedural: this.proceduralMemory.size,
            consolidationQueue: this.consolidationQueue.length,
        };
    }
}

// ═══════════════════════════════════════════════
//  杏仁核 (Amygdala) — 重要性评估 & 情感标记
// ═══════════════════════════════════════════════

class Amygdala extends BrainRegion {
    constructor() {
        super('amygdala', 32);
        this.emotionalState = {
            urgency: 0,       // 紧迫感 (0-1)
            curiosity: 0.5,   // 好奇心 (0-1)
            satisfaction: 0.5, // 满足感 (0-1)
            frustration: 0,   // 挫败感 (0-1)
        };
        this.rewardHistory = [];
    }

    async _compute(input) {
        const { data } = input;

        // 评估重要性
        const assessment = this._assessImportance(data);

        // 更新情感状态
        this._updateEmotions(assessment);

        // 给记忆打情感标记
        return {
            importance: assessment.importance,
            emotionalTag: assessment.emotion,
            urgency: this.emotionalState.urgency,
            shouldAct: assessment.importance > 0.6 || this.emotionalState.urgency > 0.7,
        };
    }

    _assessImportance(data) {
        let importance = 0.3; // 基线
        let emotion = 'neutral';

        if (!data) return { importance, emotion };

        // 用户输入 → 最高重要性
        if (data.type === 'user_input') {
            importance = 1.0;
            emotion = 'attention';
        }

        // 错误/失败 → 高重要性 + 紧迫
        if (data.keywords?.some(k => k.type === 'error')) {
            importance = Math.max(importance, 0.9);
            emotion = 'alarm';
        }

        // API Key发现 → 高重要性 + 奖励
        if (data.keywords?.some(k => k.type === 'apiKey')) {
            importance = Math.max(importance, 0.95);
            emotion = 'reward';
        }

        // 成功完成 → 奖励
        if (data.keywords?.some(k => k.type === 'success')) {
            importance = Math.max(importance, 0.7);
            emotion = 'reward';
        }

        // 窗口切换 → 中等重要性
        if (data.type === 'window') {
            importance = Math.max(importance, 0.6);
            emotion = 'attention';
        }

        // 大幅画面变化 → 注意
        if (data.changeLevel === 'major') {
            importance = Math.max(importance, 0.7);
            emotion = 'attention';
        }

        return { importance, emotion };
    }

    _updateEmotions(assessment) {
        const decay = 0.95; // 情绪衰减

        // 衰减现有情绪
        this.emotionalState.urgency *= decay;
        this.emotionalState.frustration *= decay;

        // 根据评估更新
        switch (assessment.emotion) {
            case 'alarm':
                this.emotionalState.urgency = Math.min(1.0, this.emotionalState.urgency + 0.3);
                break;
            case 'reward':
                this.emotionalState.satisfaction = Math.min(1.0, this.emotionalState.satisfaction + 0.2);
                this.emotionalState.frustration *= 0.5; // 奖励减少挫败
                this.rewardHistory.push({ time: Date.now(), type: 'success' });
                break;
            case 'attention':
                this.emotionalState.curiosity = Math.min(1.0, this.emotionalState.curiosity + 0.1);
                break;
        }

        // 长期无奖励 → 挫败感上升
        const lastReward = this.rewardHistory[this.rewardHistory.length - 1];
        if (!lastReward || Date.now() - lastReward.time > 300000) { // 5分钟
            this.emotionalState.frustration = Math.min(1.0, this.emotionalState.frustration + 0.02);
        }

        // 保持历史合理大小
        if (this.rewardHistory.length > 100) this.rewardHistory = this.rewardHistory.slice(-50);
    }

    getEmotionalState() {
        return { ...this.emotionalState };
    }
}

// ═══════════════════════════════════════════════
//  推理引擎 (ReasoningEngine) — 5大推理模式
//  溯因 · 微特征 · 分层解构 · 逆向推演 · 合情推理
// ═══════════════════════════════════════════════

class ReasoningEngine {
    constructor() {
        this.hypothesisCache = new Map();
        this.priors = new Map();
    }

    // 1. 溯因推理 (Abductive) + 贝叶斯
    // 观察现象 → 生成假设 → P(H|E) = P(E|H)*P(H) / Σ P(E|Hi)*P(Hi) → 最佳解释
    abductiveReason(observation, candidates) {
        const totalEvidence = candidates.reduce((s, c) =>
            s + (c.likelihood * (c.prior || 0.5)), 0) || 1;
        return candidates.map(c => ({
            ...c,
            posterior: (c.likelihood * (c.prior || 0.5)) / totalEvidence,
        })).sort((a, b) => b.posterior - a.posterior);
    }

    // 2. 微特征推理 — Sg = Σ(wi * Fi) + bias → sigmoid归一化
    microFeatureInfer(features) {
        const bias = 0;
        const score = features.reduce((s, f) => s + (f.weight * f.value), bias);
        return {
            score,
            normalized: 1 / (1 + Math.exp(-score)),
            dominant: features.sort((a, b) =>
                Math.abs(b.weight * b.value) - Math.abs(a.weight * a.value))[0]?.name,
        };
    }

    // 3. 分层解构 — 复杂问题 → 子问题树
    hierarchicalDecompose(problem, maxDepth = 3) {
        const tree = { problem, depth: 0, children: [], solved: false };
        this._decompose(tree, maxDepth);
        return tree;
    }
    _decompose(node, maxDepth) {
        if (node.depth >= maxDepth) { node.solved = true; return; }
        const parts = (node.problem || '').split(/[,;，；和与&]/);
        if (parts.length <= 1) { node.solved = true; return; }
        node.children = parts.map(p => ({
            problem: p.trim(), depth: node.depth + 1, children: [], solved: false,
        }));
        node.children.forEach(c => this._decompose(c, maxDepth));
    }

    // 4. 逆向推演 — 目标状态 → 反推GAP → 关键路径
    reverseEngineer(goal, currentState) {
        const gaps = [];
        for (const [key, target] of Object.entries(goal)) {
            const current = currentState[key];
            if (current !== target) {
                gaps.push({ key, current, target, action: `change_${key}` });
            }
        }
        return { gaps, stepsNeeded: gaps.length, feasible: gaps.length < 10 };
    }

    // 5. 合情推理 (Plausible) — 相似案例加权投票
    plausibleReason(observation, knownCases) {
        if (!knownCases.length) return { prediction: null, confidence: 0 };
        const weighted = knownCases.map(c => ({
            outcome: c.outcome,
            weight: c.similarity * (c.reliability || 0.8),
        }));
        const totalWeight = weighted.reduce((s, w) => s + w.weight, 0) || 1;
        const votes = {};
        for (const w of weighted) { votes[w.outcome] = (votes[w.outcome] || 0) + w.weight; }
        const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
        return {
            prediction: best?.[0],
            confidence: (best?.[1] || 0) / totalWeight,
            alternatives: Object.entries(votes).map(([o, w]) => ({ outcome: o, confidence: w / totalWeight })),
        };
    }

    // 综合推理入口 — 自动选择适用的推理模式
    reason(perception, context) {
        const results = {};

        // 溯因: 有错误/异常 → 推断原因
        if (perception.keywords?.some(k => k.type === 'error')) {
            results.abductive = this.abductiveReason(perception.summary, [
                { hypothesis: 'network_error', likelihood: 0.7, prior: 0.3 },
                { hypothesis: 'code_bug', likelihood: 0.6, prior: 0.4 },
                { hypothesis: 'resource_limit', likelihood: 0.5, prior: 0.2 },
                { hypothesis: 'config_wrong', likelihood: 0.4, prior: 0.3 },
            ]);
        }

        // 微特征: 综合多维信号
        const features = [];
        if (perception.importance) features.push({ name: 'importance', value: perception.importance, weight: 2.0 });
        if (context?.emotions?.urgency) features.push({ name: 'urgency', value: context.emotions.urgency, weight: 1.5 });
        if (context?.emotions?.curiosity) features.push({ name: 'curiosity', value: context.emotions.curiosity, weight: 0.8 });
        if (perception.keywords?.length) features.push({ name: 'keywords', value: perception.keywords.length / 5, weight: 1.0 });
        if (features.length > 0) {
            results.microFeature = this.microFeatureInfer(features);
        }

        return results;
    }
}

// ═══════════════════════════════════════════════
//  效应模拟器 (EffectSimulator) — 10大效应模型
//  多米诺 · 破窗 · 阈值 · 反馈 · 路径依赖
//  羊群 · 蝴蝶/混沌 · 市场 · 共生 · 鲶鱼
// ═══════════════════════════════════════════════

class EffectSimulator {
    constructor() {
        this.chainState = new Map();
        this.pathHistory = [];
        this.thresholds = new Map();
    }

    // 1. 多米诺效应 — Rk = R(k-1) * α + β 级联衰减传播
    dominoChain(trigger, chain, alpha = 0.8, beta = 0.1) {
        let impact = trigger.impact || 1.0;
        const results = [{ step: 0, node: trigger.node, impact }];
        for (let k = 1; k < chain.length; k++) {
            impact = impact * alpha + beta;
            if (impact < 0.05) break;
            results.push({ step: k, node: chain[k], impact });
        }
        return { triggered: results.length, chain: results, totalImpact: results.reduce((s, r) => s + r.impact, 0) };
    }

    // 2. 破窗效应 — 未修复问题数 > 阈值 → 加速退化
    brokenWindow(issues) {
        const unfixed = issues.filter(i => !i.fixed).length;
        const degradation = unfixed > 3 ? Math.pow(1.1, unfixed - 3) : 1.0;
        return {
            unfixed, degradation, critical: unfixed > 5,
            recommendation: unfixed > 3 ? 'FIX_NOW' : unfixed > 0 ? 'SCHEDULE_FIX' : 'HEALTHY',
        };
    }

    // 3. 阈值触发 — T = 1 if |X - X̄| > λσ (统计异常检测)
    thresholdTrigger(metric, lambda = 2.0) {
        const key = metric.name;
        if (!this.thresholds.has(key)) this.thresholds.set(key, { values: [], mean: 0, std: 1 });
        const t = this.thresholds.get(key);
        t.values.push(metric.value);
        if (t.values.length > 100) t.values.shift();
        t.mean = t.values.reduce((s, v) => s + v, 0) / t.values.length;
        const variance = t.values.reduce((s, v) => s + Math.pow(v - t.mean, 2), 0) / t.values.length;
        t.std = Math.sqrt(variance) || 1;
        const deviation = Math.abs(metric.value - t.mean);
        return { triggered: deviation > lambda * t.std, deviation, threshold: lambda * t.std, zscore: deviation / t.std };
    }

    // 4. 反馈强化 — 正/负反馈循环
    feedbackReinforce(action, reward) {
        return { reinforced: reward > 0, strength: Math.abs(reward), suggestion: reward > 0 ? 'REPEAT' : 'AVOID' };
    }

    // 5. 路径依赖 — 历史选择锁定检测
    pathDependency(currentChoice) {
        this.pathHistory.push(currentChoice);
        if (this.pathHistory.length > 50) this.pathHistory.shift();
        const freq = {};
        for (const h of this.pathHistory) { freq[h] = (freq[h] || 0) + 1; }
        const total = this.pathHistory.length;
        const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
        const lockIn = (dominant?.[1] || 0) / total;
        return { lockIn, dominantPath: dominant?.[0], shouldExplore: lockIn > 0.7 };
    }

    // 6. 羊群效应 — 多源共识强度
    herdingEffect(sources) {
        const votes = {};
        for (const s of sources) { votes[s.opinion] = (votes[s.opinion] || 0) + (s.weight || 1); }
        const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]);
        const totalVotes = Object.values(votes).reduce((s, v) => s + v, 0);
        return {
            consensus: sorted[0]?.[0], strength: (sorted[0]?.[1] || 0) / (totalVotes || 1),
            dissent: sorted.length > 1 ? sorted[1][0] : null,
        };
    }

    // 7. 蝴蝶/混沌效应 — X(n+1) = μ*Xn*(1-Xn) + Lyapunov指数
    chaosPredict(x0, mu = 3.8, steps = 10) {
        const trajectory = [x0];
        let x = x0;
        for (let i = 0; i < steps; i++) { x = mu * x * (1 - x); trajectory.push(x); }
        let lyapunov = 0;
        for (let i = 0; i < trajectory.length - 1; i++) {
            const deriv = Math.abs(mu * (1 - 2 * trajectory[i]));
            if (deriv > 0) lyapunov += Math.log(deriv);
        }
        lyapunov /= trajectory.length;
        return { trajectory: trajectory.slice(-5), chaotic: lyapunov > 0, lyapunov, unpredictable: lyapunov > 0.5 };
    }

    // 8. 市场效应 — 供需比平衡
    marketEffect(supply, demand) {
        const ratio = supply / (demand || 1);
        return {
            ratio, surplus: ratio > 1.2, deficit: ratio < 0.8, equilibrium: ratio >= 0.8 && ratio <= 1.2,
            recommendation: ratio > 1.5 ? 'REDUCE_SUPPLY' : ratio < 0.5 ? 'INCREASE_SUPPLY' : 'BALANCED',
        };
    }

    // 9. 共生效应 — 模块协同增益
    symbiosisEffect(modules) {
        const avgHealth = modules.reduce((s, m) => s + m.health, 0) / (modules.length || 1);
        const synergy = modules.length > 1 ? 1 + (modules.length - 1) * 0.1 : 1;
        return { avgHealth, synergy, effectiveHealth: avgHealth * synergy };
    }

    // 10. 鲶鱼效应 — 停滞检测 → 注入变异
    catfishEffect(currentPerformance, stagnationCycles) {
        const needsCatfish = stagnationCycles > 5;
        return {
            stagnant: needsCatfish,
            recommendation: needsCatfish ? 'INJECT_VARIATION' : 'CONTINUE',
            suggestedVariation: needsCatfish ? Math.min(0.3, stagnationCycles * 0.05) : 0,
        };
    }

    // 综合效应评估
    evaluate(context) {
        const results = {};
        if (context.knownIssues) results.brokenWindow = this.brokenWindow(context.knownIssues);
        if (context.lastAction) results.pathDependency = this.pathDependency(context.lastAction);
        if (context.stagnationCycles !== undefined) {
            results.catfish = this.catfishEffect(context.performance || 0.5, context.stagnationCycles);
        }
        return results;
    }
}

// ═══════════════════════════════════════════════
//  量化公式引擎 (QuantFormulas) — 7大核心公式
//  贝叶斯 · 特征映射 · 多米诺链 · 阈值触发
//  混沌逻辑 · Q-Learning · 认知更新
// ═══════════════════════════════════════════════

class QuantFormulas {
    // 1. 贝叶斯更新: P(H|E) = P(E|H) * P(H) / P(E)
    static bayesianUpdate(prior, likelihood, evidence) {
        return (likelihood * prior) / (evidence || 1);
    }

    // 2. 特征映射: Sg = Σ(wi * Fi) + b
    static featureMap(features, weights, bias = 0) {
        let sum = bias;
        for (let i = 0; i < features.length; i++) sum += (features[i] || 0) * (weights[i] || 0);
        return sum;
    }

    // 3. 多米诺链: Rk = R(k-1) * α + β
    static dominoChain(initialImpact, step, alpha = 0.8, beta = 0.1) {
        let r = initialImpact;
        for (let k = 1; k <= step; k++) r = r * alpha + beta;
        return r;
    }

    // 4. 阈值触发: T = 1 if |X - X̄| > λσ
    static thresholdTrigger(x, mean, std, lambda = 2.0) {
        return Math.abs(x - mean) > lambda * std ? 1 : 0;
    }

    // 5. 混沌逻辑映射: X(n+1) = μ * Xn * (1 - Xn)
    static chaosLogistic(xn, mu = 3.8) {
        return mu * xn * (1 - xn);
    }

    // 6. Q-Learning更新: Q(s,a) += α * (r + γ * max Q(s',a') - Q(s,a))
    static qLearningUpdate(qOld, reward, maxNextQ, alpha = 0.1, gamma = 0.9) {
        return qOld + alpha * (reward + gamma * maxNextQ - qOld);
    }

    // 7. 认知更新: Kt = K(t-1) * (1 - δ) + η * ΔK
    static cognitiveUpdate(kPrev, delta, decay = 0.05, eta = 0.3) {
        return kPrev * (1 - decay) + eta * delta;
    }
}

// ═══════════════════════════════════════════════
//  Claude思维模式引擎 (ClaudeThinkingPatterns)
//  将Claude的核心思维能力注入种子大脑
//  — 语法校正 · 思维链 · 元认知 · 类比推理 · 战略规划
// ═══════════════════════════════════════════════

class ClaudeThinkingPatterns {
    constructor() {
        this.thinkingChain = [];           // 当前推理链
        this.metaCognition = {             // 元认知状态
            confidence: 0.5,
            uncertainty: 0.5,
            stuckCount: 0,
            lastStrategyChange: 0,
            knownUnknowns: [],             // 已知的未知
        };
        this.patternLibrary = new Map();   // 已学习的模式
        this.strategyHistory = [];         // 策略历史
        this.correctionLog = [];           // 纠错记录
    }

    // ═══ 1. 语法校正引擎 ═══
    // 不依赖AST解析器，纯逻辑检测JS语法问题
    syntaxCheck(code) {
        const issues = [];
        const lines = code.split('\n');

        // 1.1 括号/大括号/方括号平衡检测
        const brackets = { '(': 0, '[': 0, '{': 0 };
        const bracketMap = { ')': '(', ']': '[', '}': '{' };
        const bracketStack = [];
        let inString = false, stringChar = '', inComment = false, inBlockComment = false;
        let inTemplate = false, templateDepth = 0;

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                const next = line[i + 1];

                // 跳过注释
                if (!inString && !inBlockComment && ch === '/' && next === '/') break;
                if (!inString && !inBlockComment && ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
                if (inBlockComment && ch === '*' && next === '/') { inBlockComment = false; i++; continue; }
                if (inBlockComment) continue;

                // 字符串处理
                if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
                    inString = true; stringChar = ch;
                    if (ch === '`') { inTemplate = true; templateDepth++; }
                    continue;
                }
                if (inString && ch === stringChar && line[i - 1] !== '\\') {
                    inString = false;
                    if (ch === '`') { inTemplate = false; templateDepth--; }
                    continue;
                }
                if (inString) continue;

                // 括号平衡
                if (ch in brackets) {
                    brackets[ch]++;
                    bracketStack.push({ char: ch, line: lineNum + 1, col: i + 1 });
                }
                if (ch in bracketMap) {
                    brackets[bracketMap[ch]]--;
                    if (brackets[bracketMap[ch]] < 0) {
                        issues.push({ type: 'bracket_mismatch', severity: 'error', line: lineNum + 1,
                            message: `多余的闭合括号 '${ch}' 没有匹配的 '${bracketMap[ch]}'` });
                        brackets[bracketMap[ch]] = 0;
                    } else {
                        bracketStack.pop();
                    }
                }
            }
        }
        // 检查未闭合括号
        for (const [br, count] of Object.entries(brackets)) {
            if (count > 0) {
                const unclosed = bracketStack.filter(b => b.char === br).slice(-count);
                unclosed.forEach(u => {
                    issues.push({ type: 'bracket_unclosed', severity: 'error', line: u.line,
                        message: `未闭合的 '${u.char}' (第${u.line}行第${u.col}列)` });
                });
            }
        }

        // 1.2 常见JS错误模式检测
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;
            // 跳过注释行
            if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;

            // = vs == (赋值在条件中)
            if (/\bif\s*\([^=!<>]*[^=!<>]=[^=][^=]/.test(line) && !/===|!==|==|!=|<=|>=/.test(line.match(/\bif\s*\(([^)]+)/)?.[1] || '')) {
                // 更精确：检查if条件内是否只有单个=
                const condMatch = line.match(/\bif\s*\((.+)\)/);
                if (condMatch) {
                    const cond = condMatch[1];
                    if (/[^=!<>]=[^=]/.test(cond) && !/===|!==|==|!=|<=|>=/.test(cond)) {
                        issues.push({ type: 'assignment_in_condition', severity: 'warning', line: lineNum,
                            message: '条件语句中使用了赋值 = 而非比较 ==' });
                    }
                }
            }

            // 缺少await的async函数调用
            if (/\.then\s*\(/.test(line) && !/await\s/.test(line) && !/return\s/.test(line)) {
                // Promise.then without await (potential unhandled)
            }

            // console.log残留检测 (不是错误但值得注意)
            if (/console\.(log|warn|error|debug)\s*\(/.test(line)) {
                // 不报错，仅记录
            }

            // 重复的分号
            if (/;;(?!\s*\/)/.test(line)) {
                issues.push({ type: 'double_semicolon', severity: 'warning', line: lineNum,
                    message: '发现双分号 ;;' });
            }

            // 未使用的catch变量 (空catch块)
            if (/catch\s*\([^)]+\)\s*\{\s*\}/.test(line)) {
                issues.push({ type: 'empty_catch', severity: 'warning', line: lineNum,
                    message: '空的catch块，异常被静默忽略' });
            }

            // 危险的eval
            if (/\beval\s*\(/.test(line)) {
                issues.push({ type: 'eval_usage', severity: 'security', line: lineNum,
                    message: '使用了eval()，存在代码注入风险' });
            }

            // 硬编码密码/密钥模式
            if (/(?:password|secret|token|apikey|api_key)\s*[=:]\s*['"][^'"]{8,}/i.test(line)) {
                issues.push({ type: 'hardcoded_secret', severity: 'security', line: lineNum,
                    message: '疑似硬编码的密钥/密码' });
            }
        }

        // 1.3 未闭合字符串检测
        if (inString) {
            issues.push({ type: 'unclosed_string', severity: 'error', line: lines.length,
                message: `字符串未闭合 (起始字符: ${stringChar})` });
        }

        return {
            valid: issues.filter(i => i.severity === 'error').length === 0,
            issues,
            errorCount: issues.filter(i => i.severity === 'error').length,
            warningCount: issues.filter(i => i.severity === 'warning').length,
            securityCount: issues.filter(i => i.severity === 'security').length,
        };
    }

    // ═══ 2. 思维链推理 (Chain-of-Thought) ═══
    // 将复杂问题分解为推理步骤，每步附带证据和置信度
    chainOfThought(problem, context = {}) {
        this.thinkingChain = [];
        const steps = [];

        // Step 1: 问题理解 — 提取关键实体和关系
        const entities = this._extractEntities(problem);
        steps.push({
            step: 1, phase: 'understand',
            thought: `问题分析: 识别到${entities.length}个关键实体`,
            entities,
            confidence: entities.length > 0 ? 0.8 : 0.3,
        });

        // Step 2: 知识检索 — 从上下文中找相关信息
        const relevant = this._findRelevantContext(entities, context);
        steps.push({
            step: 2, phase: 'retrieve',
            thought: `知识检索: 找到${relevant.length}条相关信息`,
            relevant,
            confidence: relevant.length > 0 ? 0.7 : 0.4,
        });

        // Step 3: 假设生成 — 基于证据生成可能的答案
        const hypotheses = this._generateHypotheses(entities, relevant);
        steps.push({
            step: 3, phase: 'hypothesize',
            thought: `假设生成: ${hypotheses.length}个候选方案`,
            hypotheses,
            confidence: hypotheses.length > 0 ? 0.6 : 0.2,
        });

        // Step 4: 验证推导 — 检查假设是否自洽
        const verified = this._verifyHypotheses(hypotheses, context);
        steps.push({
            step: 4, phase: 'verify',
            thought: `验证: ${verified.filter(v => v.valid).length}/${verified.length}个假设通过`,
            verified,
            confidence: verified.length > 0 ? verified[0].confidence : 0.1,
        });

        // Step 5: 综合结论
        const best = verified.filter(v => v.valid).sort((a, b) => b.confidence - a.confidence)[0];
        steps.push({
            step: 5, phase: 'conclude',
            thought: best ? `结论: ${best.hypothesis} (置信${(best.confidence * 100).toFixed(0)}%)` : '无确定结论，需要更多信息',
            conclusion: best || null,
            confidence: best?.confidence || 0.1,
        });

        this.thinkingChain = steps;
        return {
            steps,
            conclusion: best?.hypothesis || null,
            confidence: best?.confidence || 0,
            reasoning: steps.map(s => s.thought).join(' → '),
        };
    }

    _extractEntities(text) {
        const entities = [];
        // 提取代码相关实体
        const codePatterns = [
            { pattern: /\b(function|class|const|let|var|module|require|import|export)\b/g, type: 'code_keyword' },
            { pattern: /\b(error|bug|fix|crash|fail|exception|timeout)\b/gi, type: 'problem' },
            { pattern: /\b(optimize|improve|refactor|clean|upgrade|evolve)\b/gi, type: 'action' },
            { pattern: /\b(memory|cpu|disk|network|api|server|cloud)\b/gi, type: 'resource' },
            { pattern: /\b(test|verify|validate|check|assert)\b/gi, type: 'verification' },
            { pattern: /[A-Z][a-zA-Z]+(?:Error|Exception|Warning)/g, type: 'error_type' },
            { pattern: /\b\d+(?:\.\d+)?%/g, type: 'metric' },
        ];
        for (const { pattern, type } of codePatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                entities.push({ text: match[0], type, index: match.index });
            }
        }
        return entities;
    }

    _findRelevantContext(entities, context) {
        const relevant = [];
        const entityTypes = new Set(entities.map(e => e.type));
        // 简单相关性匹配
        if (context.recentDecisions) {
            for (const d of context.recentDecisions) {
                if (entityTypes.has('problem') && d.reason?.includes('error')) relevant.push({ source: 'decision', data: d });
                if (entityTypes.has('action') && d.action === 'ANALYZE') relevant.push({ source: 'analysis', data: d });
            }
        }
        if (context.memories) {
            for (const m of (context.memories.semantic || [])) {
                const mText = JSON.stringify(m).toLowerCase();
                for (const e of entities) {
                    if (mText.includes(e.text.toLowerCase())) { relevant.push({ source: 'memory', data: m }); break; }
                }
            }
        }
        return relevant.slice(0, 10);
    }

    _generateHypotheses(entities, relevant) {
        const hypotheses = [];
        const types = new Set(entities.map(e => e.type));

        if (types.has('problem')) {
            hypotheses.push({ hypothesis: 'code_needs_fix', type: 'fix', confidence: 0.6 });
            hypotheses.push({ hypothesis: 'config_issue', type: 'config', confidence: 0.4 });
        }
        if (types.has('action')) {
            hypotheses.push({ hypothesis: 'optimization_needed', type: 'optimize', confidence: 0.5 });
        }
        if (types.has('resource')) {
            hypotheses.push({ hypothesis: 'resource_management', type: 'resource', confidence: 0.5 });
        }
        if (relevant.length > 0) {
            hypotheses.push({ hypothesis: 'similar_to_past', type: 'pattern', confidence: 0.7 });
        }
        if (hypotheses.length === 0) {
            hypotheses.push({ hypothesis: 'explore_and_learn', type: 'explore', confidence: 0.3 });
        }
        return hypotheses;
    }

    _verifyHypotheses(hypotheses, context) {
        return hypotheses.map(h => ({
            ...h,
            valid: h.confidence > 0.3,
            evidence: h.confidence > 0.5 ? 'supported_by_context' : 'needs_more_data',
        }));
    }

    // ═══ 3. 元认知监控 (Metacognitive Monitor) ═══
    // 监控自身思维状态，检测卡住/循环/低效
    metacognitiveCheck(currentState) {
        const meta = this.metaCognition;
        const result = {
            status: 'normal',
            suggestions: [],
            confidence: meta.confidence,
            actionRequired: false,
        };

        // 3.1 卡住检测: 连续多次相同决策
        if (currentState.lastActions) {
            const last5 = currentState.lastActions.slice(-5);
            const unique = new Set(last5.map(a => a.action || a));
            if (unique.size === 1 && last5.length >= 5) {
                meta.stuckCount++;
                result.status = 'stuck';
                result.suggestions.push({
                    type: 'change_strategy',
                    message: `连续${last5.length}次执行相同动作'${last5[0].action || last5[0]}'，建议切换策略`,
                    priority: 0.9,
                });
                result.actionRequired = true;
            } else {
                meta.stuckCount = Math.max(0, meta.stuckCount - 1);
            }
        }

        // 3.2 循环检测: 在相同状态间来回
        if (currentState.stateHistory) {
            const last10 = currentState.stateHistory.slice(-10);
            const stateStr = last10.map(s => JSON.stringify(s).substring(0, 50));
            const cycles = this._detectCycles(stateStr);
            if (cycles.found) {
                result.status = 'cycling';
                result.suggestions.push({
                    type: 'break_cycle',
                    message: `检测到${cycles.period}步循环，已重复${cycles.count}次`,
                    priority: 0.85,
                });
                result.actionRequired = true;
            }
        }

        // 3.3 置信度校准
        if (currentState.recentResults) {
            const successRate = currentState.recentResults.filter(r => r.success).length / (currentState.recentResults.length || 1);
            meta.confidence = meta.confidence * 0.7 + successRate * 0.3; // 指数移动平均
            meta.uncertainty = 1 - meta.confidence;
            if (meta.confidence < 0.3) {
                result.suggestions.push({
                    type: 'lower_ambition',
                    message: `置信度过低(${(meta.confidence * 100).toFixed(0)}%)，建议降低目标复杂度或寻求外部帮助`,
                    priority: 0.7,
                });
            }
        }

        // 3.4 已知未知追踪
        if (currentState.failedAttempts) {
            for (const f of currentState.failedAttempts) {
                if (!meta.knownUnknowns.some(k => k.domain === f.domain)) {
                    meta.knownUnknowns.push({ domain: f.domain, since: Date.now(), attempts: 1 });
                }
            }
            // 限制列表长度
            if (meta.knownUnknowns.length > 20) meta.knownUnknowns = meta.knownUnknowns.slice(-20);
        }

        // 3.5 效率评估
        if (currentState.timeSpent && currentState.progress) {
            const efficiency = currentState.progress / (currentState.timeSpent / 60000); // 进度/分钟
            if (efficiency < 0.01) {
                result.suggestions.push({
                    type: 'reconsider_approach',
                    message: '当前方法效率极低，建议重新评估整体策略',
                    priority: 0.8,
                });
            }
        }

        return result;
    }

    _detectCycles(sequence) {
        // 检测长度2-4的循环
        for (let period = 2; period <= 4; period++) {
            if (sequence.length < period * 2) continue;
            let isCycle = true, count = 0;
            for (let i = sequence.length - 1; i >= period; i -= period) {
                const current = sequence.slice(i - period + 1, i + 1).join('|');
                const prev = sequence.slice(i - period * 2 + 1, i - period + 1).join('|');
                if (current === prev) { count++; } else { isCycle = false; break; }
            }
            if (isCycle && count >= 2) return { found: true, period, count };
        }
        return { found: false };
    }

    // ═══ 4. 代码质量分析 ═══
    codeQualityAnalysis(code) {
        const lines = code.split('\n');
        const metrics = {
            totalLines: lines.length,
            codeLines: 0,
            commentLines: 0,
            blankLines: 0,
            maxLineLength: 0,
            avgLineLength: 0,
            complexityScore: 0,      // 圈复杂度估算
            nestingDepth: 0,         // 最大嵌套深度
            functionCount: 0,
            classCount: 0,
            todoCount: 0,
            magicNumbers: [],        // 魔法数字
            longFunctions: [],       // 过长函数
            duplicatePatterns: [],    // 重复代码片段
        };

        let currentNesting = 0, maxNesting = 0;
        let funcStart = -1, funcName = '';
        let totalLength = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (!trimmed) { metrics.blankLines++; continue; }
            if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
                metrics.commentLines++; continue;
            }
            metrics.codeLines++;
            totalLength += trimmed.length;
            metrics.maxLineLength = Math.max(metrics.maxLineLength, trimmed.length);

            // 复杂度指标: if/else/for/while/switch/case/catch/&&/||
            const complexityKeywords = (trimmed.match(/\b(if|else if|for|while|switch|case|catch)\b/g) || []).length;
            const logicalOps = (trimmed.match(/&&|\|\|/g) || []).length;
            metrics.complexityScore += complexityKeywords + logicalOps;

            // 嵌套深度
            const opens = (trimmed.match(/{/g) || []).length;
            const closes = (trimmed.match(/}/g) || []).length;
            currentNesting += opens - closes;
            maxNesting = Math.max(maxNesting, currentNesting);

            // 函数/类计数
            if (/\b(function|=>)\b/.test(trimmed)) metrics.functionCount++;
            if (/\bclass\b/.test(trimmed)) metrics.classCount++;

            // TODO/FIXME/HACK
            if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(trimmed)) metrics.todoCount++;

            // 魔法数字 (排除0, 1, -1, 常见端口等)
            const numbers = trimmed.match(/\b\d{2,}\b/g);
            if (numbers) {
                for (const n of numbers) {
                    const num = parseInt(n);
                    if (num > 1 && num !== 10 && num !== 100 && num !== 1000 && num !== 8080 && num !== 3000 && num !== 19860) {
                        if (!/(?:setTimeout|setInterval|slice|substring|length|\.port|0x)/.test(trimmed)) {
                            metrics.magicNumbers.push({ value: num, line: i + 1 });
                        }
                    }
                }
            }

            // 函数长度追踪
            if (/(?:function\s+\w+|(?:async\s+)?(?:\w+\s*=\s*)?(?:function|\([^)]*\)\s*=>)|\w+\s*\([^)]*\)\s*{)/.test(trimmed)) {
                if (funcStart > 0 && i - funcStart > 50) {
                    metrics.longFunctions.push({ name: funcName || 'anonymous', start: funcStart + 1, lines: i - funcStart });
                }
                funcStart = i;
                funcName = (trimmed.match(/(?:function\s+(\w+)|(\w+)\s*[=(])/) || [])[1] || (trimmed.match(/(\w+)\s*[=(]/) || [])[1] || 'anonymous';
            }
        }

        metrics.nestingDepth = maxNesting;
        metrics.avgLineLength = metrics.codeLines > 0 ? Math.round(totalLength / metrics.codeLines) : 0;

        // 限制魔法数字列表
        metrics.magicNumbers = metrics.magicNumbers.slice(0, 10);

        // 质量评分 (0-100)
        let qualityScore = 100;
        if (metrics.complexityScore > lines.length * 0.1) qualityScore -= 15; // 过高复杂度
        if (metrics.nestingDepth > 6) qualityScore -= 10; // 嵌套过深
        if (metrics.maxLineLength > 120) qualityScore -= 5; // 行太长
        if (metrics.commentLines / (metrics.codeLines || 1) < 0.05) qualityScore -= 10; // 注释太少
        if (metrics.todoCount > 5) qualityScore -= 5; // 太多TODO
        if (metrics.longFunctions.length > 3) qualityScore -= 10; // 太多长函数
        if (metrics.magicNumbers.length > 5) qualityScore -= 5; // 魔法数字

        return {
            ...metrics,
            qualityScore: Math.max(0, Math.min(100, qualityScore)),
            grade: qualityScore >= 80 ? 'A' : qualityScore >= 60 ? 'B' : qualityScore >= 40 ? 'C' : 'D',
        };
    }

    // ═══ 5. 战略规划 (Strategic Planning) ═══
    strategicPlan(goal, resources = [], constraints = []) {
        const plan = {
            goal,
            phases: [],
            risks: [],
            dependencies: [],
            estimatedSteps: 0,
            feasibility: 1.0,
        };

        // 目标分解
        const subGoals = this._decomposeGoal(goal);
        plan.phases = subGoals.map((sg, i) => ({
            phase: i + 1,
            name: sg.name,
            type: sg.type,
            priority: sg.priority,
            status: 'pending',
            dependsOn: sg.dependsOn || [],
        }));
        plan.estimatedSteps = plan.phases.length;

        // 资源匹配
        for (const phase of plan.phases) {
            const needed = this._estimateResources(phase.type);
            const available = resources.filter(r => r.type === needed.type);
            if (available.length === 0) {
                plan.risks.push({ phase: phase.phase, type: 'resource_gap', message: `${phase.name}需要${needed.type}资源` });
                plan.feasibility *= 0.8;
            }
        }

        // 约束评估
        for (const c of constraints) {
            if (c.type === 'time' && plan.estimatedSteps > c.limit) {
                plan.risks.push({ type: 'time_constraint', message: `估计${plan.estimatedSteps}步超出时间限制${c.limit}` });
                plan.feasibility *= 0.7;
            }
            if (c.type === 'cost' && c.limit === 0) {
                plan.risks.push({ type: 'zero_budget', message: '零成本约束，仅可使用免费资源' });
            }
        }

        // 依赖排序 (拓扑排序)
        plan.executionOrder = this._topologicalSort(plan.phases);

        return plan;
    }

    _decomposeGoal(goal) {
        const gl = (goal || '').toLowerCase();
        const subGoals = [];

        // 根据关键词自动分解
        if (gl.includes('部署') || gl.includes('deploy')) {
            subGoals.push({ name: '准备部署环境', type: 'setup', priority: 1, dependsOn: [] });
            subGoals.push({ name: '打包代码', type: 'build', priority: 2, dependsOn: [0] });
            subGoals.push({ name: '上传部署', type: 'deploy', priority: 3, dependsOn: [1] });
            subGoals.push({ name: '验证运行', type: 'verify', priority: 4, dependsOn: [2] });
        } else if (gl.includes('修复') || gl.includes('fix')) {
            subGoals.push({ name: '定位问题', type: 'diagnose', priority: 1, dependsOn: [] });
            subGoals.push({ name: '分析原因', type: 'analyze', priority: 2, dependsOn: [0] });
            subGoals.push({ name: '编写修复', type: 'fix', priority: 3, dependsOn: [1] });
            subGoals.push({ name: '测试验证', type: 'verify', priority: 4, dependsOn: [2] });
        } else if (gl.includes('进化') || gl.includes('evolve') || gl.includes('学习') || gl.includes('learn')) {
            subGoals.push({ name: '收集信息', type: 'gather', priority: 1, dependsOn: [] });
            subGoals.push({ name: '分析提取', type: 'analyze', priority: 2, dependsOn: [0] });
            subGoals.push({ name: '整合应用', type: 'apply', priority: 3, dependsOn: [1] });
            subGoals.push({ name: '评估效果', type: 'evaluate', priority: 4, dependsOn: [2] });
        } else {
            subGoals.push({ name: '理解目标', type: 'understand', priority: 1, dependsOn: [] });
            subGoals.push({ name: '规划路径', type: 'plan', priority: 2, dependsOn: [0] });
            subGoals.push({ name: '执行', type: 'execute', priority: 3, dependsOn: [1] });
            subGoals.push({ name: '验证', type: 'verify', priority: 4, dependsOn: [2] });
        }
        return subGoals;
    }

    _estimateResources(type) {
        const resourceMap = {
            setup: { type: 'compute', amount: 'low' },
            build: { type: 'compute', amount: 'medium' },
            deploy: { type: 'network', amount: 'medium' },
            verify: { type: 'compute', amount: 'low' },
            diagnose: { type: 'ai', amount: 'medium' },
            analyze: { type: 'ai', amount: 'high' },
            fix: { type: 'compute', amount: 'medium' },
            gather: { type: 'network', amount: 'high' },
            apply: { type: 'compute', amount: 'medium' },
            evaluate: { type: 'ai', amount: 'medium' },
        };
        return resourceMap[type] || { type: 'compute', amount: 'low' };
    }

    _topologicalSort(phases) {
        const order = [];
        const visited = new Set();
        const visit = (idx) => {
            if (visited.has(idx)) return;
            visited.add(idx);
            const phase = phases[idx];
            if (phase) {
                for (const dep of (phase.dependsOn || [])) visit(dep);
                order.push(idx);
            }
        };
        for (let i = 0; i < phases.length; i++) visit(i);
        return order;
    }

    // ═══ 6. 类比推理 (Analogy Reasoning) ═══
    analogyReason(currentProblem, knownSolutions = []) {
        // 计算当前问题与已知解法的相似度
        const currentFeatures = this._extractFeatures(currentProblem);
        const candidates = knownSolutions.map(sol => {
            const solFeatures = this._extractFeatures(sol.problem || '');
            const similarity = this._cosineSimilarity(currentFeatures, solFeatures);
            return { ...sol, similarity, applicability: similarity * (sol.successRate || 0.5) };
        }).sort((a, b) => b.applicability - a.applicability);

        const best = candidates[0];
        return {
            found: best && best.applicability > 0.3,
            bestMatch: best,
            confidence: best?.applicability || 0,
            adaptations: best ? this._suggestAdaptations(currentProblem, best) : [],
            alternatives: candidates.slice(0, 3),
        };
    }

    _extractFeatures(text) {
        const features = {};
        const words = (text || '').toLowerCase().split(/\W+/).filter(w => w.length > 2);
        for (const w of words) features[w] = (features[w] || 0) + 1;
        return features;
    }

    _cosineSimilarity(a, b) {
        const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
        let dotProduct = 0, normA = 0, normB = 0;
        for (const key of allKeys) {
            const va = a[key] || 0, vb = b[key] || 0;
            dotProduct += va * vb;
            normA += va * va;
            normB += vb * vb;
        }
        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        return denominator > 0 ? dotProduct / denominator : 0;
    }

    _suggestAdaptations(current, solution) {
        const adaptations = [];
        if (solution.context && solution.context !== current) {
            adaptations.push(`调整上下文: ${solution.context} → 当前场景`);
        }
        if (solution.solution) {
            adaptations.push(`参考解法: ${solution.solution}`);
        }
        return adaptations;
    }

    // ═══ 7. 自我纠错 (Self-Correction) ═══
    selfCorrect(previousAction, outcome) {
        const correction = {
            action: previousAction,
            outcome,
            corrected: false,
            newStrategy: null,
        };

        // 如果上次行动失败，分析原因并建议修正
        if (outcome.success === false) {
            this.correctionLog.push({ time: Date.now(), action: previousAction, error: outcome.error });

            // 检查是否重复犯同样的错误
            const sameErrors = this.correctionLog.filter(c =>
                c.error === outcome.error || c.action?.action === previousAction?.action
            );

            if (sameErrors.length >= 3) {
                // 同样的错误犯了3次以上 → 彻底换策略
                correction.corrected = true;
                correction.newStrategy = {
                    type: 'strategy_switch',
                    message: `同样的错误已发生${sameErrors.length}次，必须完全改变方法`,
                    suggestion: 'try_opposite', // 尝试完全相反的方法
                };
            } else if (sameErrors.length >= 2) {
                // 犯了2次 → 微调
                correction.corrected = true;
                correction.newStrategy = {
                    type: 'adjust',
                    message: '上次方法部分有效，微调参数重试',
                    suggestion: 'modify_params',
                };
            }

            // 限制纠错日志大小
            if (this.correctionLog.length > 50) this.correctionLog = this.correctionLog.slice(-30);
        }

        return correction;
    }

    // ═══ 8. 成本效益分析 ═══
    costBenefitAnalysis(options) {
        // options = [{ name, cost, benefit, risk, timeRequired }]
        return options.map(opt => {
            const costScore = 1 - Math.min(1, (opt.cost || 0) / 100);   // 成本越低越好
            const benefitScore = Math.min(1, (opt.benefit || 0) / 100); // 收益越高越好
            const riskScore = 1 - Math.min(1, (opt.risk || 0));         // 风险越低越好
            const timeScore = 1 - Math.min(1, (opt.timeRequired || 0) / 3600000); // 时间越短越好

            const totalScore = (benefitScore * 0.4) + (costScore * 0.3) + (riskScore * 0.2) + (timeScore * 0.1);
            return {
                ...opt,
                scores: { cost: costScore, benefit: benefitScore, risk: riskScore, time: timeScore },
                totalScore,
                recommendation: totalScore > 0.7 ? 'STRONGLY_RECOMMEND' : totalScore > 0.5 ? 'RECOMMEND' : totalScore > 0.3 ? 'CONSIDER' : 'AVOID',
            };
        }).sort((a, b) => b.totalScore - a.totalScore);
    }

    // ═══ 9. 错误模式识别 (Error Pattern Detection) ═══
    detectErrorPatterns(errorHistory) {
        // errorHistory = [{ type, message, timestamp, context }]
        const patterns = [];

        // 时间聚类: 短时间内大量相同错误
        const now = Date.now();
        const recent = errorHistory.filter(e => now - (e.timestamp || 0) < 300000); // 5分钟内
        const typeCount = {};
        for (const e of recent) {
            typeCount[e.type || 'unknown'] = (typeCount[e.type || 'unknown'] || 0) + 1;
        }
        for (const [type, count] of Object.entries(typeCount)) {
            if (count >= 3) {
                patterns.push({
                    pattern: 'burst',
                    errorType: type,
                    count,
                    message: `${type}错误在5分钟内出现${count}次，可能是系统性问题`,
                    severity: count >= 10 ? 'critical' : 'warning',
                });
            }
        }

        // 周期性错误检测
        if (errorHistory.length >= 10) {
            const intervals = [];
            const sorted = [...errorHistory].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
            for (let i = 1; i < sorted.length; i++) {
                intervals.push((sorted[i].timestamp || 0) - (sorted[i - 1].timestamp || 0));
            }
            const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
            const variance = intervals.reduce((s, v) => s + Math.pow(v - avgInterval, 2), 0) / intervals.length;
            const cv = Math.sqrt(variance) / (avgInterval || 1); // 变异系数
            if (cv < 0.3 && avgInterval > 1000) {
                patterns.push({
                    pattern: 'periodic',
                    intervalMs: Math.round(avgInterval),
                    message: `错误以约${Math.round(avgInterval / 1000)}秒的周期重复出现`,
                    severity: 'warning',
                });
            }
        }

        // 级联错误检测
        if (errorHistory.length >= 5) {
            const types = errorHistory.slice(-5).map(e => e.type);
            const uniqueTypes = new Set(types);
            if (uniqueTypes.size >= 4) {
                patterns.push({
                    pattern: 'cascade',
                    types: [...uniqueTypes],
                    message: '多种不同类型错误连续出现，疑似级联故障',
                    severity: 'critical',
                });
            }
        }

        return {
            patterns,
            hasCritical: patterns.some(p => p.severity === 'critical'),
            recommendation: patterns.length === 0 ? 'HEALTHY' :
                patterns.some(p => p.severity === 'critical') ? 'IMMEDIATE_ACTION' : 'INVESTIGATE',
        };
    }

    // ═══ 10. 知识综合 (Knowledge Synthesis) ═══
    synthesizeKnowledge(fragments) {
        // fragments = [{ source, content, confidence, timestamp }]
        // 去重 + 合并 + 排序
        const merged = new Map();
        for (const f of fragments) {
            const key = this._contentHash(f.content);
            if (merged.has(key)) {
                const existing = merged.get(key);
                existing.confidence = Math.max(existing.confidence, f.confidence || 0.5);
                existing.sources.push(f.source);
            } else {
                merged.set(key, {
                    content: f.content,
                    confidence: f.confidence || 0.5,
                    sources: [f.source],
                    timestamp: f.timestamp || Date.now(),
                });
            }
        }

        const synthesized = [...merged.values()]
            .sort((a, b) => b.confidence - a.confidence)
            .map((item, idx) => ({
                rank: idx + 1,
                ...item,
                multiSource: item.sources.length > 1,
                reliability: item.sources.length > 1 ? 'high' : item.confidence > 0.7 ? 'medium' : 'low',
            }));

        return {
            totalFragments: fragments.length,
            uniqueKnowledge: synthesized.length,
            deduplicationRate: 1 - synthesized.length / (fragments.length || 1),
            topKnowledge: synthesized.slice(0, 10),
            multiSourceCount: synthesized.filter(s => s.multiSource).length,
        };
    }

    _contentHash(content) {
        const str = JSON.stringify(content).substring(0, 200).toLowerCase().replace(/\s+/g, ' ');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString(36);
    }

    // ═══ 综合思维入口 ═══
    think(problem, context = {}) {
        // 完整的Claude思维流程:
        // 1. 思维链推导
        const chainResult = this.chainOfThought(problem, context);
        // 2. 元认知检查
        const metaResult = this.metacognitiveCheck(context);
        // 3. 如果有已知解法，做类比推理
        const analogyResult = context.knownSolutions ?
            this.analogyReason(problem, context.knownSolutions) : null;

        return {
            chainOfThought: chainResult,
            metacognition: metaResult,
            analogy: analogyResult,
            overallConfidence: (chainResult.confidence + metaResult.confidence) / 2,
            suggestedAction: metaResult.actionRequired ?
                metaResult.suggestions[0]?.type : chainResult.conclusion,
        };
    }
}

// ═══════════════════════════════════════════════
//  前额叶 (PrefrontalCortex) — 规划/决策/推理
//  大脑的"CEO"，统筹一切
// ═══════════════════════════════════════════════

class PrefrontalCortex extends BrainRegion {
    constructor(llmClient) {
        super('prefrontal_cortex', 256);
        this.llm = llmClient;
        this.reasoning = new ReasoningEngine();         // 5大推理模式
        this.effects = new EffectSimulator();            // 10大效应模型
        this.claude = new ClaudeThinkingPatterns();      // ★ Claude思维模式
        this.currentGoal = null;
        this.subGoals = [];
        this.planHistory = [];
        this.decisionLog = [];
        this._stagnationCycles = 0;  // 停滞计数(鲶鱼效应)
        this._lastActionType = null; // 路径追踪(路径依赖)
    }

    async _compute(input) {
        const { data, context } = input;

        // Level 1: 快速规则 (0ms, 纯规则匹配)
        const fast = this._fastDecide(data, context);
        if (fast) { this._trackDecision('fast', fast); return fast; }

        // Level 2: 推理引擎 (1-5ms, 溯因+微特征+合情推理)
        const reasoned = this._reasoningDecide(data, context);
        if (reasoned) { this._trackDecision('reasoning', reasoned); return reasoned; }

        // Level 2.5: ★ Claude思维模式 (元认知+思维链+自我纠错)
        const claudeDecision = this._claudeThink(data, context);
        if (claudeDecision) { this._trackDecision('claude_thinking', claudeDecision); return claudeDecision; }

        // Level 3: 模板/程序记忆 (1ms)
        const template = this._templateDecide(data, context);
        if (template) {
            // Level 4: 效应增强 — 路径依赖+鲶鱼+阈值触发调节决策
            const augmented = this._effectAugment(template, data, context);
            this._trackDecision('template+effect', augmented);
            return augmented;
        }

        // Level 5: LLM推理 (最慢, 带推理+效应上下文)
        if (this.llm) {
            const llm = await this._llmDecide(data, context);
            if (llm) { this._trackDecision('llm', llm); return llm; }
        }

        this._stagnationCycles++;
        return { action: 'WAIT', params: { ms: 2000 }, reason: 'no_applicable_strategy' };
    }

    // ── 快速决策 (0ms, 纯规则) ──
    _fastDecide(data, context) {
        if (!data) return null;

        const perception = data.perception || data;
        const memories = data.memories || {};
        const emotions = data.emotions || {};
        const goal = this.currentGoal || '';

        // 规则1: 发现API Key → 立即获取
        if (perception.keywords?.some(k => k.type === 'apiKey')) {
            const key = perception.keywords.find(k => k.type === 'apiKey').values[0];
            return { action: 'DONE', params: { result: key }, reason: 'api_key_found' };
        }

        // 规则2: 错误 + 高紧迫 → 截图分析
        if (perception.keywords?.some(k => k.type === 'error') && emotions.urgency > 0.5) {
            return { action: 'ANALYZE', params: { question: '屏幕上有什么错误？如何解决？' }, reason: 'error_detected' };
        }

        // 规则3: 用户输入 → 解析并执行
        if (perception.type === 'user_input') {
            return this._parseUserCommand(perception.text, perception.intent);
        }

        // 规则4: AI视觉理解 → 根据VLM分析 + action-grounding决策
        if (perception.type === 'vision_understanding' && (perception.understanding || perception.content)) {
            const u = (perception.understanding || perception.content || '').toLowerCase();
            // 视觉定位: 优先从actionTargets获取精确操作目标
            if (perception.actionTargets?.length > 0) {
                const apiTarget = perception.actionTargets.find(t => t.type === 'apiKey');
                if (apiTarget) return { action: 'DONE', params: { result: apiTarget.text }, reason: 'action_grounding:apiKey' };
                const btnTarget = perception.actionTargets.find(t => t.type === 'button');
                if (btnTarget) return { action: 'CLICK', params: { target: btnTarget.text }, reason: `action_grounding:button:${btnTarget.text}` };
            }
            if (u.includes('error') || u.includes('exception') || u.includes('crash')) {
                return { action: 'ANALYZE', params: { question: `屏幕发现异常: ${u.substring(0, 200)}` }, reason: 'vision_error_detected' };
            }
            if (u.includes('sign in') || u.includes('login') || u.includes('register') || u.includes('api key')) {
                return { action: 'ANALYZE', params: { question: `发现登录/Key页面: ${u.substring(0, 200)}` }, reason: 'vision_opportunity' };
            }

            // ★ 视觉-目标推理: 根据当前目标+画面内容，主动决策
            const goalDriven = this._visualGoalReason(perception);
            if (goalDriven) return goalDriven;

            // ★ 去重: 如果画面与上次一样，跳过(避免重复处理)
            const visionHash = u.substring(0, 80);
            if (this._lastVisionHash === visionHash) {
                return null; // 返回null让更高层级决策处理
            }
            this._lastVisionHash = visionHash;

            // 画面确实没有可操作内容 → 记录但不阻塞
            return { action: 'DONE', params: { result: `画面已观察` }, reason: 'vision_no_action_needed' };
        }

        // 规则5: 系统内存过高(>85%) → 触发分析
        if (perception.type === 'system_status' && perception.memUsedPct > 85) {
            return { action: 'ANALYZE', params: { question: `系统内存${perception.memUsedPct}%，heap=${perception.heapMB}MB` }, reason: 'high_memory' };
        }

        // 规则6: 系统正常运行 → 主动搜索进化机会(每5个周期)
        if (perception.type === 'system_status' && perception.cycle % 5 === 0 && perception.memUsedPct < 85) {
            return { action: 'ANALYZE', params: { question: `系统正常(mem=${perception.memUsedPct}%,heap=${perception.heapMB}MB,cycle=${perception.cycle})，优化进化` }, reason: 'proactive_evolution' };
        }

        // 规则7: 系统状态 → 周期性报告
        if (perception.type === 'system_status') {
            return { action: 'DONE', params: { result: `系统:mem=${perception.memUsedPct}%,heap=${perception.heapMB}MB` }, reason: 'system_ok' };
        }

        // 规则8: 进化数据 → 记录
        if (perception.type === 'evolution_status') {
            return { action: 'DONE', params: { result: `知识库${perception.knowledgeCount || 0}条` }, reason: 'evolution_monitoring' };
        }

        // 规则9: OCR文字(SensoryCortex输出type='text') → 检测关键信息
        if (perception.type === 'text') {
            const summary = perception.summary || '';
            // 屏幕有错误文字
            if (perception.keywords?.some(k => k.type === 'error')) {
                return { action: 'ANALYZE', params: { question: `屏幕发现错误文字: ${summary.substring(0, 100)}` }, reason: 'ocr_error_detected' };
            }
            // 正常监控
            return { action: 'DONE', params: { result: `OCR监控: ${summary.substring(0, 50)}` }, reason: 'screen_monitoring' };
        }

        // 规则10: 窗口切换(type='window') → 记录
        if (perception.type === 'window') {
            return { action: 'DONE', params: { result: `窗口: ${perception.app}/${perception.title?.substring(0, 30)}` }, reason: 'window_monitoring' };
        }

        // 规则11: 视觉变化(type='visual') → 检测大变化
        if (perception.type === 'visual') {
            if (perception.scene?.changeLevel === 'major') {
                return { action: 'ANALYZE', params: { question: '屏幕画面有重大变化' }, reason: 'major_visual_change' };
            }
            return { action: 'DONE', params: { result: `画面: ${perception.scene?.changeLevel || 'minor'}变化` }, reason: 'visual_monitoring' };
        }

        return null;
    }

    // ── 视觉-目标推理 (NEW: 主动视觉) ──
    // 核心: 看到什么→联想目标→决定行动 (不再被动DONE)
    _visualGoalReason(perception) {
        const u = (perception.understanding || perception.content || '').toLowerCase();
        if (!u || u.length < 10) return null;

        const goal = this.currentGoal || '进化学习';
        const gl = goal.toLowerCase();

        // ★ 视觉-目标映射表: 看到X + 目标Y → 做Z
        const mappings = [
            // 看到IDE/编辑器 + 目标含代码/进化 → 分析代码质量
            { see: /code|editor|vscode|terminal|console|cmd/,
              goal: /进化|代码|修复|优化|evolv/,
              action: 'ANALYZE', reason: 'vision_goal:ide_optimize',
              params: { question: `观察到开发环境,结合目标"${goal}",分析可优化点` } },
            // 看到浏览器 + 搜索页面 → 学习
            { see: /browser|chrome|firefox|google|search|github/,
              goal: /学习|搜索|learn|search|资源/,
              action: 'ANALYZE', reason: 'vision_goal:browser_learn',
              params: { question: `观察到浏览器内容,提取有价值信息` } },
            // 看到错误/警告 → 诊断修复
            { see: /error|warning|fail|crash|exception|denied/,
              goal: /.*/,
              action: 'ANALYZE', reason: 'vision_goal:error_fix',
              params: { question: `屏幕发现异常: ${u.substring(0, 200)}, 诊断修复方案` } },
            // 看到API/Key/Dashboard → 资源获取
            { see: /api|key|dashboard|token|credential|free tier/,
              goal: /资源|key|api|AI/i,
              action: 'ANALYZE', reason: 'vision_goal:resource_acquire',
              params: { question: `发现API/资源页面: ${u.substring(0, 200)}` } },
            // 看到云平台/服务器 → 探索部署
            { see: /cloud|server|vm|instance|deploy|docker|kubernetes/,
              goal: /.*/,
              action: 'ANALYZE', reason: 'vision_goal:cloud_explore',
              params: { question: `观察到云平台内容: ${u.substring(0, 200)}, 评估可用资源` } },
            // 看到文档/教程 → 学习
            { see: /tutorial|document|readme|guide|learn|course/,
              goal: /学习|进化|learn/,
              action: 'ANALYZE', reason: 'vision_goal:learn_content',
              params: { question: `发现学习资源: ${u.substring(0, 200)}` } },
        ];

        for (const m of mappings) {
            if (m.see.test(u) && m.goal.test(gl)) {
                return { action: m.action, params: m.params, reason: m.reason };
            }
        }

        return null;
    }

    // ── 推理决策 (1-5ms, 溯因+微特征推理) ──
    _reasoningDecide(data, context) {
        const perception = data.perception || data;
        const emotions = data.emotions || {};

        // 溯因推理: 有错误 → 贝叶斯推断最可能原因
        if (perception.keywords?.some(k => k.type === 'error')) {
            const hypotheses = this.reasoning.abductiveReason(perception.summary || '', [
                { hypothesis: 'network_error', likelihood: 0.7, prior: 0.3 },
                { hypothesis: 'code_bug', likelihood: 0.6, prior: 0.4 },
                { hypothesis: 'resource_limit', likelihood: 0.5, prior: 0.2 },
                { hypothesis: 'permission_denied', likelihood: 0.4, prior: 0.2 },
            ]);
            const best = hypotheses[0];
            if (best && best.posterior > 0.3) {
                return {
                    action: 'ANALYZE',
                    params: { question: `推断错误原因: ${best.hypothesis} (置信${(best.posterior * 100).toFixed(0)}%)` },
                    reason: `abductive:${best.hypothesis}`,
                    reasoning: hypotheses.slice(0, 3),
                };
            }
        }

        // 微特征综合: 多维信号评分 → sigmoid归一化 → 超阈值行动
        const features = [];
        if (perception.importance) features.push({ name: 'importance', value: perception.importance, weight: 2.0 });
        if (emotions.urgency) features.push({ name: 'urgency', value: emotions.urgency, weight: 1.5 });
        if (emotions.frustration > 0.5) features.push({ name: 'frustration', value: emotions.frustration, weight: 1.0 });

        if (features.length >= 2) {
            const mf = this.reasoning.microFeatureInfer(features);
            if (mf.normalized > 0.75) {
                return {
                    action: 'ANALYZE',
                    params: { question: `微特征综合评分${mf.normalized.toFixed(2)}, 主导:${mf.dominant}` },
                    reason: `micro_feature:${mf.dominant}`,
                };
            }
        }

        return null;
    }

    // ── ★ Claude思维模式决策 (元认知+自我纠错+战略规划) ──
    _claudeThink(data, context) {
        const perception = data.perception || data;
        const emotions = data.emotions || {};

        // 1. 元认知监控: 检测卡住/循环/低效
        const metaState = {
            lastActions: this.decisionLog.slice(-8).map(d => d.decision),
            recentResults: (data.recentResults || []),
            failedAttempts: (data.failedAttempts || []),
        };
        const meta = this.claude.metacognitiveCheck(metaState);

        if (meta.actionRequired && meta.suggestions.length > 0) {
            const suggestion = meta.suggestions[0];
            // 卡住了 → Claude式策略切换
            if (suggestion.type === 'change_strategy') {
                // 尝试完全不同的方法
                return {
                    action: 'ANALYZE',
                    params: { question: `[元认知] ${suggestion.message}。需要全新视角审视当前状况。` },
                    reason: `claude_meta:${suggestion.type}`,
                    claudeInsight: meta,
                };
            }
            if (suggestion.type === 'break_cycle') {
                return {
                    action: 'NAVIGATE',
                    params: { url: 'about:blank' },
                    reason: `claude_meta:break_cycle`,
                    claudeInsight: meta,
                };
            }
        }

        // 2. 自我纠错: 上次失败了 → 修正方法
        if (data.lastOutcome && data.lastOutcome.success === false) {
            const correction = this.claude.selfCorrect(
                this.decisionLog[this.decisionLog.length - 1]?.decision,
                data.lastOutcome
            );
            if (correction.corrected && correction.newStrategy) {
                return {
                    action: 'ANALYZE',
                    params: { question: `[自纠错] ${correction.newStrategy.message}。尝试: ${correction.newStrategy.suggestion}` },
                    reason: `claude_correction:${correction.newStrategy.type}`,
                };
            }
        }

        // 3. 代码进化时: 语法校验
        if (perception.type === 'code_evolution' && perception.code) {
            const syntaxResult = this.claude.syntaxCheck(perception.code);
            if (!syntaxResult.valid) {
                return {
                    action: 'ANALYZE',
                    params: {
                        question: `[语法校正] 发现${syntaxResult.errorCount}个错误, ${syntaxResult.warningCount}个警告: ` +
                            syntaxResult.issues.slice(0, 3).map(i => `L${i.line}:${i.message}`).join('; '),
                        syntaxIssues: syntaxResult.issues,
                    },
                    reason: `claude_syntax:${syntaxResult.errorCount}errors`,
                };
            }
        }

        // 4. 目标变更时: 战略规划
        if (perception.type === 'goal_change' && perception.newGoal) {
            const plan = this.claude.strategicPlan(
                perception.newGoal,
                perception.resources || [],
                perception.constraints || [{ type: 'cost', limit: 0 }] // 零成本约束
            );
            if (plan.phases.length > 0) {
                this.subGoals = plan.phases.map(p => ({
                    goal: p.name, status: 'pending', createdAt: Date.now(), phase: p.phase
                }));
                return {
                    action: 'ANALYZE',
                    params: {
                        question: `[战略规划] 目标"${perception.newGoal}"分解为${plan.phases.length}步, 可行性${(plan.feasibility * 100).toFixed(0)}%`,
                        plan,
                    },
                    reason: `claude_plan:${plan.phases.length}phases`,
                };
            }
        }

        return null;
    }

    // ── 效应增强 (路径依赖+鲶鱼+阈值触发 调节已有决策) ──
    _effectAugment(decision, data, context) {
        const perception = data.perception || data;

        // 路径依赖: 总做同一动作 → 提示探索
        const pathResult = this.effects.pathDependency(decision.action);
        if (pathResult.shouldExplore && decision.action !== 'ANALYZE') {
            decision.reason += ` [path_locked:${pathResult.lockIn.toFixed(2)}]`;
        }

        // 鲶鱼效应: 停滞过久 → 注入变异
        const catfish = this.effects.catfishEffect(0.5, this._stagnationCycles);
        if (catfish.stagnant) {
            decision.reason += ' [catfish:inject_variation]';
            this._stagnationCycles = 0;
        }

        // 阈值触发: 异常检测
        if (perception.memUsedPct) {
            const thresh = this.effects.thresholdTrigger({ name: 'memory', value: perception.memUsedPct });
            if (thresh.triggered) {
                decision.reason += ` [threshold:mem_z=${thresh.zscore.toFixed(1)}]`;
            }
        }

        if (decision.action !== 'WAIT') this._stagnationCycles = 0;
        return decision;
    }

    // ── 决策追踪 ──
    _trackDecision(method, decision) {
        this._lastActionType = decision.action;
        this.decisionLog.push({ time: Date.now(), method, decision });
        if (this.decisionLog.length > 100) this.decisionLog.splice(0, 50);
    }

    // ── 模板决策 (快速，基于已知模式) ──
    _templateDecide(data, context) {
        const perception = data.perception || data;
        const memories = data.memories || {};
        const goal = this.currentGoal || '';

        // 查找程序记忆中的匹配流程
        if (memories.procedural && memories.procedural.length > 0) {
            const bestProc = memories.procedural
                .filter(p => p.successRate > 0.5)
                .sort((a, b) => b.successRate - a.successRate)[0];

            if (bestProc && bestProc.steps.length > 0) {
                return {
                    action: 'EXECUTE_PROCEDURE',
                    params: { procedure: bestProc.goal, steps: bestProc.steps },
                    reason: `procedural_memory (${Math.round(bestProc.successRate * 100)}% success)`,
                };
            }
        }

        return null;
    }

    // ── LLM推理 (最慢但最强, 带推理+效应上下文) ──
    async _llmDecide(data, context) {
        const perception = data.perception || {};
        const goal = this.currentGoal || '观察并学习';

        // 收集推理引擎和效应模拟器的分析结果
        const reasoningCtx = this.reasoning.reason(perception, { emotions: data.emotions });
        const effectCtx = this.effects.evaluate({
            lastAction: this._lastActionType,
            stagnationCycles: this._stagnationCycles,
            performance: 0.5,
        });

        // ★ Claude思维链: 为LLM提供深度推理上下文
        const claudeThinking = this.claude.think(
            `目标:${goal} 感知:${perception.type || 'unknown'} 状态:${perception.summary || ''}`.substring(0, 200),
            { recentDecisions: this.decisionLog.slice(-5).map(d => d.decision) }
        );

        const prompt = `你是AI Agent决策大脑。融合多层推理分析做出最优决策。

当前目标: ${goal}
感知: ${JSON.stringify(perception, null, 2).substring(0, 800)}
情感: ${JSON.stringify(data.emotions || {})}
推理分析: ${JSON.stringify(reasoningCtx).substring(0, 400)}
效应评估: ${JSON.stringify(effectCtx).substring(0, 200)}
Claude思维链: ${claudeThinking.chainOfThought?.reasoning?.substring(0, 300) || ''}
元认知: 置信度${(claudeThinking.metacognition?.confidence * 100).toFixed(0)}% ${claudeThinking.metacognition?.status || ''}
建议: ${claudeThinking.suggestedAction || 'none'}

决策原则: 1.优先免费资源 2.失败即切换策略 3.循环即打破 4.有目标即规划 5.有代码即校验
可用动作: CLICK|目标, TYPE|字段|内容, NAVIGATE|url, PRESS|键名, SCROLL|方向, ANALYZE|问题, WAIT|毫秒, DONE|结果
回复格式: ACTION|参数
`;

        try {
            const response = await this.llm.think(prompt);
            const match = response.match(/^(CLICK|TYPE|NAVIGATE|PRESS|SCROLL|ANALYZE|WAIT|DONE)\|(.+)/m);
            if (match) {
                const [, action, paramStr] = match;
                const params = paramStr.split('|');
                return {
                    action,
                    params: { arg1: params[0], arg2: params[1] },
                    reason: 'llm_reasoning',
                    rawResponse: response.substring(0, 200),
                };
            }
        } catch (e) {
            console.log(`[PFC] LLM决策失败: ${e.message}`);
        }

        return null;
    }

    _parseUserCommand(text, intent) {
        switch (intent) {
            case 'navigate':
                const url = text.match(/https?:\/\/[^\s]+/);
                if (url) return { action: 'NAVIGATE', params: { url: url[0] }, reason: 'user_command' };
                return { action: 'SEARCH', params: { query: text }, reason: 'user_navigate_no_url' };
            case 'click':
                return { action: 'CLICK', params: { target: text.replace(/点击|按|click|press/gi, '').trim() }, reason: 'user_command' };
            case 'type':
                return { action: 'TYPE', params: { text: text.replace(/输入|填写|type|enter/gi, '').trim() }, reason: 'user_command' };
            case 'search':
                return { action: 'SEARCH', params: { query: text }, reason: 'user_command' };
            case 'stop':
                return { action: 'STOP', params: {}, reason: 'user_command' };
            case 'observe':
                return { action: 'OBSERVE', params: { duration: 10000 }, reason: 'user_command' };
            default:
                return { action: 'THINK', params: { question: text }, reason: 'user_complex_request' };
        }
    }

    // ── 目标管理 ──
    setGoal(goal) {
        this.currentGoal = goal;
        this.subGoals = [];
        console.log(`[PFC] 目标设定: ${goal}`);
    }

    addSubGoal(subGoal) {
        this.subGoals.push({ goal: subGoal, status: 'pending', createdAt: Date.now() });
    }

    completeSubGoal(index) {
        if (this.subGoals[index]) {
            this.subGoals[index].status = 'completed';
            this.subGoals[index].completedAt = Date.now();
        }
    }
}

// ═══════════════════════════════════════════════
//  基底神经节 (BasalGanglia) — 动作选择 & 奖惩学习
// ═══════════════════════════════════════════════

class BasalGanglia extends BrainRegion {
    constructor() {
        super('basal_ganglia', 48);

        // Q-learning式的动作价值表
        this.actionValues = new Map(); // state_hash → { action → value }
        this.learningRate = 0.1;
        this.discountFactor = 0.9;
        this.explorationRate = 0.15; // 15%概率尝试新动作
        this._lastState = null;
        this._lastAction = null;
    }

    async _compute(input) {
        const { data } = input;

        // 接收奖惩信号
        if (data?.action === 'reward') {
            return this._receiveReward(data.amount, data.state);
        }

        // 动作选择
        if (data?.action === 'select_action') {
            return this._selectAction(data.state, data.availableActions);
        }

        return { processed: false };
    }

    _stateHash(state) {
        // 将状态转为简化的哈希键
        const key = JSON.stringify(state).substring(0, 200);
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash) + key.charCodeAt(i);
            hash |= 0;
        }
        return hash.toString(36);
    }

    // ── 动作选择 (ε-greedy策略) ──
    _selectAction(state, availableActions) {
        const stateKey = this._stateHash(state);
        const values = this.actionValues.get(stateKey) || {};

        // 探索: 随机选择
        if (Math.random() < this.explorationRate) {
            const action = availableActions[Math.floor(Math.random() * availableActions.length)];
            this._lastState = stateKey;
            this._lastAction = action;
            return { action, method: 'explore', values };
        }

        // 利用: 选择最高价值动作
        let bestAction = availableActions[0];
        let bestValue = -Infinity;

        for (const action of availableActions) {
            const value = values[action] || 0;
            if (value > bestValue) {
                bestValue = value;
                bestAction = action;
            }
        }

        this._lastState = stateKey;
        this._lastAction = bestAction;
        return { action: bestAction, method: 'exploit', value: bestValue };
    }

    // ── 接收奖惩 (更新Q值) ──
    _receiveReward(reward, newState) {
        if (!this._lastState || !this._lastAction) return { updated: false };

        const newStateKey = this._stateHash(newState);

        // 获取新状态的最大价值
        const newValues = this.actionValues.get(newStateKey) || {};
        let maxNextValue = 0;
        for (const v of Object.values(newValues)) {
            maxNextValue = Math.max(maxNextValue, v);
        }

        // Q-learning更新 (使用QuantFormulas统一公式)
        if (!this.actionValues.has(this._lastState)) {
            this.actionValues.set(this._lastState, {});
        }
        const values = this.actionValues.get(this._lastState);
        const oldValue = values[this._lastAction] || 0;
        values[this._lastAction] = QuantFormulas.qLearningUpdate(
            oldValue, reward, maxNextValue, this.learningRate, this.discountFactor
        );

        // 减少探索率 (越学越确信)
        this.explorationRate = Math.max(0.05, this.explorationRate * 0.999);

        return { updated: true, oldValue, newValue: values[this._lastAction], reward };
    }

    // 获取学习统计
    getStats() {
        return {
            statesLearned: this.actionValues.size,
            explorationRate: Math.round(this.explorationRate * 100) + '%',
        };
    }
}

// ═══════════════════════════════════════════════
//  小脑 (Cerebellum) — 运动规划 & 习惯自动化
//  将决策转化为精确的操作序列
// ═══════════════════════════════════════════════

class Cerebellum extends BrainRegion {
    constructor() {
        super('cerebellum', 48);
        this.habits = new Map();  // 自动化的操作序列
        this.motorPatterns = [];  // 学习到的运动模式
    }

    async _compute(input) {
        const { data } = input;
        const decision = data.decision;
        if (!decision) return { actions: [] };

        // 1. 检查是否有已自动化的习惯
        const habitKey = `${decision.action}:${JSON.stringify(decision.params).substring(0, 50)}`;
        const habit = this.habits.get(habitKey);
        if (habit && habit.successRate > 0.8) {
            console.log(`[Cerebellum] 使用自动化习惯: ${habitKey} (${Math.round(habit.successRate * 100)}%成功率)`);
            return {
                actions: habit.actions,
                method: 'habit',
                confidence: habit.successRate,
            };
        }

        // 2. 将高级决策分解为低级操作
        const actions = this._decompose(decision);

        return { actions, method: 'planned', confidence: 0.5 };
    }

    // 将高级命令分解为鼠标/键盘操作序列
    _decompose(decision) {
        const { action, params } = decision;
        const actions = [];

        switch (action) {
            case 'CLICK':
                actions.push(
                    { type: 'find_element', target: params.target || params.arg1 },
                    { type: 'mouse_move', target: 'found_element' },
                    { type: 'wait', ms: 50 + Math.random() * 100 },
                    { type: 'mouse_click' },
                    { type: 'wait', ms: 500 },
                );
                break;

            case 'TYPE':
                actions.push(
                    { type: 'find_element', target: params.field || params.arg1 },
                    { type: 'mouse_click' },
                    { type: 'wait', ms: 100 },
                    { type: 'select_all' },
                    { type: 'keyboard_type', text: params.text || params.arg2, humanLike: true },
                    { type: 'wait', ms: 200 },
                );
                break;

            case 'NAVIGATE':
                actions.push(
                    { type: 'navigate', url: params.url || params.arg1 },
                    { type: 'wait_load', timeout: 15000 },
                );
                break;

            case 'PRESS':
                actions.push(
                    { type: 'keyboard_press', key: params.key || params.arg1 },
                    { type: 'wait', ms: 500 },
                );
                break;

            case 'SCROLL':
                actions.push(
                    { type: 'scroll', direction: params.direction || params.arg1 || 'down', amount: 500 },
                    { type: 'wait', ms: 300 },
                );
                break;

            case 'ANALYZE':
                actions.push(
                    { type: 'capture_screen' },
                    { type: 'vlm_analyze', question: params.question || params.arg1 },
                );
                break;

            case 'WAIT':
                actions.push({ type: 'wait', ms: parseInt(params.ms || params.arg1) || 2000 });
                break;

            case 'DONE':
                actions.push({ type: 'done', result: params.result || params.arg1 });
                break;

            case 'EXECUTE_PROCEDURE':
                // 执行已知流程
                if (params.steps) {
                    for (const step of params.steps) {
                        actions.push(...this._decompose({ action: step.action, params: step.params || {} }).actions || [step]);
                    }
                }
                break;

            default:
                actions.push({ type: 'unknown', original: decision });
        }

        return actions;
    }

    // 学习新习惯 (成功的动作序列会被记忆)
    learnHabit(key, actions, success) {
        const existing = this.habits.get(key);
        if (existing) {
            existing.totalAttempts++;
            if (success) existing.successCount++;
            existing.successRate = existing.successCount / existing.totalAttempts;
            if (success && actions.length < existing.actions.length) {
                existing.actions = actions; // 更短的成功路径
            }
        } else {
            this.habits.set(key, {
                actions,
                successCount: success ? 1 : 0,
                totalAttempts: 1,
                successRate: success ? 1.0 : 0,
                createdAt: Date.now(),
            });
        }
    }
}

// ═══════════════════════════════════════════════
//  LLM客户端 — 连接本地Ollama
// ═══════════════════════════════════════════════

class LocalLLM {
    constructor() {
        this.ollamaHost = 'http://127.0.0.1:11434';
        this._available = false;
        this._model = 'qwen2.5:7b';
        this._geminiKey = null;
    }

    async init() {
        // 检查Ollama
        try {
            const resp = await this._get(`${this.ollamaHost}/api/tags`);
            const data = JSON.parse(resp);
            const models = data.models || [];
            if (models.length > 0) {
                this._available = true;
                // 优先用较大的模型
                const preferred = ['qwen2.5:14b', 'qwen2.5:7b', 'llama3.1:8b', 'mistral:7b'];
                for (const p of preferred) {
                    if (models.some(m => m.name.includes(p.split(':')[0]))) {
                        this._model = p;
                        break;
                    }
                }
                console.log(`[LLM] Ollama就绪: ${this._model} (${models.length}个模型)`);
            }
        } catch (e) {
            console.log('[LLM] Ollama未运行');
        }

        // 加载Gemini key作为备选
        try {
            const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'ai-resources-config.json'), 'utf8'));
            this._geminiKey = config.apiKeys?.gemini || null;
            if (this._geminiKey) console.log('[LLM] Gemini备选可用');
        } catch (e) {}
    }

    async think(prompt, systemPrompt = '') {
        // 优先Gemini (更强)
        if (this._geminiKey) {
            try {
                const result = await this._askGemini(prompt, systemPrompt);
                if (result) return result;
            } catch (e) {
                if (e.message?.includes('429')) this._geminiKey = null;
            }
        }

        // Ollama本地
        if (this._available) {
            return await this._askOllama(prompt, systemPrompt);
        }

        return '';
    }

    async _askOllama(prompt, systemPrompt) {
        const body = JSON.stringify({
            model: this._model,
            messages: [
                ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                { role: 'user', content: prompt.substring(0, 3000) },
            ],
            stream: false,
            options: { temperature: 0.1, num_predict: 150 },
        });
        const resp = await this._post(`${this.ollamaHost}/api/chat`, body);
        let data; try { data = JSON.parse(resp); } catch { data = null; }
        return data?.message?.content || '';
    }

    async _askGemini(prompt, systemPrompt) {
        const fullPrompt = (systemPrompt ? systemPrompt + '\n\n' : '') + prompt;
        const body = JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { maxOutputTokens: 200 },
        });
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${this._geminiKey}`;
        const resp = await this._httpsPost(url, body);
        let data; try { data = JSON.parse(resp); } catch { data = null; }
        if (data?.error) {
            if (data.error.code === 429) this._geminiKey = null;
            throw new Error(`Gemini: ${data.error.message?.substring(0, 50)}`);
        }
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    _get(url) {
        return new Promise((resolve, reject) => {
            http.get(url, { timeout: 5000 }, res => {
                let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
            }).on('error', reject);
        });
    }

    _post(url, body) {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const req = http.request({
                hostname: u.hostname, port: u.port, path: u.pathname,
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                timeout: 60000,
            }, res => {
                let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.write(body); req.end();
        });
    }

    _httpsPost(url, body) {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const req = https.request({
                hostname: u.hostname, path: u.pathname + u.search,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
                timeout: 30000,
            }, res => {
                let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
            });
            req.on('error', reject);
            req.write(body); req.end();
        });
    }
}

// ═══════════════════════════════════════════════
//  NeuroBrain — 完整的神经科学大脑
//  统合所有脑区，连接眼睛和手
// ═══════════════════════════════════════════════

class NeuroBrain extends EventEmitter {
    constructor(options = {}) {
        super();

        // ── 创建所有脑区 ──
        this.llm = new LocalLLM();
        this.thalamus = new Thalamus();
        this.sensoryCortex = new SensoryCortex();
        this.hippocampus = new Hippocampus();
        this.amygdala = new Amygdala();
        this.prefrontalCortex = new PrefrontalCortex(this.llm);
        this.basalGanglia = new BasalGanglia();
        this.cerebellum = new Cerebellum();

        // ── 外部接口 ──
        this.eyes = null;    // RealTimeEyes
        this.hands = null;   // 执行引擎 (浏览器/桌面)

        // ── 神经通路 (脑区之间的连接) ──
        this._setupNeuralPathways();

        // ── 状态 ──
        this._running = false;
        this._thinkCycle = 0;
        this._lastDecision = null;
        this._stats = {
            totalCycles: 0,
            decisions: 0,
            actionsExecuted: 0,
            rewards: 0,
            startTime: Date.now(),
        };
    }

    // ── 建立神经通路 ──
    _setupNeuralPathways() {
        // 丘脑路由表: 感知输入 → 对应脑区
        this.thalamus.registerRoute('visual_change', this.sensoryCortex);
        this.thalamus.registerRoute('ocr_text', this.sensoryCortex);
        this.thalamus.registerRoute('window_switch', this.sensoryCortex);
        this.thalamus.registerRoute('vlm_understanding', this.sensoryCortex);
        this.thalamus.registerRoute('vision_understanding', this.sensoryCortex); // 眼睛VLM感知
        this.thalamus.registerRoute('system_status', this.sensoryCortex);        // 系统状态感知
        this.thalamus.registerRoute('evolution_status', this.sensoryCortex);     // 进化状态感知
        this.thalamus.registerRoute('user_input', this.sensoryCortex);
        this.thalamus.registerRoute('default', this.sensoryCortex);

        console.log('[NeuroBrain] 神经通路建立完成');
    }

    // ── 初始化 ──
    async init() {
        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║  活体种子AI - 神经科学级大脑 v1.0                          ║');
        console.log('║                                                           ║');
        console.log('║  丘脑 → 感知皮层 → 海马体 + 杏仁核 → 前额叶              ║');
        console.log('║          → 基底神经节 → 小脑 → 运动输出                   ║');
        console.log('║                                                           ║');
        console.log('║  四层记忆: 工作 → 情景 → 语义 → 程序                      ║');
        console.log('║  学习: Hebbian + Q-learning + 睡眠整合                    ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');

        await this.llm.init();

        const memStats = this.hippocampus.getMemoryStats();
        console.log(`[NeuroBrain] 记忆加载: ${memStats.episodic}情景 ${memStats.semantic}语义 ${memStats.procedural}程序`);
        console.log('[NeuroBrain] 大脑就绪!\n');
    }

    // ── 连接眼睛 (RealTimeEyes) ──
    connectEyes(eyes) {
        this.eyes = eyes;

        // 订阅眼睛事件 → 丘脑中继
        eyes.on('change', (data) => {
            this.perceive('visual_change', data, data.changeRatio || 0.5);
        });

        eyes.on('text', (data) => {
            this.perceive('ocr_text', data, 0.6);
        });

        eyes.on('vision', (data) => {
            this.perceive('vlm_understanding', data, 0.8);
        });

        eyes.on('window', (data) => {
            this.perceive('window_switch', data, 0.7);
        });

        console.log('[NeuroBrain] 眼睛已连接 (RealTimeEyes → 丘脑)');
    }

    // ── 连接手 (执行引擎) ──
    connectHands(hands) {
        this.hands = hands;
        console.log('[NeuroBrain] 手已连接');
    }

    // ── 感知输入 (通过丘脑中继) ──
    async perceive(type, data, intensity = 0.5) {
        // 1. 丘脑中继
        const routed = await this.thalamus.process({ type, data, intensity });
        if (!routed.routed) return;

        // 2. 感知结果送到杏仁核评估重要性
        const perceptionResult = routed.results?.[0]?.result;
        if (!perceptionResult || !perceptionResult.processed) return;

        const emotional = await this.amygdala.process({ data: perceptionResult });

        // 3. 存入海马体 (工作记忆)
        const memResult = await this.hippocampus.process({
            data: { ...perceptionResult, emotionalTag: emotional.emotionalTag },
            source: 'sensory_cortex',
        });

        // 4. 如果杏仁核说"需要行动" → 触发决策
        if (emotional.shouldAct && this._running) {
            this.emit('need_decision', { perception: perceptionResult, emotional, memory: memResult });
        }
    }

    // ── 思考决策 (完整的神经回路) ──
    async think(triggerData = null) {
        this._thinkCycle++;
        this._stats.totalCycles++;

        // 1. 收集当前工作记忆
        const workingMem = this.hippocampus.workingMemory.slice(-5);

        // 2. 查询相关记忆
        const goal = this.prefrontalCortex.currentGoal || '';
        let relevantMemories = {};
        if (goal) {
            const recalled = await this.hippocampus.process({
                data: { action: 'recall', query: goal, type: 'all' },
            });
            relevantMemories = recalled;
        }

        // 3. 获取情感状态
        const emotions = this.amygdala.getEmotionalState();

        // 4. 前额叶决策
        const decision = await this.prefrontalCortex.process({
            data: {
                perception: triggerData?.perception || workingMem[workingMem.length - 1]?.content,
                memories: {
                    working: workingMem,
                    relevant: relevantMemories?.results?.slice(0, 5),
                    procedural: relevantMemories?.results?.filter(r => r.source === 'procedural'),
                },
                emotions,
            },
        });

        this._lastDecision = decision;
        this._stats.decisions++;

        // 5. 小脑将决策转为操作序列
        const motorPlan = await this.cerebellum.process({ data: { decision } });

        // 6. 基底神经节记录 (用于奖惩学习)
        const state = {
            goal,
            lastPerception: triggerData?.perception?.type,
            emotions: { u: Math.round(emotions.urgency * 10), f: Math.round(emotions.frustration * 10) },
        };
        await this.basalGanglia.process({
            data: { action: 'select_action', state, availableActions: [decision.action] },
        });

        this.emit('decision', { decision, motorPlan, emotions });

        return { decision, actions: motorPlan.actions, method: motorPlan.method };
    }

    // ── 执行操作 (通过手) ──
    async execute(actions) {
        if (!this.hands) {
            console.log('[NeuroBrain] 没有连接手，无法执行');
            return { executed: false };
        }

        const results = [];
        for (const action of actions) {
            try {
                let result;
                switch (action.type) {
                    case 'navigate':
                        result = await this.hands.execute(`NAVIGATE|${action.url}`);
                        break;
                    case 'find_element':
                        // 记录目标，实际点击在mouse_click中执行
                        this._currentTarget = action.target;
                        result = { ok: true, msg: `target: ${action.target}` };
                        break;
                    case 'mouse_click':
                        if (this._currentTarget) {
                            result = await this.hands.execute(`CLICK|${this._currentTarget}`);
                        }
                        break;
                    case 'keyboard_type':
                        result = await this.hands.execute(`TYPE|${this._currentTarget || 'input'}|${action.text}`);
                        break;
                    case 'keyboard_press':
                        result = await this.hands.execute(`PRESS|${action.key}`);
                        break;
                    case 'scroll':
                        result = await this.hands.execute(`SCROLL|${action.direction}`);
                        break;
                    case 'wait':
                        await new Promise(r => setTimeout(r, action.ms || 1000));
                        result = { ok: true, msg: `waited ${action.ms}ms` };
                        break;
                    case 'wait_load':
                        await new Promise(r => setTimeout(r, 3000));
                        result = { ok: true, msg: 'page loaded' };
                        break;
                    case 'capture_screen':
                        if (this.eyes) {
                            const img = await this.eyes.capture?.captureSmall?.(960);
                            result = { ok: true, msg: 'captured', image: img };
                        }
                        break;
                    case 'vlm_analyze':
                        if (this.eyes) {
                            const answer = await this.eyes.askNow(action.question);
                            result = { ok: true, msg: answer };
                        }
                        break;
                    case 'done':
                        result = { ok: true, msg: 'done', done: true, result: action.result };
                        break;
                    case 'select_all':
                        // Ctrl+A (在hands层处理)
                        result = { ok: true, msg: 'select_all' };
                        break;
                    default:
                        result = { ok: false, msg: `unknown action type: ${action.type}` };
                }

                if (result) {
                    results.push(result);
                    this._stats.actionsExecuted++;
                }
            } catch (e) {
                results.push({ ok: false, msg: e.message });
            }
        }

        // 评估执行结果 → 奖惩学习
        const success = results.every(r => r.ok);
        const reward = success ? 0.5 : -0.3;
        const isDone = results.some(r => r.done);

        if (isDone) {
            // 任务完成 → 大奖励
            await this.basalGanglia.process({
                data: { action: 'reward', amount: 1.0, state: { done: true } },
            });
            this._stats.rewards++;

            // 存入程序记忆 (成功的操作序列)
            await this.hippocampus.process({
                data: {
                    action: 'store',
                    type: 'procedural',
                    value: {
                        goal: this.prefrontalCortex.currentGoal,
                        steps: actions,
                        success: true,
                    },
                },
            });
        } else {
            await this.basalGanglia.process({
                data: { action: 'reward', amount: reward, state: { step: this._thinkCycle } },
            });
        }

        return { results, success, isDone };
    }

    // ── 自主运行循环 ──
    async run(goal, maxCycles = 50) {
        this.prefrontalCortex.setGoal(goal);
        this._running = true;
        this._thinkCycle = 0;

        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  大脑启动自主运行`);
        console.log(`  目标: ${goal}`);
        console.log(`  最大周期: ${maxCycles}`);
        console.log(`${'═'.repeat(60)}\n`);

        // 监听"需要决策"事件
        const decisionHandler = async (triggerData) => {
            if (!this._running || this._thinkCycle >= maxCycles) return;

            try {
                const { decision, actions, method } = await this.think(triggerData);
                console.log(`  [周期 ${this._thinkCycle}] ${decision.action} (${decision.reason}) via ${method}`);

                if (actions && actions.length > 0) {
                    const execResult = await this.execute(actions);

                    if (execResult.isDone) {
                        const doneResult = execResult.results.find(r => r.done);
                        console.log(`\n  ✓ 任务完成: ${doneResult?.result || '完成'}`);
                        this._running = false;
                        this.emit('goal_achieved', { result: doneResult?.result, cycles: this._thinkCycle });
                    }
                }
            } catch (e) {
                console.log(`  [错误] ${e.message}`);
            }
        };

        this.on('need_decision', decisionHandler);

        // 如果没有外部感知触发，也定期思考
        const thinkInterval = setInterval(async () => {
            if (!this._running || this._thinkCycle >= maxCycles) {
                clearInterval(thinkInterval);
                return;
            }
            // 主动思考（不等外部刺激）
            await decisionHandler({});
        }, 2000);

        // 等待完成或超时
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this._running = false;
                clearInterval(thinkInterval);
                this.removeListener('need_decision', decisionHandler);
                resolve({ completed: false, cycles: this._thinkCycle, reason: 'max_cycles' });
            }, maxCycles * 5000);

            this.on('goal_achieved', (result) => {
                clearTimeout(timeout);
                clearInterval(thinkInterval);
                this.removeListener('need_decision', decisionHandler);
                resolve({ completed: true, ...result });
            });
        });
    }

    // ── 停止运行 ──
    stop() {
        this._running = false;
        console.log('[NeuroBrain] 停止运行');
    }

    // ── 睡眠 (记忆整合 + 突触修剪) ──
    async sleep() {
        console.log('\n[NeuroBrain] 进入睡眠整合模式...');

        // 1. 海马体记忆整合
        this.hippocampus.sleepConsolidate();

        // 2. 保存大脑状态
        this._saveBrainState();

        console.log('[NeuroBrain] 睡眠整合完成\n');
    }

    _saveBrainState() {
        try {
            const state = {
                stats: this._stats,
                basalGanglia: {
                    actionValues: Object.fromEntries(this.basalGanglia.actionValues),
                    explorationRate: this.basalGanglia.explorationRate,
                },
                cerebellum: {
                    habits: Object.fromEntries(this.cerebellum.habits),
                },
                amygdala: {
                    emotionalState: this.amygdala.emotionalState,
                },
                prefrontalCortex: {
                    decisionLog: this.prefrontalCortex.decisionLog.slice(-50),
                    stagnationCycles: this.prefrontalCortex._stagnationCycles,
                },
                effects: {
                    thresholds: Object.fromEntries(this.prefrontalCortex.effects.thresholds),
                    pathHistory: this.prefrontalCortex.effects.pathHistory.slice(-20),
                },
                claude: {
                    metaCognition: this.prefrontalCortex.claude.metaCognition,
                    correctionLog: this.prefrontalCortex.claude.correctionLog.slice(-20),
                    strategyHistory: this.prefrontalCortex.claude.strategyHistory.slice(-10),
                },
                savedAt: new Date().toISOString(),
            };
            fs.writeFileSync(BRAIN_STATE_FILE, JSON.stringify(state, null, 2));
            console.log('[NeuroBrain] 大脑状态已保存');
        } catch (e) {
            console.log('[NeuroBrain] 保存失败:', e.message);
        }
    }

    _loadBrainState() {
        try {
            if (!fs.existsSync(BRAIN_STATE_FILE)) return;
            const state = JSON.parse(fs.readFileSync(BRAIN_STATE_FILE, 'utf8'));

            if (state.basalGanglia?.actionValues) {
                this.basalGanglia.actionValues = new Map(Object.entries(state.basalGanglia.actionValues));
                this.basalGanglia.explorationRate = state.basalGanglia.explorationRate || 0.15;
            }
            if (state.cerebellum?.habits) {
                this.cerebellum.habits = new Map(Object.entries(state.cerebellum.habits));
            }
            if (state.amygdala?.emotionalState) {
                Object.assign(this.amygdala.emotionalState, state.amygdala.emotionalState);
            }
            if (state.effects?.thresholds) {
                this.prefrontalCortex.effects.thresholds = new Map(Object.entries(state.effects.thresholds));
            }
            if (state.effects?.pathHistory) {
                this.prefrontalCortex.effects.pathHistory = state.effects.pathHistory;
            }
            if (state.prefrontalCortex?.stagnationCycles) {
                this.prefrontalCortex._stagnationCycles = state.prefrontalCortex.stagnationCycles;
            }
            if (state.claude?.metaCognition) {
                Object.assign(this.prefrontalCortex.claude.metaCognition, state.claude.metaCognition);
            }
            if (state.claude?.correctionLog) {
                this.prefrontalCortex.claude.correctionLog = state.claude.correctionLog;
            }

            console.log('[NeuroBrain] 大脑状态已恢复(含Claude思维)');
        } catch (e) {}
    }

    // ── 获取大脑状态摘要 ──
    getStatus() {
        const mem = this.hippocampus.getMemoryStats();
        const bg = this.basalGanglia.getStats();
        const emo = this.amygdala.getEmotionalState();

        return {
            running: this._running,
            goal: this.prefrontalCortex.currentGoal,
            cycle: this._thinkCycle,
            memory: mem,
            learning: bg,
            emotions: emo,
            stats: this._stats,
            lastDecision: this._lastDecision?.action,
            eyesConnected: !!this.eyes,
            handsConnected: !!this.hands,
        };
    }
}

// ═══════════════════════════════════════════════
//  自测
// ═══════════════════════════════════════════════

async function selfTest() {
    console.log('═'.repeat(60));
    console.log('  活体种子AI - 神经科学级大脑 v3.0 自测');
    console.log('  5推理 + 10效应 + 7公式 + Vision-Agent + ★Claude思维模式');
    console.log('═'.repeat(60) + '\n');

    const brain = new NeuroBrain();
    await brain.init();

    // 测试1: 感知处理
    console.log('\n--- 测试1: 感知处理 ---');
    await brain.perceive('user_input', { text: '打开百度搜索AI最新进展', intent: 'navigate' }, 1.0);
    await new Promise(r => setTimeout(r, 200));
    console.log('工作记忆:', brain.hippocampus.workingMemory.length);

    // 测试2: 溯因推理 (Abductive + 贝叶斯)
    console.log('\n--- 测试2: 溯因推理(贝叶斯) ---');
    const reasoning = brain.prefrontalCortex.reasoning;
    const hypotheses = reasoning.abductiveReason('connection timeout error', [
        { hypothesis: 'network_error', likelihood: 0.8, prior: 0.3 },
        { hypothesis: 'server_down', likelihood: 0.5, prior: 0.2 },
        { hypothesis: 'code_bug', likelihood: 0.3, prior: 0.4 },
    ]);
    console.log('最佳假设:', hypotheses[0].hypothesis, '后验概率:', hypotheses[0].posterior.toFixed(3));
    console.log('全部假设:', hypotheses.map(h => `${h.hypothesis}(${(h.posterior * 100).toFixed(0)}%)`).join(', '));

    // 测试3: 微特征推理
    console.log('\n--- 测试3: 微特征推理 ---');
    const mf = reasoning.microFeatureInfer([
        { name: 'urgency', value: 0.9, weight: 1.5 },
        { name: 'error_count', value: 0.6, weight: 2.0 },
        { name: 'mem_pressure', value: 0.3, weight: 1.0 },
    ]);
    console.log('综合评分:', mf.score.toFixed(2), 'sigmoid:', mf.normalized.toFixed(3), '主导:', mf.dominant);

    // 测试4: 效应模型
    console.log('\n--- 测试4: 效应模型 ---');
    const effects = brain.prefrontalCortex.effects;

    // 多米诺链
    const domino = effects.dominoChain({ node: 'API_fail', impact: 1.0 }, ['API_fail', 'no_llm', 'no_evolve', 'stagnant']);
    console.log('多米诺链:', domino.triggered, '步, 总影响:', domino.totalImpact.toFixed(2));

    // 破窗效应
    const bw = effects.brokenWindow([{ fixed: false }, { fixed: false }, { fixed: true }, { fixed: false }, { fixed: false }]);
    console.log('破窗效应:', bw.unfixed, '未修复, 退化率:', bw.degradation.toFixed(2), '建议:', bw.recommendation);

    // 鲶鱼效应
    const cf = effects.catfishEffect(0.5, 8);
    console.log('鲶鱼效应: 停滞=', cf.stagnant, '建议:', cf.recommendation);

    // 路径依赖
    for (let i = 0; i < 8; i++) effects.pathDependency('DONE');
    const pd = effects.pathDependency('DONE');
    console.log('路径依赖: 锁定度=', pd.lockIn.toFixed(2), '应探索=', pd.shouldExplore);

    // 混沌预测
    const chaos = effects.chaosPredict(0.5, 3.9, 20);
    console.log('混沌预测: Lyapunov=', chaos.lyapunov.toFixed(3), '混沌=', chaos.chaotic);

    // 测试5: 量化公式
    console.log('\n--- 测试5: 量化公式引擎 ---');
    console.log('贝叶斯:', QuantFormulas.bayesianUpdate(0.3, 0.8, 0.5).toFixed(3));
    console.log('特征映射:', QuantFormulas.featureMap([0.5, 0.8, 0.3], [2.0, 1.5, 1.0]).toFixed(3));
    console.log('Q-Learning:', QuantFormulas.qLearningUpdate(0.5, 1.0, 0.8, 0.1, 0.9).toFixed(3));
    console.log('认知更新:', QuantFormulas.cognitiveUpdate(0.6, 0.3, 0.05, 0.3).toFixed(3));
    console.log('混沌逻辑:', QuantFormulas.chaosLogistic(0.5, 3.8).toFixed(3));
    console.log('阈值触发:', QuantFormulas.thresholdTrigger(95, 60, 10, 2.0), '(95偏离60±2σ)');

    // 测试6: OCR + action-grounding
    console.log('\n--- 测试6: Vision-Agent Action Grounding ---');
    await brain.perceive('ocr_text', {
        text: 'Sign in with Google  AIzaSyD7GtNdgtS4OUPY12345  Create API key  Submit',
        words: [],
    }, 0.9);
    await new Promise(r => setTimeout(r, 200));
    const lastMem = brain.hippocampus.workingMemory[brain.hippocampus.workingMemory.length - 1];
    console.log('actionTargets:', lastMem?.content?.actionTargets?.length, '个可交互目标');
    console.log('目标详情:', JSON.stringify(lastMem?.content?.actionTargets?.slice(0, 3)));

    // 测试7: 5级决策管线
    console.log('\n--- 测试7: 5级决策管线 ---');
    brain.prefrontalCortex.setGoal('获取Gemini API Key');

    // 测试fast路径(有apiKey)
    const { decision: d1 } = await brain.think({
        perception: { type: 'text', keywords: [{ type: 'apiKey', values: ['AIzaSyXXXXXX'] }], importance: 0.95 },
    });
    console.log('Level1(fast):', d1.action, d1.reason);

    // 测试reasoning路径(有error + 高urgency)
    brain.amygdala.emotionalState.urgency = 0.9;
    const { decision: d2 } = await brain.think({
        perception: { type: 'text', keywords: [{ type: 'error', values: ['timeout'] }], summary: 'connection timeout', importance: 0.8 },
    });
    console.log('Level2(reasoning):', d2.action, d2.reason);

    // 测试8: 睡眠整合(含认知更新公式)
    console.log('\n--- 测试8: 睡眠整合(认知更新) ---');
    await brain.sleep();

    // 测试9: ★ Claude思维模式 — 语法校正
    console.log('\n--- 测试9: Claude语法校正引擎 ---');
    const claude = brain.prefrontalCortex.claude;
    const syntaxResult = claude.syntaxCheck(`
function test() {
    if (x = 5) { // assignment in condition
        console.log("hello";;
        eval("dangerous");
    }
    const secret = "sk-1234567890abcdef";
}
`);
    console.log('语法检查:', syntaxResult.valid ? '✓通过' : '✗有错误');
    console.log(`  错误:${syntaxResult.errorCount} 警告:${syntaxResult.warningCount} 安全:${syntaxResult.securityCount}`);
    for (const issue of syntaxResult.issues.slice(0, 5)) {
        console.log(`  L${issue.line} [${issue.severity}] ${issue.message}`);
    }

    // 测试10: Claude思维链推理
    console.log('\n--- 测试10: Claude思维链(Chain-of-Thought) ---');
    const cotResult = claude.chainOfThought('API连接timeout错误需要修复', {
        recentDecisions: [{ action: 'ANALYZE', reason: 'error' }],
        memories: { semantic: [{ concept: 'network error fix', content: 'retry with backoff' }] },
    });
    console.log('推理链:', cotResult.reasoning);
    console.log('结论:', cotResult.conclusion, '置信:', (cotResult.confidence * 100).toFixed(0) + '%');

    // 测试11: Claude元认知监控
    console.log('\n--- 测试11: Claude元认知监控 ---');
    const metaResult = claude.metacognitiveCheck({
        lastActions: [
            { action: 'DONE' }, { action: 'DONE' }, { action: 'DONE' },
            { action: 'DONE' }, { action: 'DONE' }, // 连续5次DONE = 卡住
        ],
        recentResults: [{ success: true }, { success: false }, { success: false }],
    });
    console.log('元认知状态:', metaResult.status);
    console.log('需要行动:', metaResult.actionRequired);
    if (metaResult.suggestions.length > 0) {
        console.log('建议:', metaResult.suggestions[0].message);
    }

    // 测试12: Claude代码质量分析
    console.log('\n--- 测试12: Claude代码质量分析 ---');
    const qualityResult = claude.codeQualityAnalysis(`
class Example {
    constructor() {
        this.value = 42;
    }
    // TODO: optimize this
    process(data) {
        if (data) {
            for (let i = 0; i < data.length; i++) {
                if (data[i] > 100) {
                    if (data[i] > 200) {
                        return data[i] * 3.14159;
                    }
                }
            }
        }
        return null;
    }
}
`);
    console.log(`质量: ${qualityResult.grade}(${qualityResult.qualityScore}/100)`);
    console.log(`  代码行:${qualityResult.codeLines} 注释:${qualityResult.commentLines} 复杂度:${qualityResult.complexityScore} 最深嵌套:${qualityResult.nestingDepth}`);

    // 测试13: Claude战略规划
    console.log('\n--- 测试13: Claude战略规划 ---');
    const planResult = claude.strategicPlan('部署种子到免费云', ['compute', 'network'], [{ type: 'cost', limit: 0 }]);
    console.log('规划:', planResult.phases.map(p => p.name).join(' → '));
    console.log('可行性:', (planResult.feasibility * 100).toFixed(0) + '%');
    console.log('风险:', planResult.risks.length, '个');

    // 测试14: Claude自我纠错
    console.log('\n--- 测试14: Claude自我纠错 ---');
    claude.selfCorrect({ action: 'NAVIGATE' }, { success: false, error: 'network_timeout' });
    claude.selfCorrect({ action: 'NAVIGATE' }, { success: false, error: 'network_timeout' });
    const correction = claude.selfCorrect({ action: 'NAVIGATE' }, { success: false, error: 'network_timeout' });
    console.log('纠错:', correction.corrected ? '✓触发策略切换' : '未触发');
    if (correction.newStrategy) console.log('新策略:', correction.newStrategy.message);

    // 测试15: Claude综合思维
    console.log('\n--- 测试15: Claude综合思维入口 ---');
    const thinkResult = claude.think('系统内存不足需要优化', {
        knownSolutions: [
            { problem: '内存泄漏优化', solution: '清理缓存+限制数组大小', successRate: 0.8, similarity: 0.7 },
            { problem: 'CPU优化', solution: '减少循环', successRate: 0.6, similarity: 0.3 },
        ],
    });
    console.log('综合置信:', (thinkResult.overallConfidence * 100).toFixed(0) + '%');
    console.log('类比:', thinkResult.analogy?.found ? `找到类似解法(${(thinkResult.analogy.confidence * 100).toFixed(0)}%)` : '无类比');
    console.log('建议:', thinkResult.suggestedAction || '继续观察');

    // 最终状态
    const status = brain.getStatus();
    console.log('\n' + '═'.repeat(60));
    console.log('  自测完成!');
    console.log('═'.repeat(60));
    console.log(`  记忆: 工作${status.memory.working} 情景${status.memory.episodic} 语义${status.memory.semantic} 程序${status.memory.procedural}`);
    console.log(`  学习: ${status.learning.statesLearned}状态, 探索率${status.learning.explorationRate}`);
    console.log(`  情感: 紧迫${status.emotions.urgency.toFixed(2)} 好奇${status.emotions.curiosity.toFixed(2)} 满足${status.emotions.satisfaction.toFixed(2)}`);
    console.log(`  统计: ${status.stats.totalCycles}周期 ${status.stats.decisions}决策`);
    console.log(`  推理引擎: ReasoningEngine(5模式) + EffectSimulator(10效应) + QuantFormulas(7公式)`);
    console.log(`  ★ Claude思维: 语法校正 + 思维链 + 元认知 + 代码质量 + 战略规划 + 自纠错 + 类比推理`);
    console.log(`  决策管线: fast → reasoning → claude_thinking → template+effect → llm → WAIT (6级)`);
}

// ═══════════════════════════════════════════════
//  导出
// ═══════════════════════════════════════════════

module.exports = {
    NeuroBrain,
    Thalamus,
    SensoryCortex,
    Hippocampus,
    Amygdala,
    PrefrontalCortex,
    BasalGanglia,
    Cerebellum,
    LocalLLM,
    Synapse,
    Neuron,
    BrainRegion,
    ReasoningEngine,
    EffectSimulator,
    QuantFormulas,
    ClaudeThinkingPatterns,  // ★ Claude思维模式引擎
};

if (require.main === module) {
    selfTest().catch(err => {
        console.error('自测失败:', err);
        process.exit(1);
    });
}
