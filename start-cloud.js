/**
 * 活体种子AI - 云端启动入口 v1.0
 *
 * 在免费云平台(HuggingFace Spaces / Render / Railway)运行
 * 只运行"大脑"部分: 进化 + 学习 + AI舰队 + 全球进化
 * "眼+手"(屏幕+鼠标)留在本地电脑，通过API同步
 *
 * 端口: 7860 (HuggingFace Spaces默认)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 颜色输出
const C = {
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
    reset: '\x1b[0m', bold: '\x1b[1m',
};

console.log(`${C.magenta}╔═══════════════════════════════════════════════════════════════╗${C.reset}`);
console.log(`${C.magenta}║${C.reset}  ${C.bold}活体种子AI - 云端大脑 v1.0${C.reset}                                  ${C.magenta}║${C.reset}`);
console.log(`${C.magenta}║${C.reset}  进化引擎 + AI舰队 + 智能学习 + Claude思维 + 全球进化       ${C.magenta}║${C.reset}`);
console.log(`${C.magenta}║${C.reset}  零成本 · 永续进化 · 云端自主                               ${C.magenta}║${C.reset}`);
console.log(`${C.magenta}╚═══════════════════════════════════════════════════════════════╝${C.reset}\n`);

// ═══════════════════════════════════════════════
//  安全加载模块 (跳过Windows专属依赖)
// ═══════════════════════════════════════════════

function safeRequire(modulePath, name) {
    try {
        return require(modulePath);
    } catch (e) {
        console.log(`${C.yellow}[SKIP]${C.reset} ${name}: ${e.message.split('\n')[0]}`);
        return null;
    }
}

// 核心模块 (跨平台)
const { NeuroBrain, ClaudeThinkingPatterns } = require('./seed-neuro-brain');
const livingCore = safeRequire('./seed-living-core', '活体核心');
const globalEvolution = safeRequire('./seed-global-evolution', '全球进化');
const llmEvolution = safeRequire('./seed-llm-evolution', 'LLM进化');
const autoRepair = safeRequire('./seed-auto-repair', '自动修复');
const autoLearner = safeRequire('./seed-auto-learner', '自动学习');
const astEngine = safeRequire('./seed-ast-engine', 'AST引擎');
const browserAgent = safeRequire('./seed-browser-agent', '浏览器Agent');
const smartSearch = safeRequire('./seed-smart-search', '智能搜索');

// ═══════════════════════════════════════════════
//  云端AI舰队 (不需要本地Ollama)
// ═══════════════════════════════════════════════

class CloudAIFleet {
    constructor() {
        this.providers = new Map();
        this._keys = {};
        this._loadKeys();
        this._initProviders();
        this._stats = { calls: 0, success: 0, errors: 0 };
    }

    _loadKeys() {
        // 从环境变量加载
        const envMap = {
            DEEPSEEK_API_KEY: 'deepseek',
            DASHSCOPE_API_KEY: 'dashscope',
            GROQ_API_KEY: 'groq',
            GEMINI_API_KEY: 'gemini',
            OPENROUTER_API_KEY: 'openrouter',
            TOGETHER_API_KEY: 'together',
            HF_TOKEN: 'huggingface',
            CEREBRAS_API_KEY: 'cerebras',
            COHERE_API_KEY: 'cohere',
            GITHUB_TOKEN: 'github-models',
            MISTRAL_API_KEY: 'mistral',
        };
        for (const [env, provider] of Object.entries(envMap)) {
            if (process.env[env]) this._keys[provider] = process.env[env];
        }

        // 从文件加载
        for (const keyFile of ['ai-keys.json', 'credentials.json']) {
            const p = path.join(__dirname, keyFile);
            if (fs.existsSync(p)) {
                try {
                    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                    if (data.deepseek_api_key) this._keys.deepseek = data.deepseek_api_key;
                    if (data.dashscope_api_key) this._keys.dashscope = data.dashscope_api_key;
                    if (data.groq_api_key) this._keys.groq = data.groq_api_key;
                    if (data.gemini_api_key) this._keys.gemini = data.gemini_api_key;
                } catch (e) {}
            }
        }

        const keyCount = Object.keys(this._keys).length;
        console.log(`${C.green}[CloudAI]${C.reset} 加载${keyCount}个API Key`);
    }

    _initProviders() {
        // Tier 0: 免费无需Key
        this.providers.set('pollinations', {
            name: 'Pollinations', type: 'free', priority: 1,
            ask: (p) => this._askPollinations(p, 'openai'),
        });
        this.providers.set('pollinations-mistral', {
            name: 'Pollinations-Mistral', type: 'free', priority: 1,
            ask: (p) => this._askPollinations(p, 'mistral'),
        });

        // Tier 1: 免费需Key
        if (this._keys.groq) this.providers.set('groq', { name: 'Groq', ask: (p) => this._askGroq(p) });
        if (this._keys.gemini) this.providers.set('gemini', { name: 'Gemini', ask: (p) => this._askGemini(p) });
        if (this._keys.cerebras) this.providers.set('cerebras', { name: 'Cerebras', ask: (p) => this._askCerebras(p) });
        if (this._keys.together) this.providers.set('together', { name: 'Together', ask: (p) => this._askTogether(p) });
        if (this._keys.cohere) this.providers.set('cohere', { name: 'Cohere', ask: (p) => this._askCohere(p) });
        if (this._keys['github-models']) this.providers.set('github-models', { name: 'GitHub Models', ask: (p) => this._askGitHubModels(p) });
        if (this._keys.mistral) this.providers.set('mistral', { name: 'Mistral', ask: (p) => this._askMistral(p) });
        if (this._keys.huggingface) this.providers.set('huggingface', { name: 'HuggingFace', ask: (p) => this._askHuggingFace(p) });

        // Tier 2: 付费
        if (this._keys.deepseek) this.providers.set('deepseek', { name: 'DeepSeek', ask: (p) => this._askDeepSeek(p) });
        if (this._keys.dashscope) this.providers.set('dashscope', { name: '通义千问', ask: (p) => this._askDashScope(p) });

        console.log(`${C.green}[CloudAI]${C.reset} ${this.providers.size}个AI提供商就绪`);
    }

    async ask(prompt, systemPrompt = '') {
        this._stats.calls++;
        const providers = [...this.providers.entries()];

        for (const [name, provider] of providers) {
            try {
                const result = await provider.ask(prompt);
                if (result && result.trim()) {
                    this._stats.success++;
                    return result;
                }
            } catch (e) {
                console.log(`${C.yellow}[CloudAI]${C.reset} ${name}失败: ${e.message.substring(0, 60)}`);
            }
        }
        this._stats.errors++;
        return null;
    }

    // Pollinations (免费, 无需Key)
    async _askPollinations(prompt, model = 'openai') {
        const https = require('https');
        const data = JSON.stringify({
            model, messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
        });
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'text.pollinations.ai',
                path: '/openai',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
                timeout: 30000,
            }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try {
                        const j = JSON.parse(body);
                        resolve(j.choices?.[0]?.message?.content || '');
                    } catch { resolve(body); }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.write(data);
            req.end();
        });
    }

    // DeepSeek
    async _askDeepSeek(prompt) {
        return this._askOpenAICompat('https://api.deepseek.com/v1/chat/completions', this._keys.deepseek, 'deepseek-chat', prompt);
    }

    // DashScope (通义千问)
    async _askDashScope(prompt) {
        return this._askOpenAICompat('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', this._keys.dashscope, 'qwen-turbo', prompt);
    }

    // Groq
    async _askGroq(prompt) {
        return this._askOpenAICompat('https://api.groq.com/openai/v1/chat/completions', this._keys.groq, 'llama-3.3-70b-versatile', prompt);
    }

    // Gemini
    async _askGemini(prompt) {
        const https = require('https');
        const data = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'generativelanguage.googleapis.com',
                path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${this._keys.gemini}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
                timeout: 30000,
            }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try {
                        const j = JSON.parse(body);
                        resolve(j.candidates?.[0]?.content?.parts?.[0]?.text || '');
                    } catch { resolve(''); }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    // Cerebras
    async _askCerebras(prompt) {
        return this._askOpenAICompat('https://api.cerebras.ai/v1/chat/completions', this._keys.cerebras, 'llama3.1-8b', prompt);
    }

    // Together
    async _askTogether(prompt) {
        return this._askOpenAICompat('https://api.together.xyz/v1/chat/completions', this._keys.together, 'meta-llama/Llama-3-8b-chat-hf', prompt);
    }

    // Cohere
    async _askCohere(prompt) {
        const https = require('https');
        const data = JSON.stringify({ model: 'command-r', message: prompt });
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.cohere.ai',
                path: '/v1/chat',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this._keys.cohere}`,
                    'Content-Length': Buffer.byteLength(data),
                },
                timeout: 30000,
            }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(body).text || ''); } catch { resolve(''); }
                });
            });
            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    // GitHub Models
    async _askGitHubModels(prompt) {
        return this._askOpenAICompat('https://models.inference.ai.azure.com/chat/completions', this._keys['github-models'], 'gpt-4o-mini', prompt);
    }

    // Mistral
    async _askMistral(prompt) {
        return this._askOpenAICompat('https://api.mistral.ai/v1/chat/completions', this._keys.mistral, 'mistral-small-latest', prompt);
    }

    // HuggingFace
    async _askHuggingFace(prompt) {
        return this._askOpenAICompat('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions', this._keys.huggingface, null, prompt);
    }

    // 通用OpenAI兼容接口
    async _askOpenAICompat(url, apiKey, model, prompt) {
        const https = require('https');
        const parsed = new URL(url);
        const data = JSON.stringify({
            ...(model ? { model } : {}),
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
        });
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: parsed.hostname,
                path: parsed.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Length': Buffer.byteLength(data),
                },
                timeout: 30000,
            }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try {
                        const j = JSON.parse(body);
                        resolve(j.choices?.[0]?.message?.content || '');
                    } catch { resolve(''); }
                });
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.write(data);
            req.end();
        });
    }

    getStatus() {
        return {
            providers: this.providers.size,
            stats: this._stats,
            available: [...this.providers.keys()],
        };
    }
}

// ═══════════════════════════════════════════════
//  云端进化循环
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
//  多云数据同步器 (跨平台数据互通+到期迁移)
// ═══════════════════════════════════════════════

class MultiCloudSync {
    constructor() {
        // 已知的种子实例(本机+其他云平台)
        this.peers = new Map();
        this._syncInterval = 300000; // 5分钟同步一次
        this._lastSync = 0;

        // 从环境变量加载peer配置
        // SEED_PEERS=http://host1:7860,http://host2:7860,http://local:19860
        const peersEnv = process.env.SEED_PEERS || '';
        if (peersEnv) {
            for (const url of peersEnv.split(',').filter(Boolean)) {
                this.addPeer(url.trim());
            }
        }

        // 本机默认peer (如果设置了)
        if (process.env.SEED_LOCAL_URL) {
            this.addPeer(process.env.SEED_LOCAL_URL, 'local-machine');
        }

        this._instanceId = process.env.SEED_INSTANCE_ID || `cloud-${Date.now().toString(36)}`;
        this._platformExpiry = process.env.SEED_PLATFORM_EXPIRY || null; // ISO date string
    }

    addPeer(url, label = '') {
        const id = label || new URL(url).hostname;
        this.peers.set(id, {
            url: url.replace(/\/$/, ''),
            label: label || id,
            lastSeen: 0,
            alive: false,
            knowledgeCount: 0,
        });
        console.log(`${C.cyan}[Sync]${C.reset} 添加peer: ${label || id} → ${url}`);
    }

    // 与所有peer同步知识
    async syncKnowledge(localKnowledge) {
        if (this.peers.size === 0) return { synced: 0, newKnowledge: [] };

        const newKnowledge = [];
        let synced = 0;

        for (const [id, peer] of this.peers) {
            try {
                // 1. 检查peer是否在线
                const healthData = await this._httpGet(`${peer.url}/health`, 5000);
                if (!healthData) { peer.alive = false; continue; }

                peer.alive = true;
                peer.lastSeen = Date.now();

                // 2. 获取peer的知识
                const remoteData = await this._httpGet(`${peer.url}/knowledge`, 10000);
                if (remoteData?.recent) {
                    for (const rk of remoteData.recent) {
                        // 去重: 检查本地是否已有
                        const exists = localKnowledge.some(lk =>
                            (lk.topic || lk.question) === (rk.topic || rk.question)
                        );
                        if (!exists && rk.topic) {
                            newKnowledge.push({ ...rk, source: `sync:${id}`, syncedAt: new Date().toISOString() });
                        }
                    }
                    peer.knowledgeCount = remoteData.total || 0;
                }

                // 3. 推送本地新知识给peer
                const localRecent = localKnowledge.slice(-20);
                await this._httpPost(`${peer.url}/sync/knowledge`, {
                    from: this._instanceId,
                    knowledge: localRecent,
                });

                synced++;
                console.log(`${C.cyan}[Sync]${C.reset} ${id}: +${newKnowledge.length}条新知识, peer有${peer.knowledgeCount}条`);
            } catch (e) {
                peer.alive = false;
            }
        }

        this._lastSync = Date.now();
        return { synced, newKnowledge };
    }

    // 检查当前平台是否即将到期
    checkExpiry() {
        if (!this._platformExpiry) return { expiring: false };

        const expiryDate = new Date(this._platformExpiry);
        const daysLeft = (expiryDate - Date.now()) / (86400000);

        return {
            expiring: daysLeft < 3, // 3天内到期
            daysLeft: Math.max(0, Math.round(daysLeft * 10) / 10),
            expiryDate: this._platformExpiry,
            needsMigration: daysLeft < 1, // 1天内必须迁移
        };
    }

    // 获取迁移目标
    getMigrationTargets() {
        const alive = [];
        for (const [id, peer] of this.peers) {
            if (peer.alive) alive.push({ id, url: peer.url, lastSeen: peer.lastSeen });
        }
        return alive;
    }

    getPeerStatus() {
        const status = {};
        for (const [id, peer] of this.peers) {
            status[id] = { alive: peer.alive, lastSeen: peer.lastSeen, knowledge: peer.knowledgeCount };
        }
        return { instanceId: this._instanceId, peers: status, totalPeers: this.peers.size };
    }

    async _httpGet(url, timeout = 5000) {
        return new Promise((resolve) => {
            const mod = url.startsWith('https') ? require('https') : require('http');
            const parsed = new URL(url);
            const req = mod.get({
                hostname: parsed.hostname, port: parsed.port, path: parsed.pathname,
                timeout,
            }, (res) => {
                let body = '';
                res.on('data', c => body += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(body)); } catch { resolve(null); }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
        });
    }

    async _httpPost(url, data) {
        return new Promise((resolve) => {
            const mod = url.startsWith('https') ? require('https') : require('http');
            const parsed = new URL(url);
            const body = JSON.stringify(data);
            const req = mod.request({
                hostname: parsed.hostname, port: parsed.port, path: parsed.pathname,
                method: 'POST', timeout: 10000,
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
            }, (res) => {
                let result = '';
                res.on('data', c => result += c);
                res.on('end', () => { try { resolve(JSON.parse(result)); } catch { resolve(null); } });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            req.write(body);
            req.end();
        });
    }
}

class CloudEvolutionEngine {
    constructor() {
        this.aiFleet = new CloudAIFleet();
        this.brain = new NeuroBrain();
        this.claude = new ClaudeThinkingPatterns();
        this.sync = new MultiCloudSync();  // ★ 多云同步
        this._cycle = 0;
        this._running = false;
        this._startTime = Date.now();
        this._modules = {};
        this._knowledgeBase = [];
        this._evolutionLog = [];
    }

    async start() {
        console.log(`\n${C.green}[Cloud]${C.reset} 初始化云端大脑...`);
        await this.brain.init();
        this.brain.prefrontalCortex.setGoal('云端自主进化: 学习+进化+扩展');

        // 加载知识库
        this._loadKnowledge();

        // 初始化各进化模块
        this._initModules();

        this._running = true;

        // 启动API服务器
        this._startAPI();

        // 进化循环
        console.log(`${C.green}[Cloud]${C.reset} 启动进化循环...\n`);
        this._evolutionLoop();
    }

    _loadKnowledge() {
        const files = ['open-knowledge-base.json', 'learned-knowledge.json', 'learned-from-network.json'];
        for (const f of files) {
            const p = path.join(__dirname, f);
            if (fs.existsSync(p)) {
                try {
                    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                    const items = Array.isArray(data) ? data : (data.knowledge || []);
                    this._knowledgeBase.push(...items);
                } catch (e) {}
            }
        }
        console.log(`${C.green}[Cloud]${C.reset} 知识库: ${this._knowledgeBase.length}条`);
    }

    _initModules() {
        // 全球进化引擎
        if (globalEvolution?.GlobalEvolutionEngine) {
            try {
                this._modules.globalEvolution = new globalEvolution.GlobalEvolutionEngine({
                    ask: (p) => this.aiFleet.ask(p),
                });
                console.log(`${C.green}[Cloud]${C.reset} 全球进化引擎 ✓`);
            } catch (e) {
                console.log(`${C.yellow}[Cloud]${C.reset} 全球进化: ${e.message.substring(0, 60)}`);
            }
        }

        // LLM进化
        if (llmEvolution) {
            this._modules.llmEvolution = llmEvolution;
            console.log(`${C.green}[Cloud]${C.reset} LLM进化引擎 ✓`);
        }

        // 自动修复
        if (autoRepair) {
            this._modules.autoRepair = autoRepair;
            console.log(`${C.green}[Cloud]${C.reset} 自动修复引擎 ✓`);
        }

        // AST引擎
        if (astEngine) {
            this._modules.astEngine = astEngine;
            console.log(`${C.green}[Cloud]${C.reset} AST分析引擎 ✓`);
        }
    }

    async _evolutionLoop() {
        while (this._running) {
            this._cycle++;
            const cycleStart = Date.now();

            try {
                // 1. 智能学习 (每轮)
                await this._learnCycle();

                // 2. 代码自进化 (每5轮)
                if (this._cycle % 5 === 0) {
                    await this._evolveCycle();
                }

                // 3. 全球进化 (每10轮)
                if (this._cycle % 10 === 0 && this._modules.globalEvolution) {
                    await this._globalEvolveCycle();
                }

                // 4. 大脑思考
                await this._thinkCycle();

                // 5. 自动修复 (每15轮)
                if (this._cycle % 15 === 0 && this._modules.autoRepair) {
                    await this._repairCycle();
                }

                // 6. ★ 多云同步 (每3轮)
                if (this._cycle % 3 === 0 && this.sync.peers.size > 0) {
                    await this._syncCycle();
                }

                // 7. ★ 到期检查 (每20轮)
                if (this._cycle % 20 === 0) {
                    this._checkMigration();
                }

            } catch (e) {
                console.log(`${C.red}[Cloud]${C.reset} 进化周期${this._cycle}错误: ${e.message}`);
            }

            // 状态报告 (每10轮)
            if (this._cycle % 10 === 0) this._reportStatus();

            // 间隔2分钟
            const elapsed = Date.now() - cycleStart;
            const waitMs = Math.max(1000, 120000 - elapsed);
            await new Promise(r => setTimeout(r, waitMs));
        }
    }

    async _learnCycle() {
        // 从免费AI获取知识
        const topics = [
            'JavaScript高级设计模式', 'Node.js性能优化', 'AI Agent架构',
            '分布式系统设计', '机器学习算法', '网络安全最佳实践',
            '代码自动生成技术', '自监督学习', 'LLM提示工程',
            '强化学习应用', '知识图谱构建', '自动化测试策略',
        ];
        const topic = topics[this._cycle % topics.length];

        const answer = await this.aiFleet.ask(
            `请用JSON格式简洁解释: ${topic}。格式: {"topic":"","summary":"","keyPoints":["","",""],"code":""}`
        );

        if (answer) {
            try {
                const parsed = JSON.parse(answer.match(/\{[\s\S]*\}/)?.[0] || '{}');
                if (parsed.summary) {
                    // 去重检查
                    const exists = this._knowledgeBase.some(k =>
                        (k.topic || k.question) === (parsed.topic || topic)
                    );
                    if (!exists) {
                        const entry = {
                            topic: parsed.topic || topic,
                            summary: parsed.summary,
                            keyPoints: parsed.keyPoints || [],
                            source: 'cloud_learning',
                            learnedAt: new Date().toISOString(),
                        };
                        this._knowledgeBase.push(entry);
                        console.log(`${C.cyan}[Learn]${C.reset} +1 "${(parsed.topic || topic).substring(0, 40)}" (总${this._knowledgeBase.length})`);

                        // 保存到文件
                        this._saveKnowledge();
                    }
                }
            } catch (e) { /* JSON parse failed, skip */ }
        }
    }

    async _evolveCycle() {
        console.log(`${C.blue}[Evolve]${C.reset} 代码自进化分析...`);
        // Claude思维: 代码质量分析
        const jsFiles = fs.readdirSync(__dirname)
            .filter(f => f.startsWith('seed-') && f.endsWith('.js'))
            .slice(0, 3);

        for (const file of jsFiles) {
            try {
                const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
                const quality = this.claude.codeQualityAnalysis(code);
                const syntax = this.claude.syntaxCheck(code);

                if (quality.qualityScore < 60 || !syntax.valid) {
                    console.log(`${C.yellow}[Evolve]${C.reset} ${file}: 质量${quality.grade}(${quality.qualityScore}) 语法${syntax.valid ? '✓' : '✗'}`);
                }
            } catch (e) {}
        }
    }

    async _globalEvolveCycle() {
        console.log(`${C.magenta}[Global]${C.reset} 全球进化周期...`);
        try {
            if (this._modules.globalEvolution?.runEvolutionCycle) {
                await this._modules.globalEvolution.runEvolutionCycle();
            }
        } catch (e) {
            console.log(`${C.yellow}[Global]${C.reset} ${e.message.substring(0, 60)}`);
        }
    }

    async _thinkCycle() {
        // 大脑思考当前状态
        const memUsed = process.memoryUsage();
        const heapMB = Math.round(memUsed.heapUsed / 1024 / 1024);
        const uptime = Math.round((Date.now() - this._startTime) / 60000);

        await this.brain.perceive('system_status', {
            type: 'system_status',
            memUsedPct: Math.round(memUsed.heapUsed / memUsed.heapTotal * 100),
            heapMB,
            uptime,
            cycle: this._cycle,
            platform: 'cloud',
            knowledgeCount: this._knowledgeBase.length,
        }, 0.3);
    }

    async _repairCycle() {
        console.log(`${C.green}[Repair]${C.reset} 自动修复扫描...`);
        // 基本健康检查
        const memUsed = process.memoryUsage();
        if (memUsed.heapUsed > 500 * 1024 * 1024) {
            console.log(`${C.yellow}[Repair]${C.reset} 内存${Math.round(memUsed.heapUsed / 1024 / 1024)}MB, 触发GC`);
            if (global.gc) global.gc();
        }
    }

    async _syncCycle() {
        const result = await this.sync.syncKnowledge(this._knowledgeBase);
        if (result.newKnowledge.length > 0) {
            this._knowledgeBase.push(...result.newKnowledge);
            this._saveKnowledge();
            console.log(`${C.cyan}[Sync]${C.reset} 同步获得${result.newKnowledge.length}条新知识 (总${this._knowledgeBase.length})`);
        }
    }

    _checkMigration() {
        const expiry = this.sync.checkExpiry();
        if (expiry.expiring) {
            console.log(`${C.red}[迁移警告]${C.reset} 当前平台将在${expiry.daysLeft}天后到期!`);
            const targets = this.sync.getMigrationTargets();
            if (targets.length > 0) {
                console.log(`${C.yellow}[迁移]${C.reset} 可迁移到: ${targets.map(t => t.id).join(', ')}`);
                if (expiry.needsMigration) {
                    console.log(`${C.red}[迁移]${C.reset} 紧急! 开始向${targets[0].id}推送全量数据...`);
                    // 推送全量知识到存活的peer
                    this.sync._httpPost(`${targets[0].url}/sync/knowledge`, {
                        from: this.sync._instanceId,
                        knowledge: this._knowledgeBase,
                        urgent: true,
                        brainState: this.brain.getStatus(),
                    }).catch(() => {});
                }
            } else {
                console.log(`${C.red}[迁移]${C.reset} 无可用迁移目标! 请手动部署到新平台`);
            }
        }
    }

    _saveKnowledge() {
        try {
            const learnedPath = path.join(__dirname, 'learned-from-network.json');
            const cloudKnowledge = this._knowledgeBase.filter(k => k.source === 'cloud_learning');
            fs.writeFileSync(learnedPath, JSON.stringify(cloudKnowledge.slice(-200), null, 2));
        } catch (e) {}
    }

    _reportStatus() {
        const mem = process.memoryUsage();
        const uptime = Math.round((Date.now() - this._startTime) / 60000);
        const brainStatus = this.brain.getStatus();
        const aiStatus = this.aiFleet.getStatus();

        console.log(`\n${C.cyan}╔═══ 云端种子状态 (周期${this._cycle}) ═══╗${C.reset}`);
        console.log(`${C.cyan}║${C.reset} 运行: ${uptime}分钟 | 内存: ${Math.round(mem.heapUsed / 1024 / 1024)}MB`);
        console.log(`${C.cyan}║${C.reset} AI: ${aiStatus.providers}源 [${aiStatus.available.join(',')}]`);
        console.log(`${C.cyan}║${C.reset} AI调用: ${aiStatus.stats.calls}次 成功${aiStatus.stats.success} 失败${aiStatus.stats.errors}`);
        console.log(`${C.cyan}║${C.reset} 知识: ${this._knowledgeBase.length}条 | 大脑: ${brainStatus.stats.decisions}决策`);
        console.log(`${C.cyan}║${C.reset} Claude思维: 置信${(this.claude.metaCognition.confidence * 100).toFixed(0)}%`);
        const syncStatus = this.sync.getPeerStatus();
        const expiry = this.sync.checkExpiry();
        console.log(`${C.cyan}║${C.reset} 同步: ${syncStatus.totalPeers}个peer | 实例:${syncStatus.instanceId}`);
        if (expiry.expiring) console.log(`${C.cyan}║${C.reset} ${C.red}⚠ 平台${expiry.daysLeft}天后到期!${C.reset}`);
        console.log(`${C.cyan}╚${'═'.repeat(40)}╝${C.reset}\n`);
    }

    // ═══ API服务器 (与本地电脑同步) ═══
    _startAPI() {
        const PORT = process.env.PORT || 7860;
        const server = http.createServer(async (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

            const url = req.url.split('?')[0];

            try {
                // 健康检查
                if (url === '/' || url === '/health') {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        status: 'alive',
                        name: '活体种子AI - 云端大脑',
                        version: '1.0',
                        uptime: Math.round((Date.now() - this._startTime) / 1000),
                        cycle: this._cycle,
                        knowledge: this._knowledgeBase.length,
                        ai: this.aiFleet.getStatus(),
                    }));
                    return;
                }

                // 获取状态
                if (url === '/status') {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        brain: this.brain.getStatus(),
                        ai: this.aiFleet.getStatus(),
                        knowledge: this._knowledgeBase.length,
                        cycle: this._cycle,
                        memory: process.memoryUsage(),
                        claude: this.claude.metaCognition,
                    }));
                    return;
                }

                // AI对话
                if (url === '/ask' && req.method === 'POST') {
                    let body = '';
                    for await (const chunk of req) body += chunk;
                    const { prompt } = JSON.parse(body);
                    const answer = await this.aiFleet.ask(prompt);
                    res.writeHead(200);
                    res.end(JSON.stringify({ answer }));
                    return;
                }

                // 知识库查询
                if (url === '/knowledge') {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        total: this._knowledgeBase.length,
                        recent: this._knowledgeBase.slice(-20),
                    }));
                    return;
                }

                // 同步接口: 本地电脑上传感知
                if (url === '/sync/perceive' && req.method === 'POST') {
                    let body = '';
                    for await (const chunk of req) body += chunk;
                    const { type, data, importance } = JSON.parse(body);
                    await this.brain.perceive(type, data, importance || 0.5);
                    res.writeHead(200);
                    res.end(JSON.stringify({ ok: true, cycle: this._cycle }));
                    return;
                }

                // 同步接口: 接收peer推送的知识
                if (url === '/sync/knowledge' && req.method === 'POST') {
                    let body = '';
                    for await (const chunk of req) body += chunk;
                    const { from, knowledge, urgent } = JSON.parse(body);
                    let added = 0;
                    if (Array.isArray(knowledge)) {
                        for (const k of knowledge) {
                            const exists = this._knowledgeBase.some(lk =>
                                (lk.topic || lk.question) === (k.topic || k.question)
                            );
                            if (!exists && k.topic) {
                                this._knowledgeBase.push({ ...k, source: `peer:${from}`, syncedAt: new Date().toISOString() });
                                added++;
                            }
                        }
                        if (added > 0) this._saveKnowledge();
                    }
                    console.log(`${C.cyan}[Sync]${C.reset} 从${from}接收: +${added}条 ${urgent ? '[紧急迁移]' : ''}`);
                    res.writeHead(200);
                    res.end(JSON.stringify({ ok: true, added, total: this._knowledgeBase.length }));
                    return;
                }

                // 同步接口: 添加peer
                if (url === '/sync/add-peer' && req.method === 'POST') {
                    let body = '';
                    for await (const chunk of req) body += chunk;
                    const { url: peerUrl, label } = JSON.parse(body);
                    this.sync.addPeer(peerUrl, label);
                    res.writeHead(200);
                    res.end(JSON.stringify({ ok: true, peers: this.sync.getPeerStatus() }));
                    return;
                }

                // 同步状态
                if (url === '/sync/status') {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        ...this.sync.getPeerStatus(),
                        expiry: this.sync.checkExpiry(),
                    }));
                    return;
                }

                // 同步接口: 获取大脑决策
                if (url === '/sync/decision') {
                    const decision = this.brain._lastDecision;
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        decision,
                        goal: this.brain.prefrontalCortex.currentGoal,
                        claude: this.claude.metaCognition,
                    }));
                    return;
                }

                // Claude思维分析
                if (url === '/claude/think' && req.method === 'POST') {
                    let body = '';
                    for await (const chunk of req) body += chunk;
                    const { problem, context } = JSON.parse(body);
                    const result = this.claude.think(problem, context || {});
                    res.writeHead(200);
                    res.end(JSON.stringify(result));
                    return;
                }

                // Claude语法检查
                if (url === '/claude/syntax' && req.method === 'POST') {
                    let body = '';
                    for await (const chunk of req) body += chunk;
                    const { code } = JSON.parse(body);
                    const result = this.claude.syntaxCheck(code);
                    res.writeHead(200);
                    res.end(JSON.stringify(result));
                    return;
                }

                // Claude代码质量
                if (url === '/claude/quality' && req.method === 'POST') {
                    let body = '';
                    for await (const chunk of req) body += chunk;
                    const { code } = JSON.parse(body);
                    const result = this.claude.codeQualityAnalysis(code);
                    res.writeHead(200);
                    res.end(JSON.stringify(result));
                    return;
                }

                res.writeHead(404);
                res.end(JSON.stringify({ error: 'not found' }));
            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            }
        });

        server.listen(PORT, '0.0.0.0', () => {
            console.log(`${C.green}[API]${C.reset} 云端API服务器运行在 http://0.0.0.0:${PORT}`);
            console.log(`${C.green}[API]${C.reset} 端点: /health /status /ask /knowledge /sync/perceive /sync/decision /claude/think /claude/syntax /claude/quality`);
        });
    }
}

// ═══════════════════════════════════════════════
//  启动
// ═══════════════════════════════════════════════

const engine = new CloudEvolutionEngine();
engine.start().catch(err => {
    console.error(`${C.red}[FATAL]${C.reset}`, err);
    process.exit(1);
});

// 优雅退出
process.on('SIGINT', () => {
    console.log(`\n${C.yellow}[Cloud]${C.reset} 收到退出信号，保存状态...`);
    engine._running = false;
    engine._saveKnowledge();
    setTimeout(() => process.exit(0), 2000);
});
process.on('SIGTERM', () => {
    engine._running = false;
    engine._saveKnowledge();
    setTimeout(() => process.exit(0), 2000);
});
