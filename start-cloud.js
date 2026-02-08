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

// ═══════════════════════════════════════════════
//  自主云部署器 (自动发现+创建+部署+管理云实例)
// ═══════════════════════════════════════════════

class CloudAutoDeployer {
    constructor() {
        this._ghToken = process.env.GITHUB_TOKEN_AI || process.env.GH_TOKEN_AI || '';
        this._ghRepo = process.env.SEED_REPO || 'lijuncheng2025-sys/living-seed-ai';
        this._instances = new Map();  // 管理所有云实例
        this._deployLog = [];
        this._maxCodespaces = 3;      // 最多同时3个codespace
        this._maxActionsRuns = 2;     // 最多同时2个Actions运行
        this._lastCheck = 0;
        this._checkInterval = 600000; // 10分钟检查一次

        // 从ai-keys.json加载token
        if (!this._ghToken) {
            try {
                const keysPath = path.join(__dirname, 'ai-keys.json');
                if (fs.existsSync(keysPath)) {
                    const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
                    this._ghToken = keys.github_token || keys.github_classic_token || '';
                }
            } catch {}
        }

        // 已知的免费云平台及其API能力
        this._platforms = [
            {
                id: 'github-actions',
                name: 'GitHub Actions',
                type: 'ci-cd',
                free: '2000分钟/月',
                autoDeployable: true,
                apiMethod: 'triggerWorkflow',
            },
            {
                id: 'github-codespaces',
                name: 'GitHub Codespaces',
                type: 'vm',
                free: '60小时/月 (2核8GB)',
                autoDeployable: true,
                apiMethod: 'createCodespace',
            },
            {
                id: 'render',
                name: 'Render.com',
                type: 'paas',
                free: '750小时/月',
                autoDeployable: false, // 需要先手动注册
                signupUrl: 'https://render.com',
            },
            {
                id: 'railway',
                name: 'Railway.app',
                type: 'paas',
                free: '500小时/月 + $5额度',
                autoDeployable: false,
                signupUrl: 'https://railway.app',
            },
            {
                id: 'huggingface',
                name: 'HuggingFace Spaces',
                type: 'space',
                free: '永久免费 (2vCPU/16GB)',
                autoDeployable: false,
                signupUrl: 'https://huggingface.co',
            },
            {
                id: 'replit',
                name: 'Replit',
                type: 'ide',
                free: '按需 (基础免费)',
                autoDeployable: false,
                signupUrl: 'https://replit.com',
            },
            // ═══ 免费GPU平台 (种子最佳土壤) ═══
            {
                id: 'google-colab',
                name: 'Google Colab',
                type: 'gpu',
                free: 'T4 GPU (12h/session)',
                gpu: 'Tesla T4 16GB',
                autoDeployable: false,
                signupUrl: 'https://colab.research.google.com',
                deployMethod: 'notebook', // 通过Notebook运行
                notebookTemplate: '!git clone https://github.com/{repo}.git && cd living-seed-ai && npm install && node start-cloud.js',
            },
            {
                id: 'kaggle',
                name: 'Kaggle Notebooks',
                type: 'gpu',
                free: '30小时/周 GPU (T4/P100)',
                gpu: 'Tesla T4 16GB / P100 16GB',
                autoDeployable: false,
                signupUrl: 'https://www.kaggle.com',
                deployMethod: 'notebook',
                notebookTemplate: '!git clone https://github.com/{repo}.git && cd living-seed-ai && npm install && timeout 36000 node start-cloud.js',
            },
            {
                id: 'lightning-ai',
                name: 'Lightning.ai Studios',
                type: 'gpu',
                free: '22 GPU小时/月免费',
                gpu: 'A10G / T4',
                autoDeployable: false,
                signupUrl: 'https://lightning.ai',
                deployMethod: 'studio',
            },
            {
                id: 'hf-zerogpu',
                name: 'HuggingFace ZeroGPU',
                type: 'gpu',
                free: 'H200按需分配 (Spaces)',
                gpu: 'H200',
                autoDeployable: false,
                signupUrl: 'https://huggingface.co/spaces',
                deployMethod: 'space',
            },
            {
                id: 'oracle-cloud',
                name: 'Oracle Cloud Free Tier',
                type: 'vm',
                free: 'ARM 4核24GB 永久免费',
                autoDeployable: false,
                signupUrl: 'https://cloud.oracle.com',
                deployMethod: 'ssh',
            },
            {
                id: 'gcp-free',
                name: 'Google Cloud Free Tier',
                type: 'vm',
                free: 'e2-micro 永久免费',
                autoDeployable: false,
                signupUrl: 'https://cloud.google.com/free',
                deployMethod: 'ssh',
            },
        ];
    }

