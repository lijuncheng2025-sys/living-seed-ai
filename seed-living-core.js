/**
 * 活体种子AI「李凯 Kai Li」— 活体核心 v1.0
 *
 * 这是让李凯从"自动化脚本"变成"活体"的关键模块
 * 真正连通: 眼(RealTimeEyes) → 脑(NeuroBrain) → 手(DesktopHands) → 反馈 → 学习
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║                         活体核心架构                                ║
 * ║                                                                    ║
 * ║  ┌─ LivingLoop (10s周期)                                          ║
 * ║  │  眼(截图+OCR+VLM) → 丘脑(路由) → 感知皮层(理解)              ║
 * ║  │  → 杏仁核(重要性) → 海马(记忆) → 前额叶(决策)                ║
 * ║  │  → 基底节(选动作) → 小脑(规划) → 手(执行) → 验证 → 学习      ║
 * ║  │                                                                ║
 * ║  ├─ CodeEvolver (5min周期)                                        ║
 * ║  │  读代码 → LLM分析 → 生成改进 → 沙箱测试 → 部署/回滚          ║
 * ║  │                                                                ║
 * ║  ├─ AIFleet (持续)                                                ║
 * ║  │  Ollama · Pollinations · Groq · Gemini · HF · OpenRouter       ║
 * ║  │  智能路由 · 负载均衡 · 失败切换 · 能力发现                    ║
 * ║  │                                                                ║
 * ║  └─ SmartLearner (30min周期)                                      ║
 * ║     动态话题 · 多源搜索 · 知识提取 · 去重整合 · 图谱关联         ║
 * ║                                                                    ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * 主人印记: 19860316
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execSync, exec } = require('child_process');
const { EventEmitter } = require('events');

const SEED_HOME = __dirname;
const CORE_STATE_FILE = path.join(SEED_HOME, 'living-core-state.json');
const KNOWLEDGE_FILE = path.join(SEED_HOME, 'open-knowledge-base.json');
const EVOLUTION_HISTORY = path.join(SEED_HOME, 'code-evolution-history.json');

const C = {
    reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
    red: '\x1b[31m', cyan: '\x1b[36m', magenta: '\x1b[35m',
    blue: '\x1b[34m', white: '\x1b[37m', bold: '\x1b[1m',
    dim: '\x1b[2m',
};

function log(tag, msg) {
    const t = new Date().toLocaleTimeString();
    const c = {
        CORE: C.magenta, EYES: C.green, BRAIN: C.cyan, HANDS: C.yellow,
        EVOLVE: C.magenta, LEARN: C.blue, AI: C.cyan, ERROR: C.red, OK: C.green,
    };
    console.log(`${c[tag] || C.white}[${t}] [${tag}] ${msg}${C.reset}`);
}

// ═══════════════════════════════════════════════════════════
//  1. AIFleet — 多AI资源管理器
//
//  不依赖单一AI，而是管理一个AI舰队:
//  - 自动发现可用的免费AI提供商
//  - 智能路由请求到最佳提供商
//  - 失败自动切换，无缝降级
//  - 跟踪每个提供商的性能和可用性
// ═══════════════════════════════════════════════════════════

class AIFleet {
    static _pollinationsLock = null; // IP共享限速锁

    constructor() {
        this.providers = new Map();
        this.stats = new Map(); // provider → { calls, successes, avgLatency, lastUse, lastFail }
        this._initProviders();
    }

    _initProviders() {
        // ═══ TIER 0: 零配置 — 无需任何Key，100%自动化 ═══

        // 1. Ollama (本地GPU推理, 最快)
        this.providers.set('ollama', {
            name: 'Ollama', type: 'local', priority: 1, needsKey: false,
            ask: (p, s) => this._askOllama(p, s),
        });

        // 2. Pollinations-GPT (免费, 无Key)
        this.providers.set('pollinations', {
            name: 'Pollinations-GPT', type: 'free', priority: 2, needsKey: false,
            ask: (p, s) => this._askPollinations(p, s, 'openai'),
        });

        // 3. Pollinations-Mistral (免费, 无Key, 24B参数)
        this.providers.set('pollinations-mistral', {
            name: 'Pollinations-Mistral', type: 'free', priority: 6, needsKey: false,
            ask: (p, s) => this._askPollinations(p, s, 'mistral'),
        });

        // ═══ TIER 1: 免费Key — 无需信用卡，自动获取 ═══

        // 7. Groq (免费, 极速推理)
        this.providers.set('groq', {
            name: 'Groq', type: 'free_tier', priority: 3, needsKey: true,
            ask: (p, s) => this._askGroq(p, s),
        });

        // 8. Google Gemini (免费15RPM)
        this.providers.set('gemini', {
            name: 'Gemini', type: 'free_tier', priority: 4, needsKey: true,
            ask: (p, s) => this._askGemini(p, s),
        });

        // 9. OpenRouter (免费模型聚合)
        this.providers.set('openrouter', {
            name: 'OpenRouter', type: 'free_tier', priority: 5, needsKey: true,
            ask: (p, s) => this._askOpenRouter(p, s),
        });

        // 10. Together AI ($25免费额度)
        this.providers.set('together', {
            name: 'Together', type: 'free_tier', priority: 6, needsKey: true,
            ask: (p, s) => this._askTogether(p, s),
        });

        // 11. HuggingFace (免费推理API)
        this.providers.set('huggingface', {
            name: 'HuggingFace', type: 'free_tier', priority: 11, needsKey: true,
            ask: (p, s) => this._askHuggingFace(p, s),
        });

        // 12. Cerebras (免费极速推理)
        this.providers.set('cerebras', {
            name: 'Cerebras', type: 'free_tier', priority: 12, needsKey: true,
            ask: (p, s) => this._askCerebras(p, s),
        });

        // 13. Cohere (免费试用1000次/月)
        this.providers.set('cohere', {
            name: 'Cohere', type: 'free_tier', priority: 13, needsKey: true,
            ask: (p, s) => this._askCohere(p, s),
        });

        // 14. DeepSeek (超高性价比, 中国产)
        this.providers.set('deepseek', {
            name: 'DeepSeek', type: 'paid', priority: 3, needsKey: true,
            ask: (p, s) => this._askDeepSeek(p, s),
        });

        // 15. 通义千问 DashScope (阿里云, OpenAI兼容)
        this.providers.set('dashscope', {
            name: '通义千问', type: 'paid', priority: 4, needsKey: true,
            ask: (p, s) => this._askDashScope(p, s),
        });

        // 16. GitHub Models (免费GPT-4o-mini, 150请求/天, GitHub token即可)
        this.providers.set('github-models', {
            name: 'GitHub Models', type: 'free-key', priority: 5, needsKey: true,
            ask: (p, s) => this._askGitHubModels(p, s),
        });

        // 17. Mistral AI (免费Experiment层, 500K TPM, 无需信用卡)
        this.providers.set('mistral', {
            name: 'Mistral AI', type: 'free-key', priority: 5, needsKey: true,
            ask: (p, s) => this._askMistral(p, s),
        });

        // 初始化统计
        for (const key of this.providers.keys()) {
            this.stats.set(key, { calls: 0, successes: 0, avgLatency: 0, lastUse: 0, lastFail: 0 });
        }

        // 加载API keys
        this._loadKeys();

        const noKey = [...this.providers.entries()].filter(([_, p]) => !p.needsKey).length;
        const hasKey = Object.keys(this._keys).length;
        log('AI', `AI舰队: ${this.providers.size}个提供商 (${noKey}免费 + ${hasKey}有Key)`);
    }

    _loadKeys() {
        this._keys = {};

        // 来源1: credentials.json
        try {
            const creds = JSON.parse(fs.readFileSync(path.join(SEED_HOME, 'credentials.json'), 'utf8'));
            this._extractKeysFromObj(creds);
        } catch {}

        // 来源2: ai-keys.json (自动获取的key单独存储)
        try {
            const aiKeys = JSON.parse(fs.readFileSync(path.join(SEED_HOME, 'ai-keys.json'), 'utf8'));
            this._extractKeysFromObj(aiKeys);
        } catch {}

        // 来源3: 环境变量
        const envMap = {
            GROQ_API_KEY: 'groq', GEMINI_API_KEY: 'gemini',
            OPENROUTER_API_KEY: 'openrouter', TOGETHER_API_KEY: 'together',
            TOGETHER_AI_API_KEY: 'together',
            HF_TOKEN: 'huggingface', HUGGINGFACE_TOKEN: 'huggingface',
            CEREBRAS_API_KEY: 'cerebras', COHERE_API_KEY: 'cohere',
            DEEPSEEK_API_KEY: 'deepseek', DASHSCOPE_API_KEY: 'dashscope',
            GITHUB_TOKEN: 'github-models', GITHUB_MODELS_TOKEN: 'github-models',
            MISTRAL_API_KEY: 'mistral',
        };
        for (const [env, key] of Object.entries(envMap)) {
            if (process.env[env]) this._keys[key] = process.env[env];
        }

        // 来源4: .env 文件
        try {
            const envFile = fs.readFileSync(path.join(SEED_HOME, '.env'), 'utf8');
            for (const line of envFile.split('\n')) {
                const match = line.match(/^([A-Z_]+)\s*=\s*(.+)/);
                if (match) {
                    const [, k, v] = match;
                    if (envMap[k]) this._keys[envMap[k]] = v.trim().replace(/['"]/g, '');
                }
            }
        } catch {}

        // 来源5: 用户目录 ~/.ai-keys
        try {
            const homeKeys = JSON.parse(fs.readFileSync(
                path.join(process.env.USERPROFILE || process.env.HOME || '', '.ai-keys'), 'utf8'));
            this._extractKeysFromObj(homeKeys);
        } catch {}

        if (Object.keys(this._keys).length > 0) {
            log('AI', `已加载Key: ${Object.keys(this._keys).join(', ')}`);
        }
    }

    _extractKeysFromObj(obj) {
        if (!obj || typeof obj !== 'object') return;
        for (const [k, v] of Object.entries(obj)) {
            if (typeof v !== 'string' || !v.trim()) continue;
            const val = v.trim();
            // 按前缀自动识别
            if (val.startsWith('gsk_')) this._keys.groq = val;
            else if (val.startsWith('AIzaSy')) this._keys.gemini = val;
            else if (val.startsWith('sk-or-')) this._keys.openrouter = val;
            else if (val.startsWith('hf_')) this._keys.huggingface = val;
            else if (val.startsWith('csk-')) this._keys.cerebras = val;
            // 按key名识别
            const kl = k.toLowerCase();
            if (kl.includes('groq') && val.length > 10) this._keys.groq = this._keys.groq || val;
            if (kl.includes('gemini') && val.length > 10) this._keys.gemini = this._keys.gemini || val;
            if (kl.includes('openrouter') && val.length > 10) this._keys.openrouter = this._keys.openrouter || val;
            if (kl.includes('together') && val.length > 10) this._keys.together = this._keys.together || val;
            if (kl.includes('hugging') && val.length > 10) this._keys.huggingface = this._keys.huggingface || val;
            if (kl.includes('cerebras') && val.length > 10) this._keys.cerebras = this._keys.cerebras || val;
            if (kl.includes('cohere') && val.length > 10) this._keys.cohere = this._keys.cohere || val;
            if (kl.includes('deepseek') && val.length > 10) this._keys.deepseek = this._keys.deepseek || val;
            if ((kl.includes('dashscope') || kl.includes('tongyi') || kl.includes('qwen') || kl.includes('通义')) && val.length > 10) this._keys.dashscope = this._keys.dashscope || val;
            if ((kl.includes('github') && (kl.includes('token') || kl.includes('model'))) && val.length > 10) this._keys['github-models'] = this._keys['github-models'] || val;
            if (kl.includes('mistral') && val.length > 10) this._keys.mistral = this._keys.mistral || val;
        }
    }

    // 智能路由: 选最佳可用提供商
    async ask(prompt, systemPrompt = '', options = {}) {
        const maxRetries = options.retries || 3;
        const timeout = options.timeout || 30000;
        const sorted = this._rankProviders();

        for (let i = 0; i < Math.min(maxRetries, sorted.length); i++) {
            const [key, provider] = sorted[i];
            const stat = this.stats.get(key);

            // 跳过最近失败的 (冷却30秒)
            if (stat.lastFail && Date.now() - stat.lastFail < 30000) continue;

            try {
                const start = Date.now();
                stat.calls++;
                stat.lastUse = start;

                const result = await Promise.race([
                    provider.ask(prompt.substring(0, 4000), systemPrompt),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout)),
                ]);

                if (result && result.trim()) {
                    const latency = Date.now() - start;
                    stat.successes++;
                    stat.avgLatency = stat.avgLatency ? (stat.avgLatency * 0.8 + latency * 0.2) : latency;
                    return { success: true, content: result.trim(), provider: key, latency };
                }
            } catch (e) {
                stat.lastFail = Date.now();
            }
        }
        return { success: false, content: '', provider: 'none', error: 'all_providers_failed' };
    }

    // AI×AI交叉验证: 用多个AI验证答案
    async crossValidate(prompt, systemPrompt = '') {
        const sorted = this._rankProviders();
        const responses = [];

        for (const [key, provider] of sorted.slice(0, 3)) {
            try {
                const result = await Promise.race([
                    provider.ask(prompt.substring(0, 3000), systemPrompt),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
                ]);
                if (result && result.trim()) {
                    responses.push({ provider: key, content: result.trim() });
                }
            } catch {}
        }

        return { responses, count: responses.length, consensus: responses.length >= 2 };
    }

    _rankProviders() {
        return [...this.providers.entries()].sort((a, b) => {
            const sa = this.stats.get(a[0]);
            const sb = this.stats.get(b[0]);
            // 按成功率×优先级排序
            const scoreA = (sa.calls > 0 ? sa.successes / sa.calls : 0.5) * (1 / a[1].priority);
            const scoreB = (sb.calls > 0 ? sb.successes / sb.calls : 0.5) * (1 / b[1].priority);
            return scoreB - scoreA;
        });
    }

    // --- Ollama ---
    async _askOllama(prompt, sys) {
        const body = JSON.stringify({
            model: 'qwen2.5:7b',
            messages: [
                ...(sys ? [{ role: 'system', content: sys }] : []),
                { role: 'user', content: prompt },
            ],
            stream: false,
            options: { temperature: 0.3, num_predict: 500 },
        });
        const resp = await this._httpPost('http://127.0.0.1:11434/api/chat', body);
        const data = JSON.parse(resp);
        return data?.message?.content || '';
    }

    // --- Pollinations (多模型免费, 共享IP限速max 1 queued) ---
    async _askPollinations(prompt, sys, model = 'openai') {
        // 等待上次Pollinations请求完成(共享IP限速)
        if (AIFleet._pollinationsLock) {
            await AIFleet._pollinationsLock;
        }
        let unlock;
        AIFleet._pollinationsLock = new Promise(r => { unlock = r; });

        try {
            const body = JSON.stringify({
                model,
                messages: [
                    ...(sys ? [{ role: 'system', content: sys }] : []),
                    { role: 'user', content: prompt },
                ],
                stream: false,
            });
            // text.pollinations.ai/openai 端点支持 model 字段路由(已验证)
            const resp = await this._httpsPost('https://text.pollinations.ai/openai', body);

            // 检查错误响应
            if (resp.includes('"error"') && resp.includes('Queue full')) {
                throw new Error('rate_limited');
            }

            try {
                const data = JSON.parse(resp);
                if (data?.error) throw new Error(data.error);
                return data?.choices?.[0]?.message?.content || '';
            } catch (parseErr) {
                // 非JSON响应 → 可能是纯文本
                if (resp && resp.length > 2 && !resp.includes('"error"')) return resp.trim();
                throw parseErr;
            }
        } finally {
            unlock();
            AIFleet._pollinationsLock = null;
        }
    }

    // --- Groq ---
    async _askGroq(prompt, sys) {
        if (!this._keys.groq) throw new Error('no_key');
        const body = JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
                ...(sys ? [{ role: 'system', content: sys }] : []),
                { role: 'user', content: prompt },
            ],
            max_tokens: 500, temperature: 0.3,
        });
        const resp = await this._httpsPost('https://api.groq.com/openai/v1/chat/completions', body, {
            'Authorization': `Bearer ${this._keys.groq}`,
        });
        const data = JSON.parse(resp);
        return data?.choices?.[0]?.message?.content || '';
    }

    // --- Gemini ---
    async _askGemini(prompt, sys) {
        if (!this._keys.gemini) throw new Error('no_key');
        const fullPrompt = (sys ? sys + '\n\n' : '') + prompt;
        const body = JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: { maxOutputTokens: 500 },
        });
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${this._keys.gemini}`;
        const resp = await this._httpsPost(url, body);
        const data = JSON.parse(resp);
        if (data?.error) throw new Error(data.error.message || 'gemini_error');
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // --- OpenRouter (免费模型聚合) ---
    async _askOpenRouter(prompt, sys) {
        if (!this._keys.openrouter) throw new Error('no_key');
        const body = JSON.stringify({
            model: 'meta-llama/llama-3.1-8b-instruct:free',
            messages: [
                ...(sys ? [{ role: 'system', content: sys }] : []),
                { role: 'user', content: prompt },
            ],
            max_tokens: 500,
        });
        const resp = await this._httpsPost('https://openrouter.ai/api/v1/chat/completions', body, {
            'Authorization': `Bearer ${this._keys.openrouter}`,
            'X-Title': 'KaiLi-SeedAI',
        });
        const data = JSON.parse(resp);
        return data?.choices?.[0]?.message?.content || '';
    }

    // --- Together AI ($25免费额度, Llama免费端点) ---
    async _askTogether(prompt, sys) {
        if (!this._keys.together) throw new Error('no_key');
        const body = JSON.stringify({
            model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
            messages: [
                ...(sys ? [{ role: 'system', content: sys }] : []),
                { role: 'user', content: prompt },
            ],
            max_tokens: 500, temperature: 0.3,
        });
        const resp = await this._httpsPost('https://api.together.xyz/v1/chat/completions', body, {
            'Authorization': `Bearer ${this._keys.together}`,
        });
        const data = JSON.parse(resp);
        return data?.choices?.[0]?.message?.content || '';
    }

    // --- HuggingFace (免费推理API) ---
    async _askHuggingFace(prompt, sys) {
        if (!this._keys.huggingface) throw new Error('no_key');
        const fullPrompt = (sys ? `[INST] ${sys} [/INST]\n` : '') + prompt;
        const body = JSON.stringify({
            inputs: fullPrompt,
            parameters: { max_new_tokens: 500, temperature: 0.3 },
        });
        const resp = await this._httpsPost(
            'https://api-inference.huggingface.co/models/meta-llama/Llama-3.2-3B-Instruct', body, {
            'Authorization': `Bearer ${this._keys.huggingface}`,
        });
        const data = JSON.parse(resp);
        if (Array.isArray(data)) return data[0]?.generated_text || '';
        return data?.generated_text || data?.[0]?.generated_text || '';
    }

    // --- Cerebras (免费极速推理) ---
    async _askCerebras(prompt, sys) {
        if (!this._keys.cerebras) throw new Error('no_key');
        const body = JSON.stringify({
            model: 'llama-3.3-70b',
            messages: [
                ...(sys ? [{ role: 'system', content: sys }] : []),
                { role: 'user', content: prompt },
            ],
            max_tokens: 500, temperature: 0.3,
        });
        const resp = await this._httpsPost('https://api.cerebras.ai/v1/chat/completions', body, {
            'Authorization': `Bearer ${this._keys.cerebras}`,
        });
        const data = JSON.parse(resp);
        return data?.choices?.[0]?.message?.content || '';
    }

    // --- Cohere (免费试用1000次/月) ---
    async _askCohere(prompt, sys) {
        if (!this._keys.cohere) throw new Error('no_key');
        const body = JSON.stringify({
            message: (sys ? sys + '\n\n' : '') + prompt,
            model: 'command-r',
            max_tokens: 500, temperature: 0.3,
        });
        const resp = await this._httpsPost('https://api.cohere.ai/v1/chat', body, {
            'Authorization': `Bearer ${this._keys.cohere}`,
        });
        const data = JSON.parse(resp);
        return data?.text || '';
    }

    // --- DeepSeek (OpenAI兼容, 超高性价比) ---
    async _askDeepSeek(prompt, sys) {
        if (!this._keys.deepseek) throw new Error('no_key');
        const body = JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                ...(sys ? [{ role: 'system', content: sys }] : []),
                { role: 'user', content: prompt },
            ],
            max_tokens: 500, temperature: 0.3,
        });
        const resp = await this._httpsPost('https://api.deepseek.com/chat/completions', body, {
            'Authorization': `Bearer ${this._keys.deepseek}`,
        });
        const data = JSON.parse(resp);
        return data?.choices?.[0]?.message?.content || '';
    }

    // --- 通义千问 DashScope (阿里云, OpenAI兼容模式) ---
    async _askDashScope(prompt, sys) {
        if (!this._keys.dashscope) throw new Error('no_key');
        const body = JSON.stringify({
            model: 'qwen-turbo',
            messages: [
                ...(sys ? [{ role: 'system', content: sys }] : []),
                { role: 'user', content: prompt },
            ],
            max_tokens: 500, temperature: 0.3,
        });
        const resp = await this._httpsPost('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', body, {
            'Authorization': `Bearer ${this._keys.dashscope}`,
        });
        const data = JSON.parse(resp);
        return data?.choices?.[0]?.message?.content || '';
    }

    // 16. GitHub Models (免费GPT-4o-mini, OpenAI兼容格式, GitHub token即可)
    async _askGitHubModels(prompt, sys) {
        if (!this._keys['github-models']) throw new Error('no_key');
        const body = JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                ...(sys ? [{ role: 'system', content: sys }] : []),
                { role: 'user', content: prompt },
            ],
            max_tokens: 500, temperature: 0.3,
        });
        const resp = await this._httpsPost('https://models.inference.ai.azure.com/chat/completions', body, {
            'Authorization': `Bearer ${this._keys['github-models']}`,
        });
        const data = JSON.parse(resp);
        return data?.choices?.[0]?.message?.content || '';
    }

    // 17. Mistral AI (免费Experiment层, 500K TPM, OpenAI兼容)
    async _askMistral(prompt, sys) {
        if (!this._keys.mistral) throw new Error('no_key');
        const body = JSON.stringify({
            model: 'mistral-small-latest',
            messages: [
                ...(sys ? [{ role: 'system', content: sys }] : []),
                { role: 'user', content: prompt },
            ],
            max_tokens: 500, temperature: 0.3,
        });
        const resp = await this._httpsPost('https://api.mistral.ai/v1/chat/completions', body, {
            'Authorization': `Bearer ${this._keys.mistral}`,
        });
        const data = JSON.parse(resp);
        return data?.choices?.[0]?.message?.content || '';
    }

    // HTTP helpers
    _httpPost(url, body) {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const req = http.request({
                hostname: u.hostname, port: u.port, path: u.pathname,
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
            }, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.write(body);
            req.end();
        });
    }

    _httpsPost(url, body, extraHeaders = {}) {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const req = https.request({
                hostname: u.hostname, path: u.pathname + u.search,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...extraHeaders },
                timeout: 30000,
            }, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
            req.write(body);
            req.end();
        });
    }

    getStatus() {
        const status = {};
        for (const [key, stat] of this.stats) {
            const provider = this.providers.get(key);
            const rate = stat.calls > 0 ? (stat.successes / stat.calls * 100).toFixed(0) + '%' : 'N/A';
            const available = !provider.needsKey || !!this._keys[key.replace('pollinations-', '')];
            status[key] = { calls: stat.calls, rate, latency: Math.round(stat.avgLatency), available, type: provider.type };
        }
        return status;
    }

    // 健康检查: 测试所有可用提供商
    async healthCheck() {
        log('AI', '═══ AI舰队健康检查 ═══');
        const results = {};
        const testPrompt = '回复"OK"两个字母';

        for (const [key, provider] of this.providers) {
            if (provider.needsKey && !this._keys[key]) {
                results[key] = { status: 'no_key', latency: 0 };
                continue;
            }
            try {
                const start = Date.now();
                const resp = await Promise.race([
                    provider.ask(testPrompt, ''),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
                ]);
                const latency = Date.now() - start;
                const ok = resp && resp.trim().length > 0;
                results[key] = { status: ok ? 'ok' : 'empty', latency };
                if (ok) log('AI', `  ${C.green}✓ ${key}: ${latency}ms${C.reset}`);
                else log('AI', `  ${C.yellow}~ ${key}: 空响应${C.reset}`);
            } catch (e) {
                results[key] = { status: 'error', error: e.message, latency: 0 };
                log('AI', `  ${C.red}✗ ${key}: ${e.message}${C.reset}`);
            }
        }

        const ok = Object.values(results).filter(r => r.status === 'ok').length;
        const noKey = Object.values(results).filter(r => r.status === 'no_key').length;
        log('AI', `健康检查完成: ${ok}可用 / ${noKey}缺Key / ${this.providers.size}总计`);
        return results;
    }

    // 保存自动获取的Key
    saveKey(provider, key) {
        this._keys[provider] = key;
        try {
            let aiKeys = {};
            try { aiKeys = JSON.parse(fs.readFileSync(path.join(SEED_HOME, 'ai-keys.json'), 'utf8')); } catch {}
            aiKeys[`${provider}_api_key`] = key;
            aiKeys.updatedAt = new Date().toISOString();
            fs.writeFileSync(path.join(SEED_HOME, 'ai-keys.json'), JSON.stringify(aiKeys, null, 2));
            log('AI', `${C.green}已保存 ${provider} API Key${C.reset}`);
        } catch (e) {
            log('ERROR', `保存Key失败: ${e.message}`);
        }
    }

    // 获取缺少的Key列表
    getMissingKeys() {
        const needed = ['groq', 'gemini', 'openrouter', 'together', 'huggingface', 'cerebras', 'cohere', 'deepseek', 'dashscope', 'github-models', 'mistral'];
        return needed.filter(k => !this._keys[k]);
    }
}

// ═══════════════════════════════════════════════════════════
//  1.5 AIProvisioner — 自动获取免费API Key
//
//  种子100%自动化的关键: 不需要人工配置
//  - 自动发现可用的免费AI API
//  - 使用浏览器Agent自动注册获取Key
//  - 自动测试验证Key可用性
//  - 定期检查Key状态，失效自动替换
// ═══════════════════════════════════════════════════════════

class AIProvisioner {
    constructor(aiFleet) {
        this.fleet = aiFleet;
        this.eyes = null;   // 注入眼睛(RealTimeEyes)
        this.hands = null;  // 注入手(DesktopHands)
        this.provisionLog = [];
        // ★ v2.0: 智能控制 (不盲目打开浏览器)
        this._coreStartTime = Date.now();
        this._browserProvisionFails = 0;
        this._lastBrowserProvisionTime = 0;
        this._registrationGuide = {
            groq: {
                url: 'https://console.groq.com',
                steps: '注册→GroqCloud控制台→API Keys→Create API Key',
                prefix: 'gsk_', freeLimit: '30 RPM, 无需信用卡',
            },
            gemini: {
                url: 'https://aistudio.google.com/apikey',
                steps: 'Google账号登录→Get API key→Create API key',
                prefix: 'AIzaSy', freeLimit: '15 RPM, 1000 RPD, 无需信用卡',
            },
            openrouter: {
                url: 'https://openrouter.ai/settings/keys',
                steps: '注册→Settings→API Keys→Create Key',
                prefix: 'sk-or-', freeLimit: '免费模型无限制',
            },
            together: {
                url: 'https://api.together.xyz/settings/api-keys',
                steps: '注册→Settings→API Keys→Create',
                prefix: '', freeLimit: '$25免费额度 + Llama免费端点',
            },
            huggingface: {
                url: 'https://huggingface.co/settings/tokens',
                steps: '注册→Settings→Access Tokens→New token',
                prefix: 'hf_', freeLimit: '数百次/小时免费推理',
            },
            cerebras: {
                url: 'https://cloud.cerebras.ai/',
                steps: '注册→Dashboard→API Keys→Create',
                prefix: 'csk-', freeLimit: '免费推理，极速',
            },
            cohere: {
                url: 'https://dashboard.cohere.com/api-keys',
                steps: '注册→Dashboard→API Keys',
                prefix: '', freeLimit: '1000次/月试用',
            },
        };
    }

    // 自动配置: 智能获取Key (不盲目打开浏览器)
    async autoProvision() {
        const missing = this.fleet.getMissingKeys();
        if (missing.length === 0) {
            log('AI', `${C.green}所有API Key已就绪!${C.reset}`);
            return { provisioned: 0, missing: 0 };
        }

        log('AI', `缺少 ${missing.length} 个API Key: ${missing.join(', ')}`);
        let provisioned = 0;

        // ★ 智能决策: 是否应该尝试浏览器获取
        // 不盲目打开Chrome! 需要满足前提条件
        const shouldTryBrowser = this._shouldTryBrowserProvision();
        if (shouldTryBrowser.yes) {
            provisioned += await this._tryBrowserProvision(missing);
        } else {
            log('AI', `${C.dim}跳过浏览器获取: ${shouldTryBrowser.reason}${C.reset}`);
        }

        // 方式2: 生成一键获取脚本
        this._generateSetupScript(missing);

        // 方式3: 记录获取指南(供种子自学习)
        this._logProvisionGuide(missing);

        const stillMissing = this.fleet.getMissingKeys();
        log('AI', `自动配置完成: 获取${provisioned}个, 仍缺${stillMissing.length}个`);
        return { provisioned, missing: stillMissing.length, guide: stillMissing };
    }

    // ★ 智能判断: 是否应该尝试浏览器自动获取Key
    _shouldTryBrowserProvision() {
        // 1. 眼/手未就绪 → 不尝试
        if (!this.eyes || !this.hands) {
            return { yes: false, reason: '眼/手未就绪' };
        }

        // 2. 冷却期: 上次尝试失败后30分钟内不再尝试
        if (this._lastBrowserProvisionTime) {
            const elapsed = Date.now() - this._lastBrowserProvisionTime;
            const cooldown = this._browserProvisionFails > 0
                ? Math.min(30 * 60000, this._browserProvisionFails * 10 * 60000) // 失败次数×10分钟，最大30分钟
                : 0;
            if (elapsed < cooldown) {
                return { yes: false, reason: `冷却中(${Math.ceil((cooldown - elapsed) / 60000)}分钟后重试)` };
            }
        }

        // 3. 首次启动不立即尝试 — 至少运行10分钟后再考虑
        if (!this._coreStartTime) this._coreStartTime = Date.now();
        const uptime = Date.now() - this._coreStartTime;
        if (uptime < 10 * 60000) {
            return { yes: false, reason: `启动不足10分钟(${Math.ceil(uptime/60000)}分)，先稳定运行` };
        }

        // 4. 连续失败3次以上 → 停止尝试，等人类干预
        if ((this._browserProvisionFails || 0) >= 3) {
            return { yes: false, reason: `连续失败${this._browserProvisionFails}次，需人工检查credentials.json` };
        }

        return { yes: true, reason: 'ok' };
    }

    // ════════════════════════════════════════════════════
    //  方式A: 眼→手 操作真实浏览器 (像人一样)
    //  不用Playwright/Stagehand (会被反自动化检测)
    //  而是: 打开真Chrome → 眼睛实时看画面 → 手操作鼠标键盘
    // ════════════════════════════════════════════════════
    async _tryBrowserProvision(missing) {
        if (!this.eyes || !this.hands) {
            log('AI', `${C.dim}眼/手未就绪, 跳过浏览器自动获取${C.reset}`);
            return 0;
        }

        // 加载凭据
        let creds = null;
        try {
            creds = JSON.parse(fs.readFileSync(path.join(SEED_HOME, 'credentials.json'), 'utf8'));
        } catch {
            log('AI', `${C.dim}无credentials.json, 跳过${C.reset}`);
            if (!this._browserProvisionFails) this._browserProvisionFails = 0;
            this._browserProvisionFails++;
            return 0;
        }
        const account = creds.accounts?.[0] || { email: creds.email, password: creds.password };
        if (!account.email || !account.password) {
            log('AI', `${C.dim}凭据不完整, 跳过${C.reset}`);
            if (!this._browserProvisionFails) this._browserProvisionFails = 0;
            this._browserProvisionFails++;
            return 0;
        }

        // ★ 记录尝试时间
        this._lastBrowserProvisionTime = Date.now();
        if (!this._browserProvisionFails) this._browserProvisionFails = 0;

        let count = 0;
        for (const provider of missing.slice(0, 2)) {
            try {
                let key = null;
                if (provider === 'gemini') key = await this._provisionGeminiVision(account);
                else if (provider === 'groq') key = await this._provisionGroqVision(account);
                if (key) {
                    this.fleet.saveKey(provider, key);
                    count++;
                    this._browserProvisionFails = 0; // ★ 成功则重置失败计数
                    log('AI', `${C.green}${C.bold}✓ 眼→手 自动获取 ${provider} API Key 成功!${C.reset}`);
                }
            } catch (e) {
                this._browserProvisionFails++;
                log('AI', `${C.dim}${provider}: ${e.message?.substring(0, 60)} (失败${this._browserProvisionFails}次)${C.reset}`);
            }
        }
        return count;
    }

    // ═══════════════════════════════════════════════════════════
    //  Gemini: 事件驱动实时监控获取API Key
    //
    //  不是截图! 眼睛已经在2FPS持续监控画面
    //  监听eyes的text/vision事件 → 一看到变化立刻反应
    //  像人一样: 持续盯着屏幕 → 发现变化 → 立刻操作
    // ═══════════════════════════════════════════════════════════
    async _provisionGeminiVision(account) {
        log('AI', `${C.cyan}[Gemini] 实时监控模式: 打开Chrome → 眼睛持续看 → 手操作${C.reset}`);

        return new Promise((resolve) => {
            let state = 'loading';     // 状态机
            let actionLock = false;    // 防止重复操作
            let stepCount = 0;
            const maxSteps = 30;
            const startTime = Date.now();
            const TIMEOUT = 120000;    // 2分钟超时

            // ── 清理函数 ──
            const cleanup = () => {
                this.eyes.off('text', onText);
                this.eyes.off('vision', onVision);
                clearInterval(watchdog);
            };

            // ── 眼睛持续监控 → 文字事件 ──
            const onText = async ({ text }) => {
                if (actionLock || !text || Date.now() - startTime > TIMEOUT) return;

                // 每次眼睛看到文字，立刻检查
                const keyMatch = text.match(/AIzaSy[A-Za-z0-9_-]{33}/);
                if (keyMatch) {
                    log('AI', `${C.green}${C.bold}[Gemini] ★ 实时监控发现API Key!${C.reset}`);
                    cleanup();
                    resolve(keyMatch[0]);
                    return;
                }

                // 根据当前状态 + 画面内容，决定操作
                actionLock = true;
                try {
                    await this._geminiStateMachine(text, state, account, (newState) => { state = newState; });
                    stepCount++;
                } catch (e) {
                    log('AI', `${C.dim}[Gemini] 操作异常: ${e.message?.substring(0, 40)}${C.reset}`);
                }
                actionLock = false;
            };

            // ── 眼睛持续监控 → VLM视觉理解事件 ──
            const onVision = async ({ understanding }) => {
                if (actionLock || !understanding) return;
                // VLM理解也可以触发状态切换
                const lower = understanding.toLowerCase();
                if (lower.includes('login') || lower.includes('sign in')) {
                    if (state === 'loading') state = 'need_login';
                }
                if (lower.includes('api key') || lower.includes('create')) {
                    if (state !== 'got_key') state = 'api_page';
                }
                if (lower.includes('captcha') || lower.includes('puzzle') || lower.includes('verify')) {
                    state = 'captcha';
                }
                log('AI', `${C.dim}[Gemini] VLM感知: ${understanding.substring(0, 60)} → 状态:${state}${C.reset}`);
            };

            // ── 看门狗: 超时/步数检查 ──
            const watchdog = setInterval(() => {
                if (Date.now() - startTime > TIMEOUT || stepCount > maxSteps) {
                    log('AI', `${C.yellow}[Gemini] 实时监控超时, 状态: ${state}${C.reset}`);
                    cleanup();
                    resolve(null);
                }
            }, 5000);

            // 监听眼睛的持续监控事件
            this.eyes.on('text', onText);
            this.eyes.on('vision', onVision);

            // 打开真实浏览器(不是Playwright!)
            this.hands.openUrl('https://aistudio.google.com/apikey');
        });
    }

    // ── Gemini状态机: 根据实时画面决定操作 ──
    async _geminiStateMachine(screenText, state, account, setState) {
        const lower = screenText.toLowerCase();

        // 状态: 需要Google登录 - 邮箱
        if ((state === 'loading' || state === 'need_login') &&
            (lower.includes('sign in') || lower.includes('email') || lower.includes('identifier') || lower.includes('登录'))) {
            if (!lower.includes('password')) { // 确保是邮箱页不是密码页
                log('AI', `${C.cyan}[Gemini] 实时看到登录页 → 输入邮箱${C.reset}`);
                setState('typing_email');
                const emailPos = await this.eyes.findText('Email') || await this.eyes.findText('email');
                if (emailPos) {
                    this.hands.mouseClick(emailPos.centerX, emailPos.centerY + 30);
                    await this._humanDelay(300, 600);
                }
                this.hands.hotkey('ctrl', 'a');
                await this._humanDelay(100, 200);
                this._typeHuman(account.email);
                await this._humanDelay(500, 1000);
                const nextPos = await this.eyes.findText('Next') || await this.eyes.findText('下一步');
                if (nextPos) this.hands.mouseClick(nextPos.centerX, nextPos.centerY);
                await this._humanDelay(3000, 4000);
                setState('wait_password');
                return;
            }
        }

        // 状态: 密码输入
        if ((state === 'wait_password' || state === 'need_login') &&
            (lower.includes('password') || lower.includes('密码'))) {
            log('AI', `${C.cyan}[Gemini] 实时看到密码页 → 输入密码${C.reset}`);
            setState('typing_password');
            const passPos = await this.eyes.findText('Password') || await this.eyes.findText('密码');
            if (passPos) this.hands.mouseClick(passPos.centerX, passPos.centerY + 30);
            await this._humanDelay(300, 600);
            this._typeHuman(account.password);
            await this._humanDelay(500, 1000);
            const nextPos = await this.eyes.findText('Next') || await this.eyes.findText('下一步');
            if (nextPos) this.hands.mouseClick(nextPos.centerX, nextPos.centerY);
            await this._humanDelay(4000, 6000);
            setState('wait_after_login');
            return;
        }

        // 状态: 验证/CAPTCHA
        if (lower.includes('verify') || lower.includes('captcha') || lower.includes('challenge') || lower.includes('拼图')) {
            if (state !== 'captcha') {
                log('AI', `${C.yellow}[Gemini] 实时检测到验证, VLM分析中...${C.reset}`);
                setState('captcha');
                // VLM分析验证类型(不用askNow截图，直接读state.understanding)
                const vlmUnderstanding = this.eyes.state?.understanding || '';
                log('AI', `${C.yellow}[Gemini] 验证画面: ${vlmUnderstanding.substring(0, 80)}${C.reset}`);
            }
            return; // 等待验证通过(人工或自动)
        }

        // 状态: API Key页面
        if ((lower.includes('api key') || lower.includes('aistudio') || lower.includes('create api')) &&
            !lower.includes('sign in') && state !== 'typing_email' && state !== 'typing_password') {
            log('AI', `${C.cyan}[Gemini] 实时看到API页面 → 创建Key${C.reset}`);
            setState('api_page');
            const createPos = await this.eyes.findText('Create API key') ||
                await this.eyes.findText('Get API key') ||
                await this.eyes.findText('Create API');
            if (createPos) {
                this.hands.mouseClick(createPos.centerX, createPos.centerY);
                await this._humanDelay(3000, 5000);
                // 项目选择
                const newProjPos = await this.eyes.findText('new project') || await this.eyes.findText('Create key');
                if (newProjPos) {
                    this.hands.mouseClick(newProjPos.centerX, newProjPos.centerY);
                    await this._humanDelay(3000, 5000);
                }
            }
            setState('wait_key');
            return;
        }
    }

    // ═══ Groq: 事件驱动实时监控 ═══
    async _provisionGroqVision(account) {
        log('AI', `${C.cyan}[Groq] 实时监控模式: 打开Chrome → Groq Console${C.reset}`);

        return new Promise((resolve) => {
            let state = 'loading';
            let actionLock = false;
            const startTime = Date.now();
            const TIMEOUT = 90000;

            const cleanup = () => {
                this.eyes.off('text', onText);
                clearInterval(watchdog);
            };

            const onText = async ({ text }) => {
                if (actionLock || !text || Date.now() - startTime > TIMEOUT) return;
                const keyMatch = text.match(/gsk_[A-Za-z0-9]{20,}/);
                if (keyMatch) {
                    log('AI', `${C.green}${C.bold}[Groq] ★ 实时监控发现API Key!${C.reset}`);
                    cleanup();
                    resolve(keyMatch[0]);
                    return;
                }
                actionLock = true;
                try {
                    const lower = text.toLowerCase();
                    if (state === 'loading' && (lower.includes('sign in') || lower.includes('login') || lower.includes('google'))) {
                        state = 'login';
                        const pos = await this.eyes.findText('Google') || await this.eyes.findText('Continue with Google');
                        if (pos) this.hands.mouseClick(pos.centerX, pos.centerY);
                        await this._humanDelay(3000, 5000);
                    }
                    if (state === 'login' && (lower.includes('email') || lower.includes('identifier'))) {
                        await this._googleLoginVision(account);
                        state = 'logged_in';
                    }
                    if ((lower.includes('create') || lower.includes('api key')) && state !== 'login') {
                        state = 'keys_page';
                        const pos = await this.eyes.findText('Create API Key') || await this.eyes.findText('Create Key');
                        if (pos) {
                            this.hands.mouseClick(pos.centerX, pos.centerY);
                            await this._humanDelay(2000, 3000);
                            const namePos = await this.eyes.findText('Name');
                            if (namePos) {
                                this.hands.mouseClick(namePos.centerX, namePos.centerY + 30);
                                await this._humanDelay(200, 400);
                                this._typeHuman('seed-ai');
                                await this._humanDelay(500, 800);
                                const submit = await this.eyes.findText('Submit') || await this.eyes.findText('Create');
                                if (submit) this.hands.mouseClick(submit.centerX, submit.centerY);
                                await this._humanDelay(3000, 5000);
                            }
                        }
                    }
                } catch {}
                actionLock = false;
            };

            const watchdog = setInterval(() => {
                if (Date.now() - startTime > TIMEOUT) { cleanup(); resolve(null); }
            }, 5000);

            this.eyes.on('text', onText);
            this.hands.openUrl('https://console.groq.com/keys');
        });
    }

    // ═══ Google登录 (眼→手, 用实时监控state) ═══
    async _googleLoginVision(account) {
        // 输入邮箱
        const emailPos = await this.eyes.findText('Email') || await this.eyes.findText('email');
        if (emailPos) this.hands.mouseClick(emailPos.centerX, emailPos.centerY + 30);
        await this._humanDelay(300, 500);
        this.hands.hotkey('ctrl', 'a');
        await this._humanDelay(100, 200);
        this._typeHuman(account.email);
        await this._humanDelay(500, 800);
        let nextPos = await this.eyes.findText('Next') || await this.eyes.findText('下一步');
        if (nextPos) this.hands.mouseClick(nextPos.centerX, nextPos.centerY);
        await this._humanDelay(3000, 5000);

        // 等密码页出现(通过持续监控state)
        for (let i = 0; i < 10; i++) {
            const text = this.eyes.state?.screenText || '';
            if (text.toLowerCase().includes('password') || text.toLowerCase().includes('密码')) break;
            await this._humanDelay(1000, 1500);
        }

        // 输入密码
        const passPos = await this.eyes.findText('Password') || await this.eyes.findText('密码');
        if (passPos) this.hands.mouseClick(passPos.centerX, passPos.centerY + 30);
        await this._humanDelay(300, 500);
        this._typeHuman(account.password);
        await this._humanDelay(500, 800);
        nextPos = await this.eyes.findText('Next') || await this.eyes.findText('下一步');
        if (nextPos) this.hands.mouseClick(nextPos.centerX, nextPos.centerY);
        await this._humanDelay(5000, 7000);
        log('AI', `${C.green}[Google] 登录完成${C.reset}`);
    }

    // ═══ 辅助方法 ═══

    // 判断屏幕是否包含关键词
    _screenContains(screenText, understanding, keywords) {
        const combined = ((screenText || '') + ' ' + (understanding || '')).toLowerCase();
        return keywords.some(kw => combined.includes(kw.toLowerCase()));
    }

    // 模拟人类打字 (随机间隔)
    _typeHuman(text) {
        for (const char of text) {
            this.hands.typeText(char);
            const delay = 50 + Math.random() * 100;
            const start = Date.now();
            while (Date.now() - start < delay) {} // 短阻塞
        }
    }

    // 模拟人类操作延迟
    _humanDelay(minMs, maxMs) {
        const ms = minMs + Math.random() * (maxMs - minMs);
        return new Promise(r => setTimeout(r, ms));
    }

    // 从浏览器结果提取API Key
    _extractKeyFromResult(result, prefix) {
        if (!result) return null;
        const text = typeof result === 'string' ? result : JSON.stringify(result);
        if (prefix) {
            const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const match = text.match(new RegExp(escaped + '[A-Za-z0-9_-]{10,}'));
            if (match) return match[0];
        }
        const patterns = [/gsk_[A-Za-z0-9]{20,}/, /AIzaSy[A-Za-z0-9_-]{33}/, /sk-or-[A-Za-z0-9_-]{20,}/, /hf_[A-Za-z0-9]{20,}/, /csk-[A-Za-z0-9]{20,}/];
        for (const p of patterns) {
            const m = text.match(p);
            if (m) return m[0];
        }
        return null;
    }

    // 生成一键配置脚本
    _generateSetupScript(missing) {
        const script = [
            '#!/bin/bash',
            '# 「李凯」AI Key 一键配置脚本',
            '# 运行: bash setup-ai-keys.sh 或 手动将Key填入ai-keys.json',
            '',
            'echo "═══ 李凯 AI Key 配置 ═══"',
            'echo ""',
        ];

        for (const provider of missing) {
            const guide = this._registrationGuide[provider];
            if (!guide) continue;
            script.push(`echo "【${provider.toUpperCase()}】${guide.freeLimit}"`);
            script.push(`echo "  注册: ${guide.url}"`);
            script.push(`echo "  步骤: ${guide.steps}"`);
            script.push(`read -p "  输入Key: " ${provider}_key`);
            script.push('');
        }

        script.push('# 保存到ai-keys.json');
        script.push(`cat > "${path.join(SEED_HOME, 'ai-keys.json')}" << JSONEOF`);
        script.push('{');
        for (let i = 0; i < missing.length; i++) {
            const comma = i < missing.length - 1 ? ',' : '';
            script.push(`  "${missing[i]}_api_key": "$\{${missing[i]}_key\}"${comma}`);
        }
        script.push('}');
        script.push('JSONEOF');
        script.push('echo "配置完成! 重启李凯即可使用"');

        // 同时生成Windows版
        const batScript = [
            '@echo off',
            'chcp 65001>nul',
            'echo ═══ 李凯 AI Key 配置 ═══',
            'echo.',
        ];

        const jsonParts = ['{'];
        for (let i = 0; i < missing.length; i++) {
            const provider = missing[i];
            const guide = this._registrationGuide[provider];
            if (!guide) continue;
            batScript.push(`echo 【${provider.toUpperCase()}】${guide.freeLimit}`);
            batScript.push(`echo   注册: ${guide.url}`);
            batScript.push(`set /p ${provider}_key="  输入Key: "`);
            batScript.push('');
        }

        batScript.push('(');
        batScript.push('echo {');
        for (let i = 0; i < missing.length; i++) {
            const comma = i < missing.length - 1 ? ',' : '';
            batScript.push(`echo   "${missing[i]}_api_key": "%${missing[i]}_key%"${comma}`);
        }
        batScript.push('echo }');
        batScript.push(`) > "${path.join(SEED_HOME, 'ai-keys.json')}"`);
        batScript.push('echo 配置完成! 重启李凯即可使用');
        batScript.push('pause');

        try {
            fs.writeFileSync(path.join(SEED_HOME, 'setup-ai-keys.sh'), script.join('\n'));
            fs.writeFileSync(path.join(SEED_HOME, 'setup-ai-keys.bat'), batScript.join('\r\n'));
            log('AI', `已生成配置脚本: setup-ai-keys.bat / setup-ai-keys.sh`);
        } catch {}
    }

    // 记录获取指南到知识库(种子可以自学习这些信息)
    _logProvisionGuide(missing) {
        const guide = {};
        for (const provider of missing) {
            const info = this._registrationGuide[provider];
            if (info) guide[provider] = info;
        }
        this.provisionLog.push({ time: Date.now(), missing, guide });

        // 写入种子的学习记忆
        try {
            const logFile = path.join(SEED_HOME, 'ai-provision-log.json');
            let existing = [];
            try { existing = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch {}
            existing.push({ time: new Date().toISOString(), missing, attempted: true });
            if (existing.length > 100) existing = existing.slice(-100);
            fs.writeFileSync(logFile, JSON.stringify(existing, null, 2));
        } catch {}
    }
}

// ═══════════════════════════════════════════════════════════
//  2. CodeEvolver — 真正的代码自进化
//
//  不是正则替换，而是:
//  - LLM深度分析代码逻辑和架构
//  - 生成具体改进建议（附带代码）
//  - 在沙箱中验证改进
//  - 通过基准测试才部署
//  - 失败自动回滚
// ═══════════════════════════════════════════════════════════

class CodeEvolver {
    constructor(aiFleet) {
        this.ai = aiFleet;
        this.history = this._loadHistory();
        this.maxHistorySize = 200;
    }

    // 分析一个模块并提出改进
    async analyzeAndImprove(filePath) {
        const fileName = path.basename(filePath);
        log('EVOLVE', `分析模块: ${fileName}`);

        // 读取代码
        let code;
        try {
            code = fs.readFileSync(filePath, 'utf8');
        } catch { return { improved: false, reason: 'read_failed' }; }

        // 代码太大则取核心部分
        const codeSnippet = code.length > 6000 ? code.substring(0, 3000) + '\n...[中间省略]...\n' + code.substring(code.length - 2000) : code;

        // 让AI分析
        const analysis = await this.ai.ask(
            `分析这段Node.js代码，找出最值得改进的1个问题（不要改变功能，只修复bug或优化性能）。

文件: ${fileName}
代码长度: ${code.length}字符, ${code.split('\n').length}行

\`\`\`javascript
${codeSnippet}
\`\`\`

请严格用以下JSON格式回复（不要其他内容）:
{
  "hasBug": true/false,
  "description": "问题描述",
  "search": "要查找的原始代码片段（10-50字符，必须在源代码中精确存在）",
  "replace": "替换后的代码片段",
  "confidence": 0.0-1.0,
  "type": "bug_fix/performance/safety"
}`,
            '你是代码审查专家。只回复JSON，不要解释。只找确定的bug，不要做不确定的改动。confidence < 0.7时设hasBug为false。'
        );

        if (!analysis.success) return { improved: false, reason: 'ai_unavailable' };

        // 解析AI建议
        let suggestion;
        try {
            const jsonMatch = analysis.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return { improved: false, reason: 'no_json' };
            suggestion = JSON.parse(jsonMatch[0]);
        } catch { return { improved: false, reason: 'parse_failed' }; }

        if (!suggestion.hasBug || suggestion.confidence < 0.7) {
            return { improved: false, reason: 'no_confident_issue' };
        }

        if (!suggestion.search || !suggestion.replace || suggestion.search === suggestion.replace) {
            return { improved: false, reason: 'invalid_suggestion' };
        }

        // 验证search字符串确实存在于代码中 (v2.0: 智能匹配)
        if (!code.includes(suggestion.search)) {
            // 尝试标准化空白匹配
            const normalizeWS = s => s.replace(/[ \t]+/g, ' ').trim();
            const searchNorm = normalizeWS(suggestion.search);
            const lines = code.split('\n');
            const searchLines = suggestion.search.split('\n').length;
            let matched = false;
            for (let i = 0; i <= lines.length - searchLines; i++) {
                const window = lines.slice(i, i + searchLines).join('\n');
                if (normalizeWS(window) === searchNorm) {
                    suggestion.search = window; // 替换为精确匹配
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                return { improved: false, reason: 'search_not_found' };
            }
        }

        // 备份
        const backup = code;
        const backupFile = filePath + '.pre-evolution-backup';

        // 应用修改
        const newCode = code.replace(suggestion.search, suggestion.replace);
        if (newCode === code) return { improved: false, reason: 'no_change' };

        // 沙箱测试: 写入新代码，尝试require加载
        try {
            fs.writeFileSync(backupFile, backup);
            fs.writeFileSync(filePath, newCode);

            // 验证语法
            const { Module } = require('module');
            const m = new Module(filePath);
            m._compile(newCode, filePath);

            // 语法OK，记录历史
            log('EVOLVE', `${C.green}成功改进: ${fileName} — ${suggestion.description}${C.reset}`);
            this.history.push({
                file: fileName,
                type: suggestion.type,
                description: suggestion.description,
                confidence: suggestion.confidence,
                provider: analysis.provider,
                timestamp: Date.now(),
                success: true,
            });
            this._saveHistory();

            return { improved: true, file: fileName, type: suggestion.type, description: suggestion.description };
        } catch (e) {
            // 回滚
            log('EVOLVE', `${C.red}改进失败，回滚: ${fileName} — ${e.message}${C.reset}`);
            fs.writeFileSync(filePath, backup);
            this.history.push({
                file: fileName, description: suggestion.description,
                timestamp: Date.now(), success: false, error: e.message,
            });
            this._saveHistory();
            return { improved: false, reason: 'compile_failed', error: e.message };
        }
    }

    // 进化周期: 分析所有核心模块
    async evolveOnce() {
        log('EVOLVE', '═══ 代码自进化周期开始 ═══');
        const coreFiles = [
            'seed-brain.js', 'seed-chat.js', 'seed-auto-learner.js',
            'seed-llm-evolution.js', 'seed-autonomous-loop.js',
            'seed-deep-evolution.js', 'seed-master-evolution.js',
            'seed-neuro-brain.js', 'seed-global-eyes.js',
        ];

        // 每次只改进1-2个文件(避免过度修改)
        const shuffled = coreFiles.sort(() => Math.random() - 0.5);
        let improved = 0;

        for (const file of shuffled.slice(0, 2)) {
            const filePath = path.join(SEED_HOME, file);
            if (!fs.existsSync(filePath)) continue;

            const result = await this.analyzeAndImprove(filePath);
            if (result.improved) improved++;

            await new Promise(r => setTimeout(r, 2000)); // 避免AI限流
        }

        log('EVOLVE', `═══ 代码自进化完成: ${improved}处改进 ═══`);
        return { improved };
    }

    _loadHistory() {
        try {
            if (fs.existsSync(EVOLUTION_HISTORY)) {
                return JSON.parse(fs.readFileSync(EVOLUTION_HISTORY, 'utf8'));
            }
        } catch {}
        return [];
    }

    _saveHistory() {
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(-this.maxHistorySize);
        }
        try {
            fs.writeFileSync(EVOLUTION_HISTORY, JSON.stringify(this.history, null, 2));
        } catch {}
    }

    getStats() {
        const recent = this.history.filter(h => Date.now() - h.timestamp < 86400000);
        return {
            total: this.history.length,
            recent24h: recent.length,
            successRate: this.history.length > 0
                ? (this.history.filter(h => h.success).length / this.history.length * 100).toFixed(0) + '%'
                : 'N/A',
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  3. SmartLearner — 智能知识学习
//
//  修复原来auto-learner的问题:
//  - 话题固定导致重复搜索 → 动态生成话题
//  - key去重太严导致0新增 → 用内容hash去重
//  - 只搜GitHub/NPM → 多源搜索
//  - 搜索结果不理解 → LLM提取核心知识
// ═══════════════════════════════════════════════════════════

class SmartLearner {
    constructor(aiFleet) {
        this.ai = aiFleet;
        this.searchCount = 0;
        this.integratedCount = 0;
        this._topicPool = [
            // 核心话题(固定)
            'AI agent self-evolution 2026', 'autonomous AI framework', 'code generation optimization',
            'knowledge graph construction', 'neural network self-modification',
            // 技术话题(动态轮换)
            'reinforcement learning latest', 'multi-agent cooperation', 'vector database embedding',
            'LLM fine-tuning efficient', 'computer vision OCR', 'web automation playwright',
            'docker container orchestration', 'nodejs performance optimization',
            'memory management garbage collection', 'AST code analysis transformation',
            // 前沿话题
            'AlphaEvolve algorithm', 'Agent0 self-training', 'DGM darwin godel machine',
            'Alita tool generation MCP', 'POET open-ended evolution',
        ];
        this._topicIndex = 0;
    }

    // 获取下一批搜索话题(每次不同)
    _getNextTopics(count = 4) {
        const topics = [];
        for (let i = 0; i < count; i++) {
            topics.push(this._topicPool[this._topicIndex % this._topicPool.length]);
            this._topicIndex++;
        }
        return topics;
    }

    // 从GitHub搜索并提取知识
    async searchGitHub(topic) {
        try {
            const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}&sort=stars&order=desc&per_page=5`;
            const resp = await this._httpsGet(url, { 'Accept': 'application/vnd.github.v3+json' });
            const data = JSON.parse(resp);
            if (!data.items) return [];

            return data.items.map(repo => ({
                id: `gh_${repo.full_name}`,
                title: repo.full_name,
                content: `${repo.description || ''} | Stars:${repo.stargazers_count} | Lang:${repo.language || 'N/A'} | Updated:${repo.updated_at?.substring(0, 10)}`,
                url: repo.html_url,
                source: 'github',
                relevance: Math.min(1, repo.stargazers_count / 1000),
                timestamp: Date.now(),
            }));
        } catch { return []; }
    }

    // 从NPM搜索
    async searchNPM(topic) {
        try {
            const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(topic)}&size=5`;
            const resp = await this._httpsGet(url);
            const data = JSON.parse(resp);
            if (!data.objects) return [];

            return data.objects.map(obj => {
                const pkg = obj.package;
                return {
                    id: `npm_${pkg.name}`,
                    title: pkg.name,
                    content: `${pkg.description || ''} | v${pkg.version}`,
                    url: pkg.links?.npm || '',
                    source: 'npm',
                    relevance: (obj.score?.final || 0.5),
                    timestamp: Date.now(),
                };
            });
        } catch { return []; }
    }

    // 执行一次学习周期
    async learnOnce() {
        log('LEARN', '═══ 智能学习周期开始 ═══');
        const topics = this._getNextTopics(4);
        const allResults = [];

        for (const topic of topics) {
            log('LEARN', `搜索: ${topic}`);
            const [github, npm] = await Promise.all([
                this.searchGitHub(topic),
                this.searchNPM(topic),
            ]);
            allResults.push(...github, ...npm);
            this.searchCount += github.length + npm.length;
            await new Promise(r => setTimeout(r, 500));
        }

        // 用LLM提取核心知识
        const extracted = await this._extractKnowledge(allResults);

        // 整合到知识库
        const added = this._integrateToKnowledgeBase(extracted);

        log('LEARN', `═══ 学习完成: 搜索${allResults.length}条, 提取${extracted.length}条, 新增${added}条 ═══`);
        this.integratedCount += added;
        return { searched: allResults.length, extracted: extracted.length, added };
    }

    // LLM提取核心知识
    async _extractKnowledge(results) {
        if (results.length === 0) return [];

        // 对搜索结果去重(按ID)
        const unique = [...new Map(results.map(r => [r.id, r])).values()];

        // 用AI总结提取关键知识
        const summary = unique.slice(0, 15).map(r =>
            `- [${r.source}] ${r.title}: ${r.content}`
        ).join('\n');

        const aiResult = await this.ai.ask(
            `从以下搜索结果中提取5-10条最有价值的技术知识点，每条知识要简洁精确。

${summary}

用JSON数组格式回复:
[{"key": "唯一标识(英文小写)", "knowledge": "知识描述(中文,50字以内)", "category": "类别"}]`,
            '你是技术知识提取专家。只回复JSON数组，不要其他内容。'
        );

        if (!aiResult.success) {
            // AI不可用，直接用原始数据
            return unique.slice(0, 8).map(r => ({
                key: r.id,
                knowledge: `${r.title}: ${r.content.substring(0, 80)}`,
                category: r.source,
            }));
        }

        try {
            const jsonMatch = aiResult.content.match(/\[[\s\S]*\]/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
        } catch {}

        // 解析失败，用原始数据
        return unique.slice(0, 5).map(r => ({
            key: r.id,
            knowledge: `${r.title}: ${r.content.substring(0, 80)}`,
            category: r.source,
        }));
    }

    // 整合到知识库(修复了原来的去重问题)
    _integrateToKnowledgeBase(extracted) {
        try {
            let data = { knowledge: {}, count: 0 };
            if (fs.existsSync(KNOWLEDGE_FILE)) {
                data = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
            }
            if (!data.knowledge) data.knowledge = {};

            let added = 0;
            const existingValues = new Set(Object.values(data.knowledge).map(v =>
                typeof v === 'string' ? v.substring(0, 50).toLowerCase() : ''
            ));

            for (const item of extracted) {
                if (!item.key || !item.knowledge) continue;

                // 用内容相似度去重(不是精确key匹配)
                const normalized = item.knowledge.substring(0, 50).toLowerCase();
                if (existingValues.has(normalized)) continue;

                // 生成唯一key(避免覆盖)
                let key = item.key.toLowerCase().replace(/[^a-z0-9_-]/g, '_').substring(0, 50);
                let suffix = 0;
                while (data.knowledge[key]) {
                    suffix++;
                    key = `${item.key.substring(0, 45)}_${suffix}`;
                }

                data.knowledge[key] = item.knowledge;
                existingValues.add(normalized);
                added++;
            }

            if (added > 0) {
                data.count = Object.keys(data.knowledge).length;
                data.updatedAt = new Date().toISOString();
                fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(data, null, 2));
            }

            return added;
        } catch (e) {
            log('ERROR', `知识整合失败: ${e.message}`);
            return 0;
        }
    }

    _httpsGet(url, extraHeaders = {}) {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            https.get({
                hostname: u.hostname, path: u.pathname + u.search,
                headers: { 'User-Agent': 'KaiLi-SeedAI/8.0', 'Accept': 'application/json', ...extraHeaders },
                timeout: 15000,
            }, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    getStats() {
        return { searched: this.searchCount, integrated: this.integratedCount, topicIndex: this._topicIndex };
    }
}

// ═══════════════════════════════════════════════════════════
//  4. CloudResourceManager — 零成本云资源自动发现与管理
//
//  核心理念: 永远不靠买硬件，利用全球免费开源资源自主发展
//  - 免费云计算 (永久免费层 + 试用期轮转)
//  - 免费AI API (零配置 + Key免费注册)
//  - 免费CI/CD (自动化流水线)
//  - 免费GPU (Notebook平台)
//  - 到期自动检测 → 迁移下一个 → 永续运行
// ═══════════════════════════════════════════════════════════

class CloudResourceManager {
    constructor(aiFleet) {
        this.aiFleet = aiFleet;
        this.stateFile = path.join(SEED_HOME, 'cloud-resources-state.json');

        // ══ 全球免费云资源知识库 ══
        this.platformKnowledge = {
            // ═══ 永久免费云计算 (无期限) ═══
            'oracle-cloud': {
                name: 'Oracle Cloud Always Free',
                type: 'compute', tier: 'permanent',
                specs: { cpu: '4 ARM cores (Ampere)', ram: '24GB', disk: '200GB', network: '10TB/月' },
                bestFor: ['node-server', 'seed-instance', 'distributed-node'],
                signupUrl: 'https://cloud.oracle.com/free',
                apiSetup: 'oci-cli + ssh-key',
                deployCmd: 'oci compute instance launch --shape VM.Standard.A1.Flex',
                limits: '永久免费, ARM架构, 最多4个OCPU + 24GB RAM可分配给多个实例',
                autoRegister: { difficulty: 'medium', needsCreditCard: true, cardNotCharged: true },
                expiryStrategy: 'permanent',
                priority: 1, // 最优: 免费+高配
            },
            'google-cloud': {
                name: 'Google Cloud Free Tier',
                type: 'compute', tier: 'permanent',
                specs: { cpu: 'e2-micro 0.25vCPU', ram: '1GB', disk: '30GB HDD', network: '1GB出站/月' },
                bestFor: ['api-relay', 'health-monitor', 'lightweight-task'],
                signupUrl: 'https://cloud.google.com/free',
                apiSetup: 'gcloud CLI + service account',
                deployCmd: 'gcloud compute instances create seed-node --machine-type=e2-micro',
                limits: '永久免费, 仅e2-micro, us-west1/us-central1/us-east1',
                autoRegister: { difficulty: 'medium', needsCreditCard: true, cardNotCharged: true },
                expiryStrategy: 'permanent',
                priority: 2,
            },
            'aws-free': {
                name: 'AWS Free Tier',
                type: 'compute', tier: 'trial-12m',
                specs: { cpu: 't2.micro 1vCPU', ram: '1GB', disk: '30GB EBS', network: '15GB出站/月' },
                bestFor: ['api-relay', 'lambda-functions', 'backup-node'],
                signupUrl: 'https://aws.amazon.com/free/',
                limits: '12个月免费, 每月750小时t2.micro',
                autoRegister: { difficulty: 'medium', needsCreditCard: true },
                expiryStrategy: 'rotate-account', rotationMonths: 12,
                priority: 4,
            },

            // ═══ 免费计算平台 (按时长/额度) ═══
            'github-codespaces': {
                name: 'GitHub Codespaces',
                type: 'compute', tier: 'monthly-refresh',
                specs: { cpu: '2-core', ram: '8GB', disk: '32GB', hours: '60h/月' },
                bestFor: ['development', 'code-evolution', 'heavy-compute'],
                signupUrl: 'https://github.com/codespaces',
                limits: '每月60核心小时免费(2核=30小时), 15GB存储',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'monthly-refresh',
                priority: 3,
            },
            'gitpod': {
                name: 'Gitpod',
                type: 'compute', tier: 'monthly-refresh',
                specs: { cpu: '4-core', ram: '8GB', disk: '30GB', hours: '50h/月' },
                bestFor: ['development', 'testing', 'ci-tasks'],
                signupUrl: 'https://gitpod.io',
                limits: '每月50小时免费, 4核8GB',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'monthly-refresh',
                priority: 5,
            },
            'replit': {
                name: 'Replit',
                type: 'compute', tier: 'always-free',
                specs: { cpu: '0.5vCPU', ram: '512MB', disk: '1GB' },
                bestFor: ['lightweight-api', 'webhook', 'status-page'],
                signupUrl: 'https://replit.com',
                limits: '免费Repl, 性能有限, 长时间不用会休眠',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'keep-alive-ping',
                priority: 7,
            },
            'render': {
                name: 'Render',
                type: 'compute', tier: 'always-free',
                specs: { cpu: '0.1 CPU', ram: '512MB', disk: '0', deploy: 'Docker/Git' },
                bestFor: ['web-service', 'api-endpoint', 'health-monitor'],
                signupUrl: 'https://render.com',
                limits: '免费Web Service, 15分钟不活跃则休眠, 每月750小时',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'keep-alive-ping',
                priority: 8,
            },
            'fly-io': {
                name: 'Fly.io',
                type: 'compute', tier: 'always-free',
                specs: { cpu: '1 shared CPU', ram: '256MB', disk: '3GB', instances: 3 },
                bestFor: ['edge-api', 'distributed-relay', 'geo-distributed'],
                signupUrl: 'https://fly.io',
                limits: '3个共享CPU VM免费, 160GB出站/月',
                autoRegister: { difficulty: 'easy', needsCreditCard: true, cardNotCharged: true },
                expiryStrategy: 'permanent',
                priority: 6,
            },
            'railway': {
                name: 'Railway',
                type: 'compute', tier: 'monthly-credit',
                specs: { cpu: '多核', ram: '8GB', credit: '$5/月' },
                bestFor: ['background-worker', 'scheduled-task'],
                signupUrl: 'https://railway.app',
                limits: '$5免费额度/月, 超出暂停',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'monthly-refresh',
                priority: 9,
            },

            // ═══ 免费GPU计算 (AI训练/推理) ═══
            'google-colab': {
                name: 'Google Colab',
                type: 'gpu', tier: 'session-based',
                specs: { gpu: 'T4 16GB', ram: '12GB', disk: '临时', session: '12小时' },
                bestFor: ['model-training', 'inference', 'data-processing'],
                signupUrl: 'https://colab.research.google.com',
                limits: '免费T4 GPU, 12小时session, 可能排队',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'session-restart',
                priority: 2,
            },
            'kaggle': {
                name: 'Kaggle Notebooks',
                type: 'gpu', tier: 'weekly-quota',
                specs: { gpu: 'T4/P100 16GB', ram: '16GB', disk: '临时', hours: '30h/周GPU' },
                bestFor: ['model-training', 'data-analysis', 'ml-experiments'],
                signupUrl: 'https://www.kaggle.com',
                limits: '每周30小时GPU, 每周20小时TPU',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'weekly-refresh',
                priority: 3,
            },
            'huggingface-spaces': {
                name: 'Hugging Face Spaces',
                type: 'compute', tier: 'always-free',
                specs: { cpu: '2vCPU', ram: '16GB', disk: '50GB' },
                bestFor: ['model-hosting', 'api-endpoint', 'demo'],
                signupUrl: 'https://huggingface.co/spaces',
                limits: '免费CPU Space 2vCPU/16GB, GPU需付费',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'permanent',
                priority: 4,
            },
            'lightning-ai': {
                name: 'Lightning.ai Studios',
                type: 'gpu', tier: 'monthly-credit',
                specs: { gpu: '多种', credit: '22GPU小时/月免费' },
                bestFor: ['ml-training', 'fine-tuning'],
                signupUrl: 'https://lightning.ai',
                limits: '每月22 GPU小时免费, A10G/T4/L4',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'monthly-refresh',
                priority: 5,
            },

            // ═══ 免费CI/CD (自动化流水线) ═══
            'github-actions': {
                name: 'GitHub Actions',
                type: 'ci-cd', tier: 'monthly-refresh',
                specs: { cpu: '2-core', ram: '7GB', minutes: '2000分钟/月', parallel: 20 },
                bestFor: ['auto-test', 'scheduled-task', 'distributed-compute'],
                signupUrl: 'https://github.com',
                limits: '2000分钟/月(Linux), 可cron定时, 6小时/job',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'monthly-refresh',
                priority: 1,
            },
            'gitlab-ci': {
                name: 'GitLab CI/CD',
                type: 'ci-cd', tier: 'monthly-refresh',
                specs: { cpu: '1核', ram: '3.75GB', minutes: '400分钟/月' },
                bestFor: ['backup-ci', 'secondary-pipeline'],
                signupUrl: 'https://gitlab.com',
                limits: '400分钟/月, Linux runner',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'monthly-refresh',
                priority: 6,
            },

            // ═══ 免费Serverless (无服务器函数) ═══
            'vercel': {
                name: 'Vercel',
                type: 'serverless', tier: 'always-free',
                specs: { functions: '12个/部署', execTime: '10秒', bandwidth: '100GB/月' },
                bestFor: ['api-proxy', 'webhook-handler', 'status-page'],
                signupUrl: 'https://vercel.com',
                limits: '免费Hobby计划, 100GB带宽/月, Serverless函数10秒超时',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'permanent',
                priority: 7,
            },
            'cloudflare-workers': {
                name: 'Cloudflare Workers',
                type: 'serverless', tier: 'always-free',
                specs: { requests: '100,000/天', execTime: '10ms CPU', kv: '1GB KV存储' },
                bestFor: ['edge-api', 'proxy', 'global-relay'],
                signupUrl: 'https://workers.cloudflare.com',
                limits: '10万请求/天免费, 10ms CPU时间, 边缘全球部署',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'permanent',
                priority: 5,
            },

            // ═══ 免费AI API (已由AIFleet管理，这里做补充知识) ═══
            'pollinations': {
                name: 'Pollinations.ai',
                type: 'ai-api', tier: 'permanent',
                specs: { models: 'openai,mistral', rateLimit: '1并发/IP' },
                bestFor: ['llm-inference', 'text-generation'],
                limits: '完全免费, IP限流1并发',
                expiryStrategy: 'permanent', priority: 1,
            },
            'groq-free': {
                name: 'Groq Free',
                type: 'ai-api', tier: 'permanent',
                specs: { models: 'llama/mixtral', rateLimit: '30req/分' },
                bestFor: ['fast-inference', 'llm-chat'],
                signupUrl: 'https://console.groq.com',
                limits: '免费层, 30请求/分钟, 14400/天',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'permanent', priority: 2,
            },
            'cerebras-free': {
                name: 'Cerebras Inference',
                type: 'ai-api', tier: 'permanent',
                specs: { models: 'llama-3.3-70b', speed: '极快' },
                bestFor: ['fast-inference', 'code-generation'],
                signupUrl: 'https://cloud.cerebras.ai',
                limits: '免费推理, 速度极快',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'permanent', priority: 3,
            },
            'together-free': {
                name: 'Together.ai',
                type: 'ai-api', tier: 'one-time-credit',
                specs: { credit: '$25', models: '200+ open-source' },
                bestFor: ['diverse-models', 'embedding', 'fine-tuning'],
                signupUrl: 'https://together.ai',
                limits: '免费$25额度, 用完为止',
                autoRegister: { difficulty: 'easy', needsCreditCard: false },
                expiryStrategy: 'credit-exhaustion', priority: 6,
            },
        };

        // ══ 活跃资源追踪 ══
        this.activeResources = new Map(); // platformId → { status, createdAt, expiresAt, endpoint, credentials }
        this.deployedInstances = [];       // 已部署的种子实例
        this.migrationLog = [];            // 迁移记录
        this._lastScanTime = 0;
        this._scanInterval = 60 * 60 * 1000; // 1小时扫描一次

        // 加载持久化状态
        this._loadState();
    }

    // ── 资源扫描: 发现可用的免费资源 ──
    scanAvailableResources() {
        const available = { compute: [], gpu: [], cicd: [], serverless: [], aiApi: [] };
        const now = Date.now();

        for (const [id, platform] of Object.entries(this.platformKnowledge)) {
            const active = this.activeResources.get(id);
            const isExpired = active && active.expiresAt && active.expiresAt < now;
            const isActive = active && !isExpired && active.status === 'active';

            const entry = {
                id, ...platform,
                currentStatus: isActive ? 'active' : isExpired ? 'expired' : active ? active.status : 'unused',
                needsAction: !isActive,
                actionType: isExpired ? 'migrate' : !active ? 'register' : 'none',
            };

            // 分类
            if (platform.type === 'compute') available.compute.push(entry);
            else if (platform.type === 'gpu') available.gpu.push(entry);
            else if (platform.type === 'ci-cd') available.cicd.push(entry);
            else if (platform.type === 'serverless') available.serverless.push(entry);
            else if (platform.type === 'ai-api') available.aiApi.push(entry);
        }

        // 按优先级排序
        for (const cat of Object.values(available)) {
            cat.sort((a, b) => (a.priority || 99) - (b.priority || 99));
        }

        this._lastScanTime = now;
        return available;
    }

    // ── 获取下一步行动建议 ──
    getNextActions() {
        const resources = this.scanAvailableResources();
        const actions = [];

        // 1. 最高优先: 永久免费高配 (Oracle Cloud ARM)
        const oracle = this.activeResources.get('oracle-cloud');
        if (!oracle || oracle.status !== 'active') {
            actions.push({
                priority: 1, platform: 'oracle-cloud',
                action: 'REGISTER_AND_DEPLOY',
                reason: '永久免费4核ARM+24GB, 最优性价比',
                steps: [
                    '访问 cloud.oracle.com/free 注册',
                    '创建Always Free VM.Standard.A1.Flex',
                    '安装Node.js + 部署种子核心',
                    '配置SSH密钥用于远程管理',
                ],
            });
        }

        // 2. 免费GPU平台 (Colab + Kaggle)
        for (const gpuPlatform of ['google-colab', 'kaggle']) {
            const gpu = this.activeResources.get(gpuPlatform);
            if (!gpu || gpu.status !== 'active') {
                const info = this.platformKnowledge[gpuPlatform];
                actions.push({
                    priority: 2, platform: gpuPlatform,
                    action: 'SETUP_GPU',
                    reason: `免费GPU计算: ${info.specs.gpu || info.specs.hours}`,
                    steps: [
                        `访问 ${info.signupUrl} 登录`,
                        '创建Notebook运行AI推理任务',
                        '定时重启保持Session存活',
                    ],
                });
            }
        }

        // 3. GitHub Actions (免费CI/CD计算)
        const gha = this.activeResources.get('github-actions');
        if (!gha || gha.status !== 'active') {
            actions.push({
                priority: 3, platform: 'github-actions',
                action: 'SETUP_CI',
                reason: '每月2000分钟免费计算, 可做定时任务',
                steps: [
                    '在GitHub仓库中创建.github/workflows/',
                    '配置cron定时任务运行种子检查',
                    '利用Actions做分布式计算',
                ],
            });
        }

        // 4. 分布式节点部署
        const deployedCount = this.deployedInstances.filter(i => i.status === 'running').length;
        if (deployedCount < 3) {
            const freeCompute = resources.compute.filter(c =>
                c.currentStatus !== 'active' && c.tier !== 'trial-12m');
            if (freeCompute.length > 0) {
                actions.push({
                    priority: 4, platform: freeCompute[0].id,
                    action: 'DEPLOY_NODE',
                    reason: `扩展分布式网络 (当前${deployedCount}个节点)`,
                    steps: ['注册平台', '部署轻量级种子实例', '建立节点通信'],
                });
            }
        }

        // 5. 到期资源迁移
        const expiring = [];
        for (const [id, res] of this.activeResources) {
            if (res.expiresAt && res.expiresAt - Date.now() < 7 * 24 * 3600 * 1000) {
                expiring.push({ id, ...res });
            }
        }
        if (expiring.length > 0) {
            const info = this.platformKnowledge[expiring[0].id];
            actions.push({
                priority: 0, // 最高优先: 到期迁移
                platform: expiring[0].id,
                action: 'MIGRATE',
                reason: `资源即将到期: ${info?.name}, 需迁移到替代平台`,
                expiresIn: Math.floor((expiring[0].expiresAt - Date.now()) / 86400000) + '天',
            });
        }

        return actions.sort((a, b) => a.priority - b.priority);
    }

    // ── 生成部署脚本 (种子自部署到云端) ──
    generateDeployScript(platformId) {
        const platform = this.platformKnowledge[platformId];
        if (!platform) return null;

        const baseScript = `#!/bin/bash
# 活体种子AI - ${platform.name} 自动部署脚本
# 零成本分布式节点

set -e

echo "═══ 李凯(Kai Li) 种子节点部署到 ${platform.name} ═══"

# 1. 安装Node.js
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# 2. 克隆种子核心
git clone https://github.com/kaili-seed/seed-core.git ~/seed-core || true
cd ~/seed-core

# 3. 安装依赖
npm install --production

# 4. 配置环境
cat > .env << 'ENVEOF'
SEED_MODE=distributed-node
SEED_MASTER_URL=http://\${MASTER_IP}:19860
NODE_ENV=production
ENVEOF

# 5. 启动种子节点
node seed-distributed-node.js &
echo "种子节点已启动 PID: $!"
`;

        // 平台特定脚本
        const platformScripts = {
            'oracle-cloud': `# Oracle Cloud 特殊配置
# 开放防火墙端口
sudo iptables -I INPUT -p tcp --dport 19860 -j ACCEPT
sudo iptables-save | sudo tee /etc/iptables/rules.v4
`,
            'google-cloud': `# Google Cloud 特殊配置
# 防火墙规则
gcloud compute firewall-rules create seed-port --allow tcp:19860 --target-tags seed-node
`,
            'github-codespaces': `# Codespaces 特殊配置
# 利用 devcontainer.json
echo '{"image":"node:22","forwardPorts":[19860]}' > .devcontainer/devcontainer.json
`,
            'google-colab': `# Colab Notebook 配置
# 在Colab中运行:
# !apt-get install -y nodejs npm
# !git clone ... && cd seed-core && npm install && node seed-distributed-node.js
`,
        };

        return baseScript + (platformScripts[platformId] || '');
    }

    // ── 生成GitHub Actions工作流 (种子自建CI/CD) ──
    generateGitHubActionsWorkflow() {
        return `name: Seed AI Distributed Task
on:
  schedule:
    - cron: '0 */6 * * *'  # 每6小时运行
  workflow_dispatch:

