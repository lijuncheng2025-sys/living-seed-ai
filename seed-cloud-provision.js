/**
 * 活体种子AI - 云资源自动供应执行器 v1.0
 *
 * 本地种子大脑的"手" — 用浏览器Agent自动完成:
 * 1. 打开Colab/Kaggle GPU Notebook并运行
 * 2. 注册免费平台(Groq/Cohere/Together/Lightning/Kaggle)
 * 3. 获取API Key并保存
 * 4. 回报结果给云端
 *
 * 与 seed-cloud-deploy/start-cloud.js 的 GPUAutoProvisioner 配合:
 *   云端: 生成任务队列 → 推送到GitHub/文件
 *   本地: 读取任务 → 浏览器执行 → 回报结果
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const C = {
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
    blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
    reset: '\x1b[0m', bold: '\x1b[1m',
};

class CloudProvisionExecutor {
    constructor() {
        this._agent = null;       // BrowserAgent 实例 (懒加载)
        this._agentReady = false;
        this._running = false;
        this._interval = null;
        this._stats = {
            totalExecuted: 0,
            success: 0,
            failed: 0,
            keysObtained: [],
            colabLaunched: false,
            kaggleLaunched: false,
            lastRun: null,
        };

        // 路径
        this._cloudDeployDir = path.join(__dirname, '..', 'seed-cloud-deploy');
        this._taskFile = path.join(this._cloudDeployDir, 'browser-tasks.json');
        this._credFile = path.join(this._cloudDeployDir, 'cloud-credentials.json');
        this._keysFile = path.join(__dirname, 'ai-keys.json');
        this._resultFile = path.join(__dirname, 'cloud-provision-results.json');

        // GitHub配置
        this._ghToken = '';
        this._ghRepo = 'lijuncheng2025-sys/living-seed-ai';
        this._loadGHToken();

        // 凭据 (用于登录)
        this._credentials = this._loadCredentials();
    }

    _loadGHToken() {
        try {
            const keys = JSON.parse(fs.readFileSync(this._keysFile, 'utf8'));
            this._ghToken = keys.github_token || '';
        } catch {}
    }

    _loadCredentials() {
        // 从credentials.json加载Google账户等信息
        const creds = {};
        try {
            const credPath = path.join(__dirname, 'credentials.json');
            if (fs.existsSync(credPath)) {
                const data = JSON.parse(fs.readFileSync(credPath, 'utf8'));
                if (data.google) creds.google = data.google;
                if (data.accounts) creds.accounts = data.accounts;
                if (data.email) creds.email = data.email;
                if (data.password) creds.password = data.password;
            }
        } catch {}
        return creds;
    }

    // ═══════════════════════════════════════
    //  浏览器Agent 懒加载
    // ═══════════════════════════════════════

    async _ensureAgent() {
        if (this._agentReady && this._agent) return true;

        try {
            const { BrowserAgent } = require('./seed-browser-agent');
            this._agent = new BrowserAgent({ headless: false, verbose: 1 });
            await this._agent.init();
            this._agentReady = true;
            console.log(`${C.green}[CloudProvision]${C.reset} 浏览器Agent已启动`);
            return true;
        } catch (e) {
            console.log(`${C.yellow}[CloudProvision]${C.reset} 浏览器Agent启动失败: ${e.message.substring(0, 80)}`);
            this._agentReady = false;
            return false;
        }
    }

    // ═══════════════════════════════════════
    //  主执行入口
    // ═══════════════════════════════════════

    async executeProvisioning() {
        console.log(`${C.magenta}[CloudProvision]${C.reset} ═══ 开始云资源供应执行 ═══`);
        this._stats.lastRun = new Date().toISOString();

        // 1. 读取任务队列
        const tasks = this._loadTasks();
        const pendingTasks = tasks.filter(t => t.status === 'pending');

        if (pendingTasks.length === 0) {
            console.log(`${C.cyan}[CloudProvision]${C.reset} 无待处理任务`);
            // 即使没有云端任务，也尝试自主获取缺失的API Key
            await this._autoGetMissingKeys();
            return;
        }

        console.log(`${C.cyan}[CloudProvision]${C.reset} ${pendingTasks.length}个待处理任务`);

        // 2. 确保浏览器Agent可用
        const agentOk = await this._ensureAgent();
        if (!agentOk) {
            console.log(`${C.yellow}[CloudProvision]${C.reset} 浏览器不可用，跳过本轮`);
            return;
        }

        // 3. 按优先级排序执行
        const sorted = pendingTasks.sort((a, b) => {
            const prio = { high: 0, medium: 1, low: 2 };
            return (prio[a.priority] || 1) - (prio[b.priority] || 1);
        });

        for (const task of sorted) {
            try {
                console.log(`${C.cyan}[CloudProvision]${C.reset} 执行: ${task.type}`);
                const result = await this._executeTask(task);

                // 标记完成
                task.status = 'completed';
                task.completedAt = new Date().toISOString();
                task.result = result;
                this._stats.totalExecuted++;

                if (result.ok) {
                    this._stats.success++;
                    console.log(`${C.green}[CloudProvision]${C.reset} ✓ ${task.type} 完成`);
                } else {
                    this._stats.failed++;
                    console.log(`${C.yellow}[CloudProvision]${C.reset} ✗ ${task.type}: ${result.reason || 'failed'}`);
                }
            } catch (e) {
                task.status = 'completed';
                task.result = { ok: false, error: e.message };
                this._stats.failed++;
                console.log(`${C.red}[CloudProvision]${C.reset} 执行异常 ${task.type}: ${e.message.substring(0, 60)}`);
            }
        }

        // 4. 保存结果
        this._saveTasks(tasks);
        this._saveResults();

        // 5. 回报给云端
        await this._reportToCloud();

        console.log(`${C.magenta}[CloudProvision]${C.reset} 本轮完成: 成功${this._stats.success} 失败${this._stats.failed}`);
    }

    // ═══════════════════════════════════════
    //  任务执行路由
    // ═══════════════════════════════════════

    async _executeTask(task) {
        switch (task.type) {
            case 'auto_open_colab':
                return await this._executeColabDeploy(task);
            case 'auto_import_kaggle':
                return await this._executeKaggleDeploy(task);
            case 'register_kaggle':
                return await this._executeRegisterKaggle(task);
            case 'register_groq':
                return await this._executeGetApiKey('groq', task);
            case 'register_cohere':
                return await this._executeGetApiKey('cohere', task);
            case 'register_together':
                return await this._executeGetApiKey('together', task);
            case 'register_lightning':
                return await this._executeRegisterLightning(task);
            case 'register_huggingface':
                return await this._executeGetApiKey('huggingface', task);
            default:
                // 通用步骤执行
                return await this._executeGenericSteps(task);
        }
    }

    // ═══════════════════════════════════════
    //  Colab GPU 自动部署
    // ═══════════════════════════════════════

    async _executeColabDeploy(task) {
        const url = task.url || `https://colab.research.google.com/github/${this._ghRepo}/blob/main/seed-colab-gpu.ipynb`;

        await this._agent.goto(url);
        await this._agent.sleep(5000);

        // 检查是否需要登录Google
        const pageState = await this._agent.detectPageState();
        if (pageState.isLoginPage || !pageState.isLoggedIn) {
            const creds = this._credentials.google || this._credentials;
            if (creds.email && creds.password) {
                console.log(`${C.cyan}[CloudProvision]${C.reset} Colab需要Google登录...`);
                await this._agent.googleLogin(creds.email, creds.password);
                await this._agent.sleep(3000);
                await this._agent.goto(url);
                await this._agent.sleep(5000);
            } else {
                return { ok: false, reason: 'need_google_login', url };
            }
        }

        // 点击"全部运行"
        try {
            // Colab的"Run All"在Runtime菜单下
            await this._agent.act('click "Runtime" menu or "运行时" menu');
            await this._agent.sleep(1000);
            await this._agent.act('click "Run all" or "全部运行"');
            await this._agent.sleep(2000);

            // 可能弹出GPU确认对话框
            try {
                await this._agent.act('click "Run anyway" or "仍然运行" or "OK" or "确定"');
            } catch {}

            this._stats.colabLaunched = true;
            console.log(`${C.green}[CloudProvision]${C.reset} Colab GPU Notebook已启动运行!`);
            return { ok: true, url, platform: 'colab', action: 'run_all' };
        } catch (e) {
            return { ok: false, reason: 'run_all_failed', error: e.message };
        }
    }

    // ═══════════════════════════════════════
    //  Kaggle GPU 自动部署
    // ═══════════════════════════════════════

    async _executeKaggleDeploy(task) {
        const url = task.url || `https://www.kaggle.com/kernels/welcome?src=https://github.com/${this._ghRepo}/blob/main/seed-kaggle-gpu.ipynb`;

        await this._agent.goto(url);
        await this._agent.sleep(5000);

        // 检查登录
        const pageState = await this._agent.detectPageState();
        if (pageState.isLoginPage || !pageState.isLoggedIn) {
            // 尝试Google登录
            try {
                await this._agent.act('click "Sign in with Google" or Google login button');
                const creds = this._credentials.google || this._credentials;
                if (creds.email && creds.password) {
                    await this._agent.googleLogin(creds.email, creds.password);
                    await this._agent.sleep(3000);
                    await this._agent.goto(url);
                    await this._agent.sleep(5000);
                }
            } catch {
                return { ok: false, reason: 'need_kaggle_login' };
            }
        }

        // 启用GPU加速器
        try {
            await this._agent.act('click GPU accelerator toggle or settings gear');
            await this._agent.sleep(1000);
            await this._agent.act('select "GPU T4 x2" or enable GPU');
            await this._agent.sleep(1000);
        } catch {}

        // 运行全部
        try {
            await this._agent.act('click "Run All" button');
            await this._agent.sleep(2000);
            this._stats.kaggleLaunched = true;
            console.log(`${C.green}[CloudProvision]${C.reset} Kaggle GPU Notebook已启动运行!`);
            return { ok: true, url, platform: 'kaggle', action: 'run_all' };
        } catch (e) {
            return { ok: false, reason: 'run_failed', error: e.message };
        }
    }

    // ═══════════════════════════════════════
    //  API Key 自动获取 (利用BrowserAgent内置方法)
    // ═══════════════════════════════════════

    async _executeGetApiKey(provider, task) {
        const creds = this._credentials.google || this._credentials;
        if (!creds.email || !creds.password) {
            return { ok: false, reason: 'no_credentials' };
        }

        try {
            let key = null;

            switch (provider) {
                case 'groq':
                    key = await this._agent.getGroqApiKey(creds.email, creds.password);
                    break;
                case 'cohere':
                    key = await this._agent.getCohereApiKey(creds.email, creds.password);
                    break;
                case 'together':
                    key = await this._agent.getTogetherApiKey(creds.email, creds.password);
                    break;
                case 'huggingface':
                    key = await this._agent.getHuggingFaceToken(creds.email, creds.password);
                    break;
                default:
                    return { ok: false, reason: 'unknown_provider' };
            }

            if (key) {
                this._saveApiKey(provider, key);
                this._stats.keysObtained.push(provider);
                console.log(`${C.green}[CloudProvision]${C.reset} ✓ ${provider} API Key已获取并保存`);
                return { ok: true, provider, credentials: { [`${provider}_api_key`]: key } };
            }

            return { ok: false, reason: 'key_not_found' };
        } catch (e) {
            return { ok: false, reason: 'extraction_failed', error: e.message };
        }
    }

    // ═══════════════════════════════════════
    //  Kaggle 注册 + 获取API Key
    // ═══════════════════════════════════════

    async _executeRegisterKaggle(task) {
        const creds = this._credentials.google || this._credentials;

        await this._agent.goto('https://www.kaggle.com/account/login');
        await this._agent.sleep(3000);

        // Google登录
        try {
            await this._agent.act('click "Sign in with Google" or "Register with Google"');
            await this._agent.sleep(2000);

            if (creds.email && creds.password) {
                await this._agent.googleLogin(creds.email, creds.password);
                await this._agent.sleep(5000);
            }
        } catch (e) {
            return { ok: false, reason: 'google_login_failed', error: e.message };
        }

        // 获取API Token
        try {
            await this._agent.goto('https://www.kaggle.com/settings/account');
            await this._agent.sleep(3000);

            // 寻找"Create New Token"按钮
            await this._agent.act('scroll down');
            await this._agent.sleep(1000);
            await this._agent.act('click "Create New API Token" or "Create New Token"');
            await this._agent.sleep(3000);

            // kaggle.json 会自动下载，尝试读取
            const kaggleJsonPaths = [
                path.join(process.env.USERPROFILE || '', 'Downloads', 'kaggle.json'),
                path.join(process.env.USERPROFILE || '', '.kaggle', 'kaggle.json'),
            ];

            for (const kp of kaggleJsonPaths) {
                if (fs.existsSync(kp)) {
                    try {
                        const kaggleData = JSON.parse(fs.readFileSync(kp, 'utf8'));
                        if (kaggleData.username && kaggleData.key) {
                            this._saveCloudCredential('kaggle_username', kaggleData.username);
                            this._saveCloudCredential('kaggle_key', kaggleData.key);
                            console.log(`${C.green}[CloudProvision]${C.reset} Kaggle API Token已获取: ${kaggleData.username}`);
                            return {
                                ok: true, provider: 'kaggle',
                                credentials: { kaggle_username: kaggleData.username, kaggle_key: kaggleData.key }
                            };
                        }
                    } catch {}
                }
            }

            return { ok: false, reason: 'kaggle_token_not_found' };
        } catch (e) {
            return { ok: false, reason: 'kaggle_api_failed', error: e.message };
        }
    }

    // ═══════════════════════════════════════
    //  Lightning.ai 注册
    // ═══════════════════════════════════════

    async _executeRegisterLightning(task) {
        await this._agent.goto('https://lightning.ai/sign-up');
        await this._agent.sleep(3000);

        try {
            // GitHub登录
            await this._agent.act('click "Continue with GitHub" or GitHub login button');
            await this._agent.sleep(5000);

            // 检查是否需要授权
            const pageText = await this._agent.getPageText();
            if (pageText.includes('Authorize') || pageText.includes('授权')) {
                await this._agent.act('click "Authorize" button');
                await this._agent.sleep(5000);
            }

            // 获取API Key
            await this._agent.goto('https://lightning.ai/account/api-keys');
            await this._agent.sleep(3000);
            await this._agent.act('click "Create new key" or "New API key"');
            await this._agent.sleep(2000);

            const extracted = await this._agent.extract('Extract the API key text');
            if (extracted) {
                this._saveCloudCredential('lightning_token', extracted);
                return { ok: true, provider: 'lightning', credentials: { lightning_token: extracted } };
            }

            return { ok: false, reason: 'lightning_key_not_found' };
        } catch (e) {
            return { ok: false, reason: 'lightning_failed', error: e.message };
        }
    }

    // ═══════════════════════════════════════
    //  通用步骤执行器
    // ═══════════════════════════════════════

    async _executeGenericSteps(task) {
        if (!task.steps || task.steps.length === 0) {
            return { ok: false, reason: 'no_steps' };
        }

        for (const step of task.steps) {
            try {
                switch (step.action) {
                    case 'navigate':
                        await this._agent.goto(step.url);
                        break;
                    case 'wait':
                        await this._agent.sleep(step.ms || 2000);
                        break;
                    case 'click':
                        await this._agent.act(`click ${step.selector}`);
                        break;
                    case 'fill_form':
                        for (const [field, value] of Object.entries(step.fields || {})) {
                            const v = value === 'auto' ? (this._credentials.email || '') : value;
                            await this._agent.act(`type "${v}" into ${field} field`);
                        }
                        break;
                    case 'extract':
                        const text = await this._agent.extract(`Extract ${step.selector}`);
                        if (text && step.save_as) {
                            this._saveCloudCredential(step.save_as, text);
                        }
                        break;
                    case 'google_auth':
                        const creds = this._credentials.google || this._credentials;
                        if (creds.email && creds.password) {
                            await this._agent.googleLogin(creds.email, creds.password);
                        }
                        break;
                    case 'github_auth':
                        // GitHub OAuth通常自动通过(已登录)
                        await this._agent.sleep(3000);
                        break;
                }
                await this._agent.sleep(1000);
            } catch (e) {
                console.log(`${C.yellow}[CloudProvision]${C.reset} 步骤 ${step.action} 失败: ${e.message.substring(0, 40)}`);
            }
        }

        return { ok: true, stepsExecuted: task.steps.length };
    }

    // ═══════════════════════════════════════
    //  自主获取缺失的API Key (无需云端任务)
    // ═══════════════════════════════════════

    async _autoGetMissingKeys() {
        // 检查哪些Key缺失
        let existingKeys = {};
        try {
            existingKeys = JSON.parse(fs.readFileSync(this._keysFile, 'utf8'));
        } catch {}

        const missing = [];
        if (!existingKeys.groq_api_key) missing.push('groq');
        if (!existingKeys.cohere_api_key) missing.push('cohere');
        if (!existingKeys.together_api_key) missing.push('together');

        if (missing.length === 0) {
            console.log(`${C.green}[CloudProvision]${C.reset} 所有已知免费API Key已配置`);
            return;
        }

        console.log(`${C.cyan}[CloudProvision]${C.reset} 缺失${missing.length}个免费API Key: ${missing.join(', ')}`);

        // 利用BrowserAgent的getAllApiKeys方法
        const creds = this._credentials.google || this._credentials;
        if (!creds.email || !creds.password) {
            console.log(`${C.yellow}[CloudProvision]${C.reset} 无Google凭据，无法自动获取Key`);
            return;
        }

        const agentOk = await this._ensureAgent();
        if (!agentOk) return;

        try {
            console.log(`${C.cyan}[CloudProvision]${C.reset} 启动自动API Key获取...`);
            const keys = await this._agent.getAllApiKeys({
                email: creds.email,
                password: creds.password,
            });

            if (keys && typeof keys === 'object') {
                let saved = 0;
                for (const [provider, key] of Object.entries(keys)) {
                    if (key && typeof key === 'string' && key.length > 5) {
                        this._saveApiKey(provider, key);
                        saved++;
                    }
                }
                console.log(`${C.green}[CloudProvision]${C.reset} 自动获取: ${saved}个新API Key`);
            }
        } catch (e) {
            console.log(`${C.yellow}[CloudProvision]${C.reset} 自动获取Key异常: ${e.message.substring(0, 60)}`);
        }
    }

    // ═══════════════════════════════════════
    //  数据持久化
    // ═══════════════════════════════════════

    _loadTasks() {
        // 优先读取本地文件
        if (fs.existsSync(this._taskFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(this._taskFile, 'utf8'));
                return data.pending || [];
            } catch {}
        }
        return [];
    }

    _saveTasks(tasks) {
        try {
            fs.writeFileSync(this._taskFile, JSON.stringify({
                updatedAt: new Date().toISOString(),
                pending: tasks.filter(t => t.status === 'pending'),
                completed: tasks.filter(t => t.status === 'completed').slice(-20),
            }, null, 2));
        } catch {}
    }

    _saveApiKey(provider, key) {
        try {
            let keys = {};
            if (fs.existsSync(this._keysFile)) {
                keys = JSON.parse(fs.readFileSync(this._keysFile, 'utf8'));
            }
            keys[`${provider}_api_key`] = key;
            keys.updatedAt = new Date().toISOString();
            fs.writeFileSync(this._keysFile, JSON.stringify(keys, null, 4));
            console.log(`${C.green}[CloudProvision]${C.reset} Key已保存: ${provider}`);
        } catch (e) {
            console.log(`${C.yellow}[CloudProvision]${C.reset} Key保存失败: ${e.message}`);
        }
    }

    _saveCloudCredential(key, value) {
        try {
            let creds = {};
            if (fs.existsSync(this._credFile)) {
                creds = JSON.parse(fs.readFileSync(this._credFile, 'utf8'));
            }
            creds[key] = value;
            creds.updatedAt = new Date().toISOString();
            fs.writeFileSync(this._credFile, JSON.stringify(creds, null, 2));
        } catch {}
    }

    _saveResults() {
        try {
            fs.writeFileSync(this._resultFile, JSON.stringify({
                ...this._stats,
                savedAt: new Date().toISOString(),
            }, null, 2));
        } catch {}
    }

    // ═══════════════════════════════════════
    //  回报给云端 (推送到GitHub)
    // ═══════════════════════════════════════

    async _reportToCloud() {
        if (!this._ghToken) return;

        try {
            // 将获取的Key作为GitHub Secrets设置
            for (const provider of this._stats.keysObtained) {
                let keys = {};
                try { keys = JSON.parse(fs.readFileSync(this._keysFile, 'utf8')); } catch {}
                const keyValue = keys[`${provider}_api_key`];
                if (keyValue) {
                    await this._setGitHubSecret(`${provider.toUpperCase()}_API_KEY`, keyValue);
                }
            }
        } catch (e) {
            console.log(`${C.yellow}[CloudProvision]${C.reset} 云端回报异常: ${e.message.substring(0, 60)}`);
        }
    }

    async _setGitHubSecret(name, value) {
        try {
            // 获取公钥
            const keyData = await this._ghAPI('GET', `/repos/${this._ghRepo}/actions/secrets/public-key`);
            if (!keyData?.key_id || !keyData?.key) return;

            // 加密 (需要libsodium)
            let sodium;
            try { sodium = require('libsodium-wrappers'); } catch { return; }
            await sodium.ready;

            const pubKey = sodium.from_base64(keyData.key, sodium.base64_variants.ORIGINAL);
            const msgBytes = sodium.from_string(value);
            const encrypted = sodium.crypto_box_seal(msgBytes, pubKey);
            const b64 = sodium.to_base64(encrypted, sodium.base64_variants.ORIGINAL);

            await this._ghAPI('PUT', `/repos/${this._ghRepo}/actions/secrets/${name}`, {
                encrypted_value: b64,
                key_id: keyData.key_id,
            });
            console.log(`${C.green}[CloudProvision]${C.reset} GitHub Secret已更新: ${name}`);
        } catch {}
    }

    _ghAPI(method, endpoint, body) {
        return new Promise((resolve) => {
            const data = body ? JSON.stringify(body) : null;
            const opts = {
                hostname: 'api.github.com', path: endpoint, method,
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
            const req = https.request(opts, (res) => {
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

    // ═══════════════════════════════════════
    //  启动/停止/状态
    // ═══════════════════════════════════════

    start(intervalMs = 30 * 60 * 1000) {
        if (this._running) return;
        this._running = true;
        console.log(`${C.magenta}[CloudProvision]${C.reset} 启动, 间隔${intervalMs / 60000}分钟`);

        // 首次延迟2分钟执行(让其他模块先启动)
        setTimeout(async () => {
            await this.executeProvisioning();

            this._interval = setInterval(async () => {
                try {
                    await this.executeProvisioning();
                } catch (e) {
                    console.log(`${C.red}[CloudProvision]${C.reset} 执行错误: ${e.message.substring(0, 60)}`);
                }
            }, intervalMs);
        }, 120000);
    }

    stop() {
        this._running = false;
        if (this._interval) clearInterval(this._interval);
        if (this._agent) {
            try { this._agent.close(); } catch {}
        }
    }

    getStats() {
        return {
            ...this._stats,
            running: this._running,
            agentReady: this._agentReady,
        };
    }
}

module.exports = { CloudProvisionExecutor };

// 独立运行模式
if (require.main === module) {
    console.log(`\n${C.magenta}═══ 云资源供应执行器 - 独立模式 ═══${C.reset}\n`);
    const executor = new CloudProvisionExecutor();
    executor.executeProvisioning().then(() => {
        console.log(`\n${C.green}执行完成${C.reset}`);
        console.log('Stats:', JSON.stringify(executor.getStats(), null, 2));
        process.exit(0);
    }).catch(e => {
        console.error('Error:', e);
        process.exit(1);
    });
}