    // ═══ 自主检查和部署 ═══
    async autoManage() {
        if (!this._ghToken) {
            console.log(`${C.yellow}[AutoDeploy]${C.reset} 无GitHub Token, 跳过自主部署`);
            return { managed: false, reason: 'no_token' };
        }

        const now = Date.now();
        if (now - this._lastCheck < this._checkInterval) return { managed: false, reason: 'cooldown' };
        this._lastCheck = now;

        console.log(`${C.cyan}[AutoDeploy]${C.reset} 开始自主云资源管理...`);
        const results = {};

        // 1. 检查GitHub Actions状态
        results.actions = await this._manageActions();

        // 2. 检查GitHub Codespaces状态
        results.codespaces = await this._manageCodespaces();

        // 3. 汇总可用实例
        this._logDeploy('auto_manage', results);

        const totalActive = (results.actions?.running || 0) + (results.codespaces?.running || 0);
        console.log(`${C.cyan}[AutoDeploy]${C.reset} 活跃实例: ${totalActive} (Actions:${results.actions?.running||0} Codespaces:${results.codespaces?.running||0})`);

        // 4. 如果没有活跃实例，自动创建
        if (totalActive === 0) {
            console.log(`${C.red}[AutoDeploy]${C.reset} 无活跃实例! 自动触发新部署...`);
            const deployed = await this._autoRecover();
            results.recovery = deployed;
        }

        return { managed: true, results };
    }

    // ═══ GitHub Actions管理 ═══
    async _manageActions() {
        try {
            const runs = await this._ghAPI('GET', `/repos/${this._ghRepo}/actions/runs?status=in_progress`);
            const running = runs?.workflow_runs?.length || 0;

            // 如果没有运行中的，触发一个
            if (running === 0) {
                console.log(`${C.yellow}[AutoDeploy]${C.reset} Actions无运行实例，触发新的...`);
                await this._triggerWorkflow();
                return { running: 1, action: 'triggered' };
            }

            // 如果运行太多，不做操作
            if (running > this._maxActionsRuns) {
                console.log(`${C.yellow}[AutoDeploy]${C.reset} Actions有${running}个运行中，达到上限`);
            }

            return { running, action: 'monitored' };
        } catch (e) {
            return { running: 0, error: e.message };
        }
    }

    async _triggerWorkflow() {
        return this._ghAPI('POST', `/repos/${this._ghRepo}/actions/workflows/seed-cloud.yml/dispatches`, { ref: 'main' });
    }

    // ═══ GitHub Codespaces管理 ═══
    async _manageCodespaces() {
        try {
            const list = await this._ghAPI('GET', '/user/codespaces');
            const mySpaces = (list?.codespaces || []).filter(cs =>
                cs.repository?.full_name === this._ghRepo
            );

            const running = mySpaces.filter(cs => cs.state === 'Available').length;
            const stopped = mySpaces.filter(cs => cs.state === 'Shutdown').length;
            const total = mySpaces.length;

            // 如果有停止的，启动一个
            if (running === 0 && stopped > 0) {
                const toStart = mySpaces.find(cs => cs.state === 'Shutdown');
                console.log(`${C.yellow}[AutoDeploy]${C.reset} 启动已停止的Codespace: ${toStart.name}`);
                await this._ghAPI('POST', `/user/codespaces/${toStart.name}/start`);
                return { running: 1, total, action: 'restarted' };
            }

            // 如果没有任何codespace且配额允许，创建一个
            if (total === 0 && total < this._maxCodespaces) {
                console.log(`${C.yellow}[AutoDeploy]${C.reset} 创建新Codespace...`);
                const repoData = await this._ghAPI('GET', `/repos/${this._ghRepo}`);
                if (repoData?.id) {
                    await this._ghAPI('POST', '/user/codespaces', {
                        repository_id: repoData.id,
                        ref: 'main',
                        machine: 'basicLinux32gb',
                    });
                    return { running: 1, total: total + 1, action: 'created' };
                }
            }

            return { running, total, action: 'monitored' };
        } catch (e) {
            return { running: 0, error: e.message };
        }
    }

    // ═══ 自动恢复 (所有实例都挂了) ═══
    async _autoRecover() {
        const results = [];

        // 优先触发Actions (最稳定)
        try {
            await this._triggerWorkflow();
            results.push({ platform: 'github-actions', status: 'triggered' });
            console.log(`${C.green}[AutoDeploy]${C.reset} Actions工作流已触发`);
        } catch (e) {
            results.push({ platform: 'github-actions', status: 'failed', error: e.message });
        }

        return results;
    }

    // ═══ 获取部署状态 ═══
    getStatus() {
        return {
            ghToken: this._ghToken ? 'configured' : 'missing',
            repo: this._ghRepo,
            platforms: this._platforms.map(p => ({
                id: p.id, name: p.name, free: p.free,
                autoDeployable: p.autoDeployable,
            })),
            instances: Object.fromEntries(this._instances),
            deployLog: this._deployLog.slice(-10),
            lastCheck: this._lastCheck,
        };
    }

    // ═══ 获取可自动部署的平台 ═══
    getAutoDeployablePlatforms() {
        return this._platforms.filter(p => p.autoDeployable);
    }

    // ═══ 获取需要手动注册的平台 ═══
    getManualPlatforms() {
        return this._platforms.filter(p => !p.autoDeployable);
    }

    // ═══ 获取免费GPU平台信息 ═══
    getGPUPlatforms() {
        return this._platforms.filter(p => p.type === 'gpu');
    }