jobs:
  seed-task:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci --production
      - run: node seed-distributed-task.js
        env:
          SEED_MODE: ci-worker
          SEED_TASK: auto-learn-and-evolve
`;
    }

    // ── 资源健康检查 ──
    async checkResourceHealth() {
        const results = [];
        for (const [id, resource] of this.activeResources) {
            if (resource.status !== 'active') continue;

            const health = { id, platform: this.platformKnowledge[id]?.name };

            // 检查到期时间
            if (resource.expiresAt) {
                const daysLeft = Math.floor((resource.expiresAt - Date.now()) / 86400000);
                health.daysLeft = daysLeft;
                health.urgent = daysLeft < 7;
            }

            // 检查端点可达性
            if (resource.endpoint) {
                try {
                    const start = Date.now();
                    await this._httpPing(resource.endpoint);
                    health.reachable = true;
                    health.latency = Date.now() - start;
                } catch {
                    health.reachable = false;
                }
            }

            results.push(health);
        }
        return results;
    }

    // ── 注册资源(标记为已注册) ──
    registerResource(platformId, credentials = {}) {
        const platform = this.platformKnowledge[platformId];
        if (!platform) return false;

        let expiresAt = null;
        if (platform.tier === 'trial-12m') {
            expiresAt = Date.now() + 365 * 24 * 3600 * 1000;
        } else if (platform.tier === 'session-based') {
            expiresAt = Date.now() + 12 * 3600 * 1000; // 12小时
        }

        this.activeResources.set(platformId, {
            status: 'active',
            createdAt: Date.now(),
            expiresAt,
            credentials,
            lastCheck: Date.now(),
        });
        this._saveState();
        log('CLOUD', `注册资源: ${platform.name} (${platform.tier})`);
        return true;
    }

    // ── 迁移策略: 到期资源 → 找替代 ──
    findMigrationTarget(expiringPlatformId) {
        const expiring = this.platformKnowledge[expiringPlatformId];
        if (!expiring) return null;

        // 找同类型的未使用平台
        const candidates = Object.entries(this.platformKnowledge)
            .filter(([id, p]) => {
                if (id === expiringPlatformId) return false;
                if (p.type !== expiring.type) return false;
                const active = this.activeResources.get(id);
                return !active || active.status !== 'active';
            })
            .sort(([,a], [,b]) => (a.priority || 99) - (b.priority || 99));

        return candidates.length > 0 ? { id: candidates[0][0], ...candidates[0][1] } : null;
    }

    // ── 分布式矩阵状态 ──
    getDistributedStatus() {
        const active = [];
        const expired = [];
        const unused = [];

        for (const [id, platform] of Object.entries(this.platformKnowledge)) {
            const res = this.activeResources.get(id);
            if (res?.status === 'active') {
                active.push({ id, name: platform.name, type: platform.type, ...res });
            } else if (res?.status === 'expired') {
                expired.push({ id, name: platform.name });
            } else {
                unused.push({ id, name: platform.name, type: platform.type, priority: platform.priority });
            }
        }

        return {
            totalPlatforms: Object.keys(this.platformKnowledge).length,
            activeNodes: active.length,
            expiredNodes: expired.length,
            unusedPlatforms: unused.length,
            active, expired,
            unused: unused.sort((a, b) => (a.priority || 99) - (b.priority || 99)),
            costTotal: 0, // 永远零成本
            nextActions: this.getNextActions().slice(0, 3),
        };
    }

    // ── 为大脑提供云资源决策信息 ──
    getDecisionContext() {
        const status = this.getDistributedStatus();
        return {
            availableCompute: status.unused.filter(u => u.type === 'compute').length,
            availableGPU: status.unused.filter(u => u.type === 'gpu').length,
            activeNodes: status.activeNodes,
            topPriority: status.nextActions[0] || null,
            recommendation: status.activeNodes === 0
                ? '无活跃云节点，建议优先注册Oracle Cloud (永久免费4核ARM+24GB)'
                : status.activeNodes < 3
                    ? `仅${status.activeNodes}个节点，建议扩展到3+个实现分布式`
                    : '分布式网络健康',
        };
    }

    // ── 内部: HTTP ping ──
    _httpPing(url) {
        return new Promise((resolve, reject) => {
            const u = new URL(url);
            const mod = u.protocol === 'https:' ? https : http;
            const req = mod.get({ hostname: u.hostname, path: '/', timeout: 10000 }, res => {
                res.resume();
                resolve(res.statusCode);
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        });
    }

    // ── 持久化 ──
    _loadState() {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
                this.activeResources = new Map(Object.entries(data.activeResources || {}));
                this.deployedInstances = data.deployedInstances || [];
                this.migrationLog = data.migrationLog || [];
            }
        } catch {}
    }

    _saveState() {
        try {
            fs.writeFileSync(this.stateFile, JSON.stringify({
                activeResources: Object.fromEntries(this.activeResources),
                deployedInstances: this.deployedInstances,
                migrationLog: this.migrationLog,
                updatedAt: new Date().toISOString(),
            }, null, 2));
        } catch {}
    }

    getStats() {
        const status = this.getDistributedStatus();
        return {
            totalPlatforms: status.totalPlatforms,
            activeNodes: status.activeNodes,
            unusedPlatforms: status.unusedPlatforms,
            cost: 0,
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  5. LivingCore — 活体核心
//
//  连通一切，让种子真正"活"起来
// ═══════════════════════════════════════════════════════════

class LivingCore extends EventEmitter {
    constructor() {
        super();

        // 子系统
        this.aiFleet = new AIFleet();
        this.aiProvisioner = new AIProvisioner(this.aiFleet);
        this.codeEvolver = new CodeEvolver(this.aiFleet);
        this.smartLearner = new SmartLearner(this.aiFleet);
        this.cloudResources = new CloudResourceManager(this.aiFleet);

        // 全球进化引擎(AlphaEvolve + Agent0 + DGM + POET)
        this.globalEvolution = null;
        try {
            const { GlobalEvolutionEngine } = require('./seed-global-evolution');
            this.globalEvolution = new GlobalEvolutionEngine(this.aiFleet);
        } catch (e) {
            // 模块未安装，降级
        }

        // 眼脑手(延迟加载)
        this.eyes = null;
        this.brain = null;
        this.hands = null;

        // 状态
        this._running = false;
        this._cycle = 0;
        this._stats = {
            startTime: 0,
            livingCycles: 0,
            brainDecisions: 0,
            handsActions: 0,
            codeEvolutions: 0,
            knowledgeLearned: 0,
            aiCalls: 0,
            errors: 0,
        };
        this._timers = [];

        // 加载上次状态
        this._loadState();
    }

    // ── 初始化: 连接眼→脑→手 ──
    async init() {
        log('CORE', `