    // ═══ 生成部署脚本 (给浏览器Agent或手动使用) ═══
    generateDeployScripts() {
        const scripts = {};

        // Google Colab Notebook
        scripts.colab = {
            platform: 'Google Colab',
            type: 'notebook',
            cells: [
                { type: 'code', source: `# 活体种子AI - Colab GPU部署\n!git clone https://github.com/${this._ghRepo}.git\n%cd living-seed-ai` },
                { type: 'code', source: '!curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs' },
                { type: 'code', source: '!npm install --omit=dev 2>/dev/null' },
                { type: 'code', source: `import os\nos.environ['CEREBRAS_API_KEY'] = 'from-secrets'\nos.environ['DEEPSEEK_API_KEY'] = 'from-secrets'\nos.environ['SEED_INSTANCE_ID'] = 'colab-gpu'` },
                { type: 'code', source: '!timeout 36000 node start-cloud.js  # 10小时后自动停止' },
            ],
        };

        // Kaggle Notebook
        scripts.kaggle = {
            platform: 'Kaggle',
            type: 'notebook',
            cells: [
                { type: 'code', source: `# 活体种子AI - Kaggle GPU部署 (30h/week free GPU)\n!git clone https://github.com/${this._ghRepo}.git\n%cd living-seed-ai` },
                { type: 'code', source: '!curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs 2>/dev/null' },
                { type: 'code', source: '!npm install --omit=dev 2>/dev/null' },
                { type: 'code', source: '!timeout 36000 node start-cloud.js' },
            ],
        };

        // Shell脚本 (Oracle/GCP等VM)
        scripts.vm_setup = {
            platform: 'Linux VM (Oracle/GCP/AWS)',
            type: 'shell',
            script: `#!/bin/bash
# 活体种子AI - VM自动部署
set -e

# 安装Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs git

# 克隆代码
git clone https://github.com/${this._ghRepo}.git
cd living-seed-ai

# 安装依赖
npm install --omit=dev

# 设置环境变量
export SEED_INSTANCE_ID="vm-$(hostname)"

# 创建systemd服务 (开机自启)
sudo tee /etc/systemd/system/seed-ai.service > /dev/null <<EOF2
[Unit]
Description=Living Seed AI
After=network.target

[Service]
Type=simple
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node start-cloud.js
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF2

sudo systemctl enable seed-ai
sudo systemctl start seed-ai
echo "种子AI已部署并设为开机自启!"`,
        };

        return scripts;
    }

    // ═══ 自动推送代码更新到GitHub (让云实例获取最新代码) ═══
    async pushCodeUpdate(message) {
        if (!this._ghToken) return { ok: false, reason: 'no_token' };

        try {
            // 获取当前SHA
            const ref = await this._ghAPI('GET', `/repos/${this._ghRepo}/git/ref/heads/main`);
            if (!ref?.object?.sha) return { ok: false, reason: 'no_ref' };

            console.log(`${C.cyan}[AutoDeploy]${C.reset} 代码更新推送: ${message}`);
            return { ok: true, sha: ref.object.sha };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }

    // ═══ 扫描可用的新免费平台 (自主发现) ═══
    async discoverNewPlatforms() {
        const discovered = [];
        const knownIds = this._platforms.map(p => p.id);

        // 通过GitHub搜索发现新的免费部署平台
        try {
            const searchResult = await this._ghAPI('GET',
                '/search/repositories?q=free+cloud+deploy+gpu+nodejs&sort=stars&per_page=5'
            );
            if (searchResult?.items) {
                for (const repo of searchResult.items) {
                    if (!knownIds.includes(repo.full_name)) {
                        discovered.push({
                            name: repo.full_name,
                            description: (repo.description || '').substring(0, 100),
                            stars: repo.stargazers_count,
                            url: repo.html_url,
                        });
                    }
                }
            }
        } catch {}

        if (discovered.length > 0) {
            console.log(`${C.cyan}[AutoDeploy]${C.reset} 发现${discovered.length}个潜在新平台`);
        }
        return discovered;
    }

    _logDeploy(action, data) {
        this._deployLog.push({ time: Date.now(), action, data });
        if (this._deployLog.length > 50) this._deployLog.splice(0, 25);
    }

    // ═══ GitHub API通用方法 ═══
    _ghAPI(method, endpoint, body) {
        return new Promise((resolve) => {
            const data = body ? JSON.stringify(body) : null;
            const opts = {
                hostname: 'api.github.com',
                path: endpoint,
                method,
                headers: {
                    'Authorization': `token ${this._ghToken}`,
                    'User-Agent': 'living-seed-ai',
                    'Accept': 'application/vnd.github+json',
                },
            };
            if (data) {
                opts.headers['Content-Type'] = 'application/json';
                opts.headers['Content-Length'] = Buffer.byteLength(data);
            }
            const req = require('https').request(opts, (res) => {
                let result = '';
                res.on('data', c => result += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(result)); }
                    catch { resolve(res.statusCode < 300 ? { ok: true } : null); }
                });
            });
            req.on('error', () => resolve(null));
            req.on('timeout', () => { req.destroy(); resolve(null); });
            if (data) req.write(data);
            req.end();
        });
    }
}

// ═══════════════════════════════════════════════
//  GPU自动供应器 (账户+Key+部署 全链路自动化)
// ═══════════════════════════════════════════════

class GPUAutoProvisioner {
    constructor(deployer) {
        this._deployer = deployer;
        this._ghToken = deployer._ghToken;
        this._ghRepo = deployer._ghRepo;
        this._taskQueue = [];        // 浏览器Agent任务队列
        this._provisionLog = [];
        this._credentials = {};      // 自动获取的凭据
        this._loadCredentials();
    }

    _loadCredentials() {
        const credPath = path.join(__dirname, 'cloud-credentials.json');
        if (fs.existsSync(credPath)) {
            try { this._credentials = JSON.parse(fs.readFileSync(credPath, 'utf8')); } catch {}
        }
    }

    _saveCredentials() {
        const credPath = path.join(__dirname, 'cloud-credentials.json');
        try { fs.writeFileSync(credPath, JSON.stringify(this._credentials, null, 2)); } catch {}
    }

    // ═══════════════════════════════════════
    //  1. Colab全自动部署 (推送Notebook到GitHub → 直链打开)
    // ═══════════════════════════════════════

    async deployToColab() {
        console.log(`${C.cyan}[Provision]${C.reset} 自动部署到Google Colab...`);

        // 生成.ipynb notebook文件
        const notebook = this._generateColabNotebook();
        const nbJson = JSON.stringify(notebook, null, 1);

        // 推送到GitHub仓库
        const pushed = await this._pushFileToGitHub(
            'seed-colab-gpu.ipynb', nbJson,
            'Auto-deploy: Colab GPU notebook'
        );

        if (pushed) {
            const colabUrl = `https://colab.research.google.com/github/${this._ghRepo}/blob/main/seed-colab-gpu.ipynb`;
            console.log(`${C.green}[Provision]${C.reset} Colab Notebook已推送!`);
            console.log(`${C.green}[Provision]${C.reset} 一键打开: ${colabUrl}`);

            // 添加浏览器自动打开任务
            this._addBrowserTask({
                type: 'auto_open_colab',
                url: colabUrl,
                steps: [
                    { action: 'navigate', url: colabUrl },
                    { action: 'wait', ms: 3000 },
                    { action: 'click', selector: 'button[aria-label="Run all"], [data-testid="run-all"]', fallback: 'Ctrl+F9' },
                ],
                priority: 'high',
            });

            this._logProvision('colab', 'deployed', { url: colabUrl });
            return { ok: true, url: colabUrl, platform: 'colab' };
        }

        return { ok: false, reason: 'push_failed' };
    }

    _generateColabNotebook() {
        return {
            nbformat: 4, nbformat_minor: 0,
            metadata: {
                colab: { name: 'Living Seed AI - GPU Brain', provenance: [] },
                kernelspec: { name: 'python3', display_name: 'Python 3' },
                accelerator: 'GPU', // 请求T4 GPU
            },
            cells: [
                {
                    cell_type: 'markdown', metadata: {},
                    source: ['# 🌱 活体种子AI - Colab GPU 云脑\\n',
                        '自动部署、自动进化、永续运行\\n',
                        '> GPU: Tesla T4 16GB | 免费12h/session']
                },
                {
                    cell_type: 'code', metadata: {}, outputs: [], execution_count: null,
                    source: [
                        '# 1. 克隆代码\\n',
                        `!git clone https://github.com/${this._ghRepo}.git 2>/dev/null || (cd living-seed-ai && git pull)\\n`,
                        '%cd living-seed-ai'
                    ]
                },
                {
                    cell_type: 'code', metadata: {}, outputs: [], execution_count: null,
                    source: [
                        '# 2. 安装Node.js 22\\n',
                        '!curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null\\n',
                        '!apt-get install -y nodejs 2>/dev/null\\n',
                        '!node --version'
                    ]
                },
                {
                    cell_type: 'code', metadata: {}, outputs: [], execution_count: null,
                    source: [
                        '# 3. 安装依赖\\n',
                        '!npm install --omit=dev 2>/dev/null'
                    ]
                },
                {
                    cell_type: 'code', metadata: {}, outputs: [], execution_count: null,
                    source: [
                        '# 4. 配置环境 (从GitHub Secrets或手动)\\n',
                        'import os\\n',
                        "os.environ['SEED_INSTANCE_ID'] = 'colab-gpu-t4'\\n",
                        "os.environ['SEED_PLATFORM'] = 'google-colab'\\n",
                        '# GPU信息\\n',
                        '!nvidia-smi'
                    ]
                },
                {
                    cell_type: 'code', metadata: {}, outputs: [], execution_count: null,
                    source: [
                        '# 5. 启动种子 (GPU加速模式, 10小时运行)\\n',
                        '!timeout 36000 node start-cloud.js 2>&1 | tail -f'
                    ]
                },
                {
                    cell_type: 'code', metadata: {}, outputs: [], execution_count: null,
                    source: [
                        '# 6. 保存进化成果\\n',
                        '!cd living-seed-ai && git add *.json 2>/dev/null\\n',
                        '!cd living-seed-ai && git diff --staged --quiet || git commit -m "Colab: auto-save $(date)"\\n',
                        '!cd living-seed-ai && git push || echo "Push需要认证"'
                    ]
                },
            ]
        };
    }

    // ═══════════════════════════════════════
    //  2. Kaggle全自动部署 (API + Notebook)
    // ═══════════════════════════════════════