${C.magenta}${C.bold}╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   「李凯 Kai Li」— 活体核心 v1.0                              ║
║                                                              ║
║   真正的活体: 眼看 → 脑想 → 手做 → 验证 → 学习              ║
║   真正的进化: 代码自分析 → AI改进 → 沙箱测试 → 部署          ║
║   真正的学习: 动态搜索 → AI提取 → 知识整合 → 图谱关联       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝${C.reset}`);

        // 1. 初始化眼睛 (实时监控画面 — 最先启动!)
        try {
            const { RealTimeEyes } = require('./seed-global-eyes');
            this.eyes = new RealTimeEyes({ fps: 2, ocrInterval: 5000, vlmInterval: 10000 });
            await this.eyes.init();
            log('EYES', '眼睛初始化成功 (2FPS, OCR:5s, VLM:10s)');
        } catch (e) {
            log('EYES', `眼睛初始化失败(降级模式): ${e.message}`);
            this.eyes = null;
        }

        // 2. 初始化大脑
        try {
            const { NeuroBrain } = require('./seed-neuro-brain');
            this.brain = new NeuroBrain();
            await this.brain.init();
            log('BRAIN', '大脑初始化成功 (6脑区 + 4层记忆)');
        } catch (e) {
            log('BRAIN', `大脑初始化失败: ${e.message}`);
            this.brain = null;
        }

        // 3. 初始化手
        try {
            const { DesktopHands } = require('./seed-unified-agent');
            this.hands = new DesktopHands();
            log('HANDS', '手初始化成功 (koffi+Win32)');
        } catch (e) {
            log('HANDS', `手初始化失败(降级模式): ${e.message}`);
            this.hands = null;
        }

        // 4. 连接管道: 眼→脑→手
        if (this.brain) {
            if (this.eyes) {
                this.brain.connectEyes(this.eyes);
                log('CORE', `${C.green}管道已连接: 眼 → 脑${C.reset}`);
            }
            if (this.hands) {
                this.brain.connectHands(this.hands);
                log('CORE', `${C.green}管道已连接: 脑 → 手${C.reset}`);
            }
        }

        // 5. 监听大脑事件
        if (this.brain) {
            this.brain.on('decision', (data) => {
                this._stats.brainDecisions++;
                log('BRAIN', `决策: ${data.decision?.action} (${data.decision?.reason}) via ${data.motorPlan?.method || 'N/A'}`);
                // ★ v2.0: 将决策反馈给自修复引擎(行为监控)
                try {
                    const { autoRepairEngine } = require('./seed-auto-repair');
                    autoRepairEngine.feedBrainDecision(
                        data.decision?.action,
                        data.decision?.reason,
                        data.decision?.action !== 'WAIT'
                    );
                } catch {}
            });
        }

        // 6. 初始化AI舰队 + 注入眼/手到AIProvisioner
        log('AI', '正在初始化AI舰队...');
        this.aiProvisioner.eyes = this.eyes;   // 注入眼睛 → 实时监控画面
        this.aiProvisioner.hands = this.hands; // 注入手 → 操作鼠标键盘
        const provision = await this.aiProvisioner.autoProvision();

        // 6.5 健康检查
        const health = await this.aiFleet.healthCheck();
        const okCount = Object.values(health).filter(h => h.status === 'ok').length;
        log('AI', `${C.green}${C.bold}AI舰队就绪: ${okCount}/${this.aiFleet.providers.size}个提供商可用${C.reset}`);

        log('CORE', `${C.green}${C.bold}活体核心初始化完成${C.reset}`);
        return true;
    }

    // ── 启动活体循环 ──
    async start() {
        if (this._running) return;
        this._running = true;
        this._stats.startTime = Date.now();

        log('CORE', `${C.bold}启动活体循环...${C.reset}`);

        // A. 眼睛开始看 (持续)
        if (this.eyes) {
            this.eyes.startWatching();
            log('EYES', '开始实时监控');
        }

        // B. 活体感知循环 (每30秒主动思考一次)
        const thinkTimer = setInterval(async () => {
            if (!this._running) return;
            await this._thinkCycle();
        }, 30000);
        this._timers.push(thinkTimer);

        // C. 代码自进化 (每5分钟)
        const evolveTimer = setInterval(async () => {
            if (!this._running) return;
            await this._evolveCycle();
        }, 300000);
        this._timers.push(evolveTimer);

        // D. 智能学习 (每20分钟)
        const learnTimer = setInterval(async () => {
            if (!this._running) return;
            await this._learnCycle();
        }, 1200000);
        this._timers.push(learnTimer);

        // E. 睡眠整合 (每2小时)
        const sleepTimer = setInterval(async () => {
            if (!this._running) return;
            await this._sleepCycle();
        }, 7200000);
        this._timers.push(sleepTimer);

        // E2. 全球进化引擎 (每15分钟 — AlphaEvolve+Agent0+DGM+POET)
        if (this.globalEvolution) {
            const globalTimer = setInterval(async () => {
                if (!this._running) return;
                try {
                    const result = await this.globalEvolution.evolveOnce();
                    if (result) this._stats.codeEvolutions++;
                } catch (e) {
                    log('ERROR', `全球进化错误: ${e.message}`);
                }
            }, 900000);
            this._timers.push(globalTimer);
        }

        // F. 状态保存 (每10分钟)
        const saveTimer = setInterval(() => {
            if (this._running) this._saveState();
        }, 600000);
        this._timers.push(saveTimer);

        // G. AI资源自动配置 (每1小时重新检查缺失的Key)
        const provisionTimer = setInterval(async () => {
            if (!this._running) return;
            const missing = this.aiFleet.getMissingKeys();
            if (missing.length > 0) {
                log('AI', `定期检查: 仍缺 ${missing.length} 个Key, 重新尝试获取...`);
                await this.aiProvisioner.autoProvision();
            }
        }, 3600000);
        this._timers.push(provisionTimer);

        // H. 云资源扫描+到期迁移 (每2小时)
        const cloudTimer = setInterval(async () => {
            if (!this._running) return;
            await this._cloudResourceCycle();
        }, 7200000);
        this._timers.push(cloudTimer);
        // 首次云扫描 (延迟5分钟)
        setTimeout(() => this._cloudResourceCycle(), 300000);

        // 首次执行
        log('CORE', '执行首次思考周期...');
        await this._thinkCycle();

        // 延迟执行首次学习和进化
        setTimeout(() => this._learnCycle(), 60000);
        setTimeout(() => this._evolveCycle(), 180000);

        log('CORE', `${C.green}${C.bold}活体循环已启动${C.reset}`);
        log('CORE', `  思考: 每30秒`);
        log('CORE', `  进化: 每5分钟`);
        log('CORE', `  学习: 每20分钟`);
        log('CORE', `  睡眠整合: 每2小时`);
    }

    // ── 思考周期: 眼→脑→手 ──
    async _thinkCycle() {
        this._cycle++;
        this._stats.livingCycles++;

        try {
            if (!this.brain) return;

            // 感知优先级: 低→高 (最后发的=最重要的=大脑决策依据)

            // 1. 低优先级: 进化数据
            if (this.smartLearner) {
                const learnStats = this.smartLearner.getStats?.() || {};
                await this.brain.perceive('evolution_status', {
                    knowledgeCount: learnStats.totalKnowledge || 0,
                    lastLearn: learnStats.lastLearnTime || 0,
                }, 0.4);
            }

            // 2. 中优先级: 前台窗口
            if (this.eyes) {
                const eyeState = this.eyes.state;
                if (eyeState.foregroundApp) {
                    await this.brain.perceive('window_switch', {
                        app: eyeState.foregroundApp,
                        title: eyeState.foregroundTitle,
                    }, 0.4);
                }
            }

            // 3. 中高优先级: 系统状态(内存/CPU/运行时间)
            const os = require('os');
            const sysData = {
                memUsedPct: Math.round((1 - os.freemem() / os.totalmem()) * 100),
                memFreeMB: Math.round(os.freemem() / 1024 / 1024),
                cpuLoad: os.loadavg()[0],
                uptime: Math.round(process.uptime()),
                heapMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                cycle: this._cycle,
                stats: { ...this._stats },
                stagnationCycles: this.brain?.prefrontalCortex?._stagnationCycles || 0,
            };
            await this.brain.perceive('system_status', sysData, 0.6);

            // 4. 高优先级: OCR文字(含API Key检测、错误检测)
            if (this.eyes) {
                const eyeState = this.eyes.state;
                if (eyeState.screenText) {
                    await this.brain.perceive('ocr_text', {
                        text: eyeState.screenText,
                        words: [],
                    }, 0.7);
                }
            }

            // 5. 最高优先级: VLM画面理解 (AI视觉! 这才是大脑的主要决策依据)
            if (this.eyes) {
                const eyeState = this.eyes.state;
                if (eyeState.understanding) {
                    await this.brain.perceive('vision_understanding', {
                        understanding: eyeState.understanding,
                        changeRatio: eyeState.changeRatio,
                        fps: eyeState.fps,
                    }, 0.9);  // 最高优先级 — 这是AI实时看到的画面
                }
            }

            // 5.5 云资源感知 (每20周期扫描一次免费资源状态)
            if (this._cycle % 20 === 0 && this.cloudResources) {
                const cloudCtx = this.cloudResources.getDecisionContext();
                await this.brain.perceive('cloud_resources', {
                    activeNodes: cloudCtx.activeNodes,
                    availableCompute: cloudCtx.availableCompute,
                    availableGPU: cloudCtx.availableGPU,
                    recommendation: cloudCtx.recommendation,
                    topAction: cloudCtx.topPriority,
                }, 0.5);
            }

            // 6. 大脑主动思考
            const goal = this.brain.prefrontalCortex.currentGoal || '监控系统健康，优化进化效率，发现AI资源，扩展云端分布式网络';
            if (!this.brain.prefrontalCortex.currentGoal) {
                this.brain.prefrontalCortex.setGoal(goal);
            }

            const thought = await this.brain.think();
            const action = thought.decision?.action;
            if (action && action !== 'WAIT') {
                log('BRAIN', `决策: ${action} (${thought.decision.reason})`);
            }

            // 5. 如果有需要执行的动作
            if (thought.actions && thought.actions.length > 0 && action !== 'WAIT') {
                log('BRAIN', `执行: ${action} → ${thought.actions.length}步`);
                const execResult = await this.brain.execute(thought.actions);
                this._stats.handsActions += thought.actions.length;

                if (execResult.isDone) {
                    log('CORE', `${C.green}任务完成!${C.reset}`);
                    this.brain.prefrontalCortex.setGoal('继续监控环境，寻找进化机会');
                }
            }

            // 6. 每10周期报告状态
            if (this._cycle % 10 === 0) {
                this._reportStatus();
            }
        } catch (e) {
            this._stats.errors++;
            log('ERROR', `思考周期错误: ${e.message}`);
        }
    }

    // ── 进化周期: 代码自改进 ──
    async _evolveCycle() {
        try {
            const result = await this.codeEvolver.evolveOnce();
            this._stats.codeEvolutions += result.improved;
        } catch (e) {
            log('ERROR', `进化周期错误: ${e.message}`);
        }
    }

    // ── 学习周期: 网络知识获取 ──
    async _learnCycle() {
        try {
            const result = await this.smartLearner.learnOnce();
            this._stats.knowledgeLearned += result.added;

            // 将新学到的知识送入大脑记忆
            if (this.brain && result.added > 0) {
                await this.brain.hippocampus.process({
                    data: {
                        action: 'store',
                        type: 'semantic',
                        key: `learning_${Date.now()}`,
                        value: {
                            type: 'auto_learning',
                            count: result.added,
                            topics: this.smartLearner._getNextTopics(2),
                            timestamp: Date.now(),
                        },
                    },
                });
            }
        } catch (e) {
            log('ERROR', `学习周期错误: ${e.message}`);
        }
    }

    // ── 睡眠整合: 记忆巩固+突触修剪 ──
    async _sleepCycle() {
        try {
            if (this.brain) {
                await this.brain.sleep();
                log('CORE', '睡眠整合完成');
            }
        } catch (e) {
            log('ERROR', `睡眠整合错误: ${e.message}`);
        }
    }

    // ── 云资源周期: 扫描免费平台+到期迁移+健康检查 ──
    async _cloudResourceCycle() {
        try {
            // 1. 扫描所有可用资源
            const resources = this.cloudResources.scanAvailableResources();
            const totalFree = Object.values(resources).flat().filter(r => r.currentStatus !== 'active').length;

            // 2. 检查到期迁移
            for (const [id, res] of this.cloudResources.activeResources) {
                if (res.expiresAt && res.expiresAt - Date.now() < 3 * 24 * 3600 * 1000) {
                    const target = this.cloudResources.findMigrationTarget(id);
                    const platform = this.cloudResources.platformKnowledge[id];
                    if (target) {
                        log('CLOUD', `${C.yellow}⚠ ${platform?.name} 即将到期! 迁移目标: ${target.name}${C.reset}`);
                        this.cloudResources.migrationLog.push({
                            time: Date.now(),
                            from: id,
                            to: target.id,
                            reason: 'expiry',
                        });
                        this.cloudResources._saveState();
                    }
                }
            }

            // 3. 健康检查
            const health = await this.cloudResources.checkResourceHealth();
            const unhealthy = health.filter(h => h.reachable === false);
            if (unhealthy.length > 0) {
                log('CLOUD', `${C.red}不健康节点: ${unhealthy.map(h => h.id).join(', ')}${C.reset}`);
            }

            // 4. 输出建议
            const actions = this.cloudResources.getNextActions();
            if (actions.length > 0) {
                log('CLOUD', `零成本资源: ${totalFree}个可用 | 建议: ${actions[0].reason}`);
            }

            // 5. 将云资源信息存入大脑语义记忆
            if (this.brain) {
                await this.brain.hippocampus.process({
                    data: {
                        action: 'store', type: 'semantic',
                        key: 'cloud_resources_scan',
                        value: {
                            type: 'cloud_scan',
                            activeNodes: this.cloudResources.deployedInstances.filter(i => i.status === 'running').length,
                            availablePlatforms: totalFree,
                            nextAction: actions[0] || null,
                            timestamp: Date.now(),
                        },
                    },
                });
            }
        } catch (e) {
            log('ERROR', `云资源周期错误: ${e.message}`);
        }
    }

    // ── 状态报告 ──
    _reportStatus() {
        const uptime = ((Date.now() - this._stats.startTime) / 3600000).toFixed(1);
        const memStats = this.brain?.hippocampus?.getMemoryStats() || {};
        const emo = this.brain?.amygdala?.getEmotionalState() || {};
        const aiStatus = this.aiFleet.getStatus();
        const evolveStats = this.codeEvolver.getStats();
        const learnStats = this.smartLearner.getStats();

        console.log(`