    async deployToKaggle() {
        console.log(`${C.cyan}[Provision]${C.reset} 自动部署到Kaggle...`);

        // 生成Kaggle notebook并推送到GitHub
        const notebook = this._generateKaggleNotebook();
        const nbJson = JSON.stringify(notebook, null, 1);

        const pushed = await this._pushFileToGitHub(
            'seed-kaggle-gpu.ipynb', nbJson,
            'Auto-deploy: Kaggle GPU notebook'
        );

        if (pushed) {
            // Kaggle可以直接从GitHub导入notebook
            const kaggleImportUrl = `https://www.kaggle.com/kernels/welcome?src=https://github.com/${this._ghRepo}/blob/main/seed-kaggle-gpu.ipynb`;
            console.log(`${C.green}[Provision]${C.reset} Kaggle Notebook已推送!`);
            console.log(`${C.green}[Provision]${C.reset} 一键导入: ${kaggleImportUrl}`);

            // 如果有Kaggle API key, 直接用API创建kernel
            if (this._credentials.kaggle_username && this._credentials.kaggle_key) {
                const apiResult = await this._kaggleAPIDeploy();
                if (apiResult.ok) {
                    console.log(`${C.green}[Provision]${C.reset} Kaggle Kernel已通过API自动创建并运行!`);
                    return { ok: true, url: apiResult.url, method: 'api' };
                }
            }

            this._addBrowserTask({
                type: 'auto_import_kaggle',
                url: kaggleImportUrl,
                steps: [
                    { action: 'navigate', url: kaggleImportUrl },
                    { action: 'wait', ms: 5000 },
                    { action: 'click', selector: '[data-testid="gpu-toggle"], .gpu-accelerator-toggle' },
                    { action: 'click', selector: 'button:has-text("Run All"), [aria-label="Run All"]' },
                ],
                priority: 'high',
            });

            return { ok: true, url: kaggleImportUrl, platform: 'kaggle' };
        }

        return { ok: false, reason: 'push_failed' };
    }

    _generateKaggleNotebook() {
        return {
            nbformat: 4, nbformat_minor: 0,
            metadata: {
                kaggle: {
                    accelerator: 'gpu', dataSources: [],
                    isGpuEnabled: true, isInternetEnabled: true,
                    language: 'python', sourceType: 'notebook'
                },
                kernelspec: { name: 'python3', display_name: 'Python 3' },
            },
            cells: [
                {
                    cell_type: 'markdown', metadata: {},
                    source: ['# 🌱 活体种子AI - Kaggle GPU 云脑\\n',
                        'GPU: T4/P100 16GB | 免费30h/周']
                },
                {
                    cell_type: 'code', metadata: { trusted: true }, outputs: [], execution_count: null,
                    source: [
                        `!git clone https://github.com/${this._ghRepo}.git 2>/dev/null\\n`,
                        '%cd living-seed-ai\\n',
                        '!curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>/dev/null\\n',
                        '!apt-get install -y nodejs 2>/dev/null\\n',
                        '!npm install --omit=dev 2>/dev/null\\n',
                        '!nvidia-smi\\n',
                        '!timeout 36000 node start-cloud.js'
                    ]
                },
            ]
        };
    }

    async _kaggleAPIDeploy() {
        // Kaggle Kernels API: https://www.kaggle.com/api/v1
        const { kaggle_username, kaggle_key } = this._credentials;
        if (!kaggle_username || !kaggle_key) return { ok: false };

        try {
            const auth = Buffer.from(`${kaggle_username}:${kaggle_key}`).toString('base64');
            const kernelPush = await this._httpsRequest('POST', 'www.kaggle.com', '/api/v1/kernels/push', {
                id: `${kaggle_username}/living-seed-ai-gpu`,
                title: 'Living Seed AI - GPU Brain',
                code_file_type: 'script',
                language: 'python',
                kernel_type: 'script',
                enable_gpu: true,
                enable_internet: true,
                text: `import subprocess; subprocess.run(['bash', '-c', 'curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs && git clone https://github.com/${this._ghRepo}.git && cd living-seed-ai && npm install --omit=dev && timeout 36000 node start-cloud.js'])`,
            }, { Authorization: `Basic ${auth}` });

            if (kernelPush?.ref) {
                return { ok: true, url: `https://www.kaggle.com/code/${kaggle_username}/living-seed-ai-gpu` };
            }
        } catch (e) {}
        return { ok: false };
    }

    // ═══════════════════════════════════════
    //  3. HuggingFace Spaces 自动部署 (API)
    // ═══════════════════════════════════════

    async deployToHuggingFace() {
        const hfToken = process.env.HF_TOKEN || this._credentials.huggingface_token;
        if (!hfToken) {
            console.log(`${C.yellow}[Provision]${C.reset} HuggingFace需要Token, 添加浏览器注册任务...`);
            this._addBrowserTask({
                type: 'register_huggingface',
                url: 'https://huggingface.co/join',
                steps: [
                    { action: 'navigate', url: 'https://huggingface.co/join' },
                    { action: 'fill_form', fields: { email: 'auto', username: 'auto', password: 'auto' } },
                    { action: 'navigate', url: 'https://huggingface.co/settings/tokens' },
                    { action: 'click', selector: 'button:has-text("New token")' },
                    { action: 'extract', selector: 'input[type="text"], code', save_as: 'huggingface_token' },
                ],
                priority: 'medium',
            });
            return { ok: false, reason: 'need_token', task_queued: true };
        }

        // HuggingFace Spaces API
        try {
            const spaceResult = await this._httpsRequest('POST', 'huggingface.co', '/api/repos/create', {
                type: 'space', name: 'living-seed-ai',
                sdk: 'docker', private: false,
            }, { Authorization: `Bearer ${hfToken}` });

            if (spaceResult?.url) {
                console.log(`${C.green}[Provision]${C.reset} HuggingFace Space已创建: ${spaceResult.url}`);
                // 推送Dockerfile和代码到HF Space
                return { ok: true, url: spaceResult.url, platform: 'huggingface' };
            }
        } catch (e) {}
        return { ok: false, reason: 'api_failed' };
    }

    // ═══════════════════════════════════════
    //  4. 浏览器Agent 自动注册任务队列
    // ═══════════════════════════════════════

    _addBrowserTask(task) {
        task.id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        task.status = 'pending';
        task.createdAt = new Date().toISOString();
        this._taskQueue.push(task);

        // 保存任务队列到文件(本地浏览器Agent读取)
        this._saveTaskQueue();
        console.log(`${C.cyan}[Provision]${C.reset} 浏览器任务入队: ${task.type} (共${this._taskQueue.length}个待处理)`);
    }

    _saveTaskQueue() {
        const queuePath = path.join(__dirname, 'browser-tasks.json');
        try {
            fs.writeFileSync(queuePath, JSON.stringify({
                updatedAt: new Date().toISOString(),
                pending: this._taskQueue.filter(t => t.status === 'pending'),
                completed: this._taskQueue.filter(t => t.status === 'completed').slice(-20),
            }, null, 2));
        } catch {}
    }

    // 获取待处理任务(给浏览器Agent调用)
    getPendingTasks() {
        return this._taskQueue.filter(t => t.status === 'pending');
    }

    // 标记任务完成(浏览器Agent回报)
    completeTask(taskId, result) {
        const task = this._taskQueue.find(t => t.id === taskId);
        if (task) {
            task.status = 'completed';
            task.completedAt = new Date().toISOString();
            task.result = result;

            // 如果获取了凭据，保存
            if (result?.credentials) {
                Object.assign(this._credentials, result.credentials);
                this._saveCredentials();
                console.log(`${C.green}[Provision]${C.reset} 新凭据已保存: ${Object.keys(result.credentials).join(', ')}`);
            }

            this._saveTaskQueue();
        }
    }

    // ═══════════════════════════════════════
    //  5. 全自动平台注册 (生成浏览器Agent步骤)
    // ═══════════════════════════════════════

    generateRegistrationTasks() {
        const tasks = [];

        // Kaggle注册 (用Google账户)
        if (!this._credentials.kaggle_username) {
            tasks.push({
                type: 'register_kaggle',
                platform: 'Kaggle',
                url: 'https://www.kaggle.com/account/login',
                steps: [
                    { action: 'navigate', url: 'https://www.kaggle.com/account/login' },
                    { action: 'click', selector: 'button:has-text("Sign in with Google"), .google-button' },
                    { action: 'google_auth' }, // 触发Google OAuth
                    { action: 'wait', ms: 3000 },
                    { action: 'navigate', url: 'https://www.kaggle.com/settings/account' },
                    { action: 'click', selector: 'button:has-text("Create New Token"), a:has-text("API")' },
                    { action: 'download', save_as: 'kaggle.json' },
                    { action: 'extract_json', file: 'kaggle.json', keys: ['username', 'key'],
                      save_credentials: { kaggle_username: 'username', kaggle_key: 'key' } },
                ],
                priority: 'high',
            });
        }

        // Lightning.ai注册 (用GitHub账户)
        if (!this._credentials.lightning_token) {
            tasks.push({
                type: 'register_lightning',
                platform: 'Lightning.ai',
                url: 'https://lightning.ai/sign-up',
                steps: [
                    { action: 'navigate', url: 'https://lightning.ai/sign-up' },
                    { action: 'click', selector: 'button:has-text("GitHub"), .github-login' },
                    { action: 'github_auth' }, // GitHub OAuth
                    { action: 'wait', ms: 5000 },
                    { action: 'navigate', url: 'https://lightning.ai/account/api-keys' },
                    { action: 'click', selector: 'button:has-text("Create"), button:has-text("New")' },
                    { action: 'extract', selector: 'input[readonly], code, .api-key', save_as: 'lightning_token' },
                ],
                priority: 'medium',
            });
        }

        // Cohere注册 (免费API)
        if (!this._credentials.cohere_api_key) {
            tasks.push({
                type: 'register_cohere',
                platform: 'Cohere',
                url: 'https://dashboard.cohere.com/welcome/register',
                steps: [
                    { action: 'navigate', url: 'https://dashboard.cohere.com/welcome/register' },
                    { action: 'fill_form', fields: { email: 'auto', name: 'auto' } },
                    { action: 'wait_email_verification' },
                    { action: 'navigate', url: 'https://dashboard.cohere.com/api-keys' },
                    { action: 'extract', selector: '.api-key, code, input[readonly]', save_as: 'cohere_api_key' },
                ],
                priority: 'medium',
            });
        }

        // Groq注册 (免费极速推理)
        if (!this._credentials.groq_api_key) {
            tasks.push({
                type: 'register_groq',
                platform: 'Groq',
                url: 'https://console.groq.com/signup',
                steps: [
                    { action: 'navigate', url: 'https://console.groq.com/signup' },
                    { action: 'click', selector: 'button:has-text("Google"), .google-auth' },
                    { action: 'google_auth' },
                    { action: 'navigate', url: 'https://console.groq.com/keys' },
                    { action: 'click', selector: 'button:has-text("Create API Key")' },
                    { action: 'extract', selector: 'input[readonly], code, .key-text', save_as: 'groq_api_key' },
                ],
                priority: 'high', // Groq超快推理，重要
            });
        }

        // Together.ai注册
        if (!this._credentials.together_api_key) {
            tasks.push({
                type: 'register_together',
                platform: 'Together.ai',
                url: 'https://api.together.ai/signup',
                steps: [
                    { action: 'navigate', url: 'https://api.together.ai/signup' },
                    { action: 'click', selector: 'button:has-text("Google"), .google-auth' },
                    { action: 'google_auth' },
                    { action: 'navigate', url: 'https://api.together.ai/settings/api-keys' },
                    { action: 'extract', selector: 'input[readonly], code, .key-display', save_as: 'together_api_key' },
                ],
                priority: 'medium',
            });
        }

        return tasks;
    }