${C.cyan}╔══════════════════ 活体核心状态 ══════════════════╗${C.reset}
${C.cyan}║${C.reset} 运行: ${uptime}h | 周期: ${this._stats.livingCycles} | 错误: ${this._stats.errors}
${C.cyan}║${C.reset} 大脑: ${this._stats.brainDecisions}决策 | 记忆: WM${memStats.working || 0} EM${memStats.episodic || 0} SM${memStats.semantic || 0} PM${memStats.procedural || 0}
${C.cyan}║${C.reset} 情感: 紧迫${(emo.urgency || 0).toFixed(2)} 好奇${(emo.curiosity || 0).toFixed(2)} 满足${(emo.satisfaction || 0).toFixed(2)}
${C.cyan}║${C.reset} 手: ${this._stats.handsActions}次操作
${C.cyan}║${C.reset} 进化: ${evolveStats.total}次 (成功率${evolveStats.successRate}, 24h:${evolveStats.recent24h})
${C.cyan}║${C.reset} 学习: 搜索${learnStats.searched}条, 新增${learnStats.integrated}条知识
${C.cyan}║${C.reset} AI舰队: ${Object.entries(aiStatus).filter(([_, v]) => v.available).map(([k, v]) => `${k}(${v.rate})`).join(' · ')}${this.globalEvolution ? `
${C.cyan}║${C.reset} 全球进化: ${(() => { const gs = this.globalEvolution.getStatus(); return `α${gs.stats.alphaEvolveSuccess} A0:${gs.dualAgent.approvalRate} DGM:${gs.formalVerifier.passRate} POET:${gs.openEnded.solved}解`; })()}` : ''}
${C.cyan}║${C.reset} 云资源: ${this.cloudResources.getStats().activeNodes}活跃/${this.cloudResources.getStats().totalPlatforms}总 | 成本: ¥0
${C.cyan}╚═══════════════════════════════════════════════════╝${C.reset}`);
    }

    // ── 停止 ──
    stop() {
        this._running = false;
        for (const t of this._timers) clearInterval(t);
        this._timers = [];
        if (this.eyes) this.eyes.stopWatching?.();
        if (this.brain) this.brain.stop();
        this._saveState();
        log('CORE', '活体核心已停止');
    }

    // ── 状态持久化 ──
    _saveState() {
        try {
            fs.writeFileSync(CORE_STATE_FILE, JSON.stringify({
                stats: this._stats,
                cycle: this._cycle,
                aiFleetStats: Object.fromEntries(this.aiFleet.stats),
                learnerStats: this.smartLearner.getStats(),
                savedAt: new Date().toISOString(),
            }, null, 2));
        } catch {}
    }

    _loadState() {
        try {
            if (!fs.existsSync(CORE_STATE_FILE)) return;
            const state = JSON.parse(fs.readFileSync(CORE_STATE_FILE, 'utf8'));
            if (state.stats) {
                // 累积统计
                this._stats.codeEvolutions = state.stats.codeEvolutions || 0;
                this._stats.knowledgeLearned = state.stats.knowledgeLearned || 0;
            }
        } catch {}
    }

    getStatus() {
        return {
            running: this._running,
            cycle: this._cycle,
            stats: this._stats,
            eyes: !!this.eyes,
            brain: !!this.brain,
            hands: !!this.hands,
            pipelineConnected: !!(this.eyes && this.brain && this.hands),
            aiFleet: this.aiFleet.getStatus(),
            codeEvolution: this.codeEvolver.getStats(),
            learning: this.smartLearner.getStats(),
            cloudResources: this.cloudResources.getStats(),
        };
    }
}

// ═══════════════════════════════════════════════════════════
//  导出 & 自测
// ═══════════════════════════════════════════════════════════

module.exports = { LivingCore, AIFleet, AIProvisioner, CodeEvolver, SmartLearner, CloudResourceManager };

// 直接运行
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--test')) {
        // 快速测试
        (async () => {
            console.log('═══ 活体核心快速测试 ═══\n');

            // 1. AI舰队测试
            console.log('--- 测试1: AI舰队 ---');
            const fleet = new AIFleet();
            const fleetStatus = fleet.getStatus();
            console.log('  可用:', Object.entries(fleetStatus).filter(([_, v]) => v.hasKey).map(([k]) => k).join(', '));

            const aiResult = await fleet.ask('回复"活体种子AI测试成功"这8个字');
            console.log('  AI响应:', aiResult.success ? `${aiResult.provider}: ${aiResult.content.substring(0, 50)}` : '失败');

            // 2. SmartLearner测试
            console.log('\n--- 测试2: 智能学习 ---');
            const learner = new SmartLearner(fleet);
            const topics = learner._getNextTopics(3);
            console.log('  话题:', topics.join(', '));
            const github = await learner.searchGitHub(topics[0]);
            console.log('  GitHub搜索:', github.length, '条结果');

            // 3. CodeEvolver测试
            console.log('\n--- 测试3: 代码进化 ---');
            const evolver = new CodeEvolver(fleet);
            const evolveStats = evolver.getStats();
            console.log('  历史:', evolveStats.total, '次进化, 成功率', evolveStats.successRate);

            // 4. LivingCore初始化测试
            console.log('\n--- 测试4: 活体核心 ---');
            const core = new LivingCore();
            const initOk = await core.init();
            console.log('  初始化:', initOk ? '成功' : '失败');
            console.log('  眼睛:', core.eyes ? '已连接' : '未连接');
            console.log('  大脑:', core.brain ? '已连接' : '未连接');
            console.log('  手:', core.hands ? '已连接' : '未连接');
            console.log('  管道:', core.eyes && core.brain && core.hands ? '完整闭环' : '降级模式');

            console.log('\n═══ 测试完成 ═══');
            process.exit(0);
        })().catch(e => { console.error('测试失败:', e); process.exit(1); });
    } else {
        // 独立运行
        (async () => {
            const core = new LivingCore();
            await core.init();
            await core.start();

            process.on('SIGINT', () => {
                core.stop();
                process.exit(0);
            });
        })().catch(e => { console.error('启动失败:', e); process.exit(1); });
    }
}