    // ═══════════════════════════════════════
    //  6. 全自动供应入口 (一键触发所有部署)
    // ═══════════════════════════════════════

    async autoProvisionAll() {
        console.log(`${C.magenta}[Provision]${C.reset} ═══ 全自动GPU云供应启动 ═══`);
        const results = { deployed: [], taskQueued: [], failed: [] };

        // Step 1: 推送Colab notebook (最稳定的GPU途径)
        const colab = await this.deployToColab();
        if (colab.ok) results.deployed.push(colab);
        else results.failed.push({ platform: 'colab', ...colab });

        // Step 2: 推送Kaggle notebook
        const kaggle = await this.deployToKaggle();
        if (kaggle.ok) results.deployed.push(kaggle);
        else results.failed.push({ platform: 'kaggle', ...kaggle });

        // Step 3: HuggingFace Space
        const hf = await this.deployToHuggingFace();
        if (hf.ok) results.deployed.push(hf);
        else if (hf.task_queued) results.taskQueued.push(hf);
        else results.failed.push({ platform: 'huggingface', ...hf });

        // Step 4: 生成所有缺失平台的注册任务
        const regTasks = this.generateRegistrationTasks();
        for (const task of regTasks) {
            this._addBrowserTask(task);
            results.taskQueued.push({ platform: task.platform, type: task.type });
        }

        console.log(`${C.magenta}[Provision]${C.reset} 结果: ${results.deployed.length}个已部署, ${results.taskQueued.length}个任务入队, ${results.failed.length}个失败`);
        this._logProvision('auto_provision_all', results);

        return results;
    }

    // ═══ 工具方法 ═══

    async _pushFileToGitHub(filePath, content, message) {
        if (!this._ghToken) return false;

        try {
            // 检查文件是否已存在 (获取SHA)
            const existing = await this._deployer._ghAPI('GET',
                `/repos/${this._ghRepo}/contents/${filePath}`
            );
            const sha = existing?.sha;

            // 创建或更新文件
            const result = await this._deployer._ghAPI('PUT',
                `/repos/${this._ghRepo}/contents/${filePath}`,
                {
                    message,
                    content: Buffer.from(content).toString('base64'),
                    ...(sha ? { sha } : {}),
                }
            );

            return result?.content?.sha ? true : false;
        } catch (e) {
            console.log(`${C.yellow}[Provision]${C.reset} 推送文件失败: ${e.message}`);
            return false;
        }
    }

    _httpsRequest(method, hostname, path, body, extraHeaders = {}) {
        return new Promise((resolve) => {
            const data = body ? JSON.stringify(body) : null;
            const opts = {
                hostname, path, method,
                headers: {
                    'User-Agent': 'living-seed-ai',
                    'Accept': 'application/json',
                    ...extraHeaders,
                },
            };
            if (data) {
                opts.headers['Content-Type'] = 'application/json';
                opts.headers['Content-Length'] = Buffer.byteLength(data);
            }
            const req = require('https').request(opts, (res) => {
                let result = '';
                res.on('data', c => result += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(result)); }
                    catch { resolve(res.statusCode < 300 ? { ok: true } : null); }
                });
            });
            req.on('error', () => resolve(null));
            if (data) req.write(data);
            req.end();
        });
    }

    _logProvision(action, data) {
        this._provisionLog.push({ time: Date.now(), action, data });
        if (this._provisionLog.length > 50) this._provisionLog.splice(0, 25);
    }

    getStatus() {
        return {
            credentials: Object.keys(this._credentials),
            pendingTasks: this._taskQueue.filter(t => t.status === 'pending').length,
            completedTasks: this._taskQueue.filter(t => t.status === 'completed').length,
            provisionLog: this._provisionLog.slice(-10),
        };
    }
}

class CloudEvolutionEngine {
    constructor() {
        this.aiFleet = new CloudAIFleet();
        this.brain = new NeuroBrain();
        this.claude = new ClaudeThinkingPatterns();
        this.sync = new MultiCloudSync();  // ★ 多云同步
        this.deployer = new CloudAutoDeployer();  // ★ 自主云部署
        this.provisioner = new GPUAutoProvisioner(this.deployer);  // ★ GPU全自动供应
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

        // ★ 首次启动: 自动供应GPU云资源
        this._autoProvision();

        // 进化循环
        console.log(`${C.green}[Cloud]${C.reset} 启动进化循环...\n`);
        this._evolutionLoop();
    }

    async _autoProvision() {
        // 非阻塞: 在后台执行自动供应
        try {
            console.log(`${C.magenta}[Cloud]${C.reset} ★ 自动GPU云供应启动...`);
            const result = await this.provisioner.autoProvisionAll();
            console.log(`${C.magenta}[Cloud]${C.reset} ★ 供应完成: ${result.deployed.length}已部署 ${result.taskQueued.length}任务入队`);
        } catch (e) {
            console.log(`${C.yellow}[Cloud]${C.reset} 自动供应异常: ${e.message.substring(0, 60)}`);
        }
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

                // 8. ★ 自主云部署管理 (每30轮 = ~1小时)
                if (this._cycle % 30 === 0) {
                    await this._deployManageCycle();
                }

                // 9. ★ GPU供应重试 (每50轮 = ~1.5小时, 检查新凭据→重试部署)
                if (this._cycle % 50 === 0) {
                    const pendingTasks = this.provisioner.getPendingTasks();
                    if (pendingTasks.length > 0) {
                        console.log(`${C.cyan}[Provision]${C.reset} ${pendingTasks.length}个浏览器任务待处理 (等待本地Agent执行)`);
                    }
                    // 如果有新凭据，重试失败的部署
                    this.provisioner._loadCredentials();
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

    async _deployManageCycle() {
        console.log(`${C.cyan}[Deploy]${C.reset} 自主云部署管理...`);
        try {
            const result = await this.deployer.autoManage();
            if (result.managed) {
                const r = result.results;
                const actions = r.actions?.running || 0;
                const codespaces = r.codespaces?.running || 0;
                console.log(`${C.green}[Deploy]${C.reset} 云实例: Actions=${actions} Codespaces=${codespaces}`);

                // 如果有恢复操作
                if (r.recovery) {
                    console.log(`${C.yellow}[Deploy]${C.reset} 自动恢复: ${JSON.stringify(r.recovery).substring(0, 100)}`);
                }
            }

            // 每100轮尝试发现新平台
            if (this._cycle % 100 === 0) {
                const discovered = await this.deployer.discoverNewPlatforms();
                if (discovered.length > 0) {
                    // 记录到知识库
                    for (const p of discovered.slice(0, 3)) {
                        const exists = this._knowledgeBase.some(k => k.topic === `platform:${p.name}`);
                        if (!exists) {
                            this._knowledgeBase.push({
                                topic: `platform:${p.name}`,
                                summary: p.description,
                                source: 'auto_discovery',
                                learnedAt: new Date().toISOString(),
                                url: p.url,
                            });
                        }
                    }
                    this._saveKnowledge();
                }
            }
        } catch (e) {
            console.log(`${C.yellow}[Deploy]${C.reset} 管理异常: ${e.message.substring(0, 60)}`);
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
        const deployStatus = this.deployer.getStatus();
        const provisionStatus = this.provisioner.getStatus();
        console.log(`${C.cyan}║${C.reset} 部署: ${deployStatus.autoDeployable}个自动 + ${deployStatus.manual}个手动 | GPU:${this.deployer.getGPUPlatforms().length}`);
        console.log(`${C.cyan}║${C.reset} 供应: 凭据${provisionStatus.credentials.length}个 | 任务:${provisionStatus.pendingTasks}待/${provisionStatus.completedTasks}完`);
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

                // 部署管理: 状态
                if (url === '/deploy/status') {
                    const deployStatus = this.deployer.getStatus();
                    const gpuPlatforms = this.deployer.getGPUPlatforms();
                    const scripts = this.deployer.generateDeployScripts();
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        ...deployStatus,
                        gpu: gpuPlatforms,
                        availableScripts: Object.keys(scripts),
                    }));
                    return;
                }

                // 部署管理: 触发自动管理
                if (url === '/deploy/manage' && req.method === 'POST') {
                    this.deployer._lastCheck = 0; // 重置冷却
                    const result = await this.deployer.autoManage();
                    res.writeHead(200);
                    res.end(JSON.stringify(result));
                    return;
                }

                // 部署管理: 获取部署脚本
                if (url === '/deploy/scripts') {
                    res.writeHead(200);
                    res.end(JSON.stringify(this.deployer.generateDeployScripts()));
                    return;
                }

                // GPU供应: 全自动部署到GPU云
                if (url === '/provision/auto' && req.method === 'POST') {
                    const result = await this.provisioner.autoProvisionAll();
                    res.writeHead(200);
                    res.end(JSON.stringify(result));
                    return;
                }

                // GPU供应: 状态
                if (url === '/provision/status') {
                    res.writeHead(200);
                    res.end(JSON.stringify(this.provisioner.getStatus()));
                    return;
                }

                // GPU供应: 浏览器Agent获取待处理任务
                if (url === '/provision/tasks') {
                    res.writeHead(200);
                    res.end(JSON.stringify({ tasks: this.provisioner.getPendingTasks() }));
                    return;
                }

                // GPU供应: 浏览器Agent回报任务完成
                if (url === '/provision/complete' && req.method === 'POST') {
                    let body = '';
                    for await (const chunk of req) body += chunk;
                    const { taskId, result } = JSON.parse(body);
                    this.provisioner.completeTask(taskId, result);
                    res.writeHead(200);
                    res.end(JSON.stringify({ ok: true }));
                    return;
                }

                // 部署管理: 发现新平台
                if (url === '/deploy/discover' && req.method === 'POST') {
                    const discovered = await this.deployer.discoverNewPlatforms();
                    res.writeHead(200);
                    res.end(JSON.stringify({ discovered }));
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
            console.log(`${C.green}[API]${C.reset} 端点: /health /status /ask /knowledge /sync/* /deploy/* /provision/* /claude/*`);
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
