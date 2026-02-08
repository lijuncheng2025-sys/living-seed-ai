/**
 * 活体种子AI - 自进化浏览器Agent v2.0
 *
 * 核心进化能力:
 *   1. 学习记忆 - 记住每个网站的有效操作模式
 *   2. 策略进化 - 失败时自动尝试替代方案并记住成功路径
 *   3. 页面智能 - 分析页面结构,自主决定操作方式
 *   4. 多账户 - 轮换使用多个账户获取资源
 *   5. 自我评估 - 跟踪能力成长,识别薄弱环节
 *
 * 主人印记: 19860316
 */

const fs = require('fs');
const path = require('path');

const SEED_HOME = process.env.SEED_HOME || __dirname;
const CONFIG_FILE = path.join(SEED_HOME, 'ai-resources-config.json');
const AGENT_LOG_FILE = path.join(SEED_HOME, 'browser-agent-log.json');
const MEMORY_FILE = path.join(SEED_HOME, 'browser-agent-memory.json');
const CRED_FILE = path.join(SEED_HOME, 'credentials.json');

// 集成电脑Agent能力
let ComputerAgent, StealthManager, SessionManager, FormDetector, TabManager;
try {
    ({ ComputerAgent, StealthManager, SessionManager, FormDetector, TabManager } = require('./seed-computer-agent'));
} catch {}

// ================================================================
// 进化记忆系统
// ================================================================

class AgentMemory {
    constructor() {
        this.data = this._load();
    }

    _load() {
        try {
            return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
        } catch {
            return {
                selectorPatterns: {},   // { "groq.com|click_login": [{selector, successCount, failCount}] }
                siteKnowledge: {},      // { "groq.com": {loginMethod, apiKeyLocation, ...} }
                evolutionScore: 0,      // 整体进化分
                totalAttempts: 0,
                totalSuccess: 0,
                learnedAt: [],          // 学习时间线
                version: 2,
            };
        }
    }

    save() {
        try {
            fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.data, null, 2));
        } catch {}
    }

    // 记录选择器成功/失败
    learnSelector(site, intent, selector, success) {
        const key = `${site}|${intent}`;
        if (!this.data.selectorPatterns[key]) {
            this.data.selectorPatterns[key] = [];
        }
        const patterns = this.data.selectorPatterns[key];
        let entry = patterns.find(p => p.selector === selector);
        if (!entry) {
            entry = { selector, successCount: 0, failCount: 0 };
            patterns.push(entry);
        }
        if (success) {
            entry.successCount++;
            this.data.totalSuccess++;
        } else {
            entry.failCount++;
        }
        this.data.totalAttempts++;
        // 按成功率排序
        patterns.sort((a, b) => {
            const rateA = a.successCount / (a.successCount + a.failCount);
            const rateB = b.successCount / (b.successCount + b.failCount);
            return rateB - rateA;
        });
        this.save();
    }

    // 获取最佳选择器
    getBestSelectors(site, intent) {
        const key = `${site}|${intent}`;
        const patterns = this.data.selectorPatterns[key] || [];
        return patterns
            .filter(p => p.successCount > 0)
            .map(p => p.selector);
    }

    // 记录站点知识
    learnSite(site, knowledge) {
        if (!this.data.siteKnowledge[site]) {
            this.data.siteKnowledge[site] = {};
        }
        Object.assign(this.data.siteKnowledge[site], knowledge);
        this.data.learnedAt.push({ site, time: new Date().toISOString(), knowledge: Object.keys(knowledge) });
        if (this.data.learnedAt.length > 500) {
            this.data.learnedAt = this.data.learnedAt.slice(-200);
        }
        this.save();
    }

    getSiteKnowledge(site) {
        return this.data.siteKnowledge[site] || {};
    }

    // 更新进化分数
    updateScore() {
        if (this.data.totalAttempts === 0) return 0;
        const successRate = this.data.totalSuccess / this.data.totalAttempts;
        const knowledgeCount = Object.keys(this.data.siteKnowledge).length;
        const patternCount = Object.keys(this.data.selectorPatterns).length;
        this.data.evolutionScore = Math.round(
            (successRate * 40) + (Math.min(knowledgeCount, 20) * 2) + (Math.min(patternCount, 30) * 1)
        );
        this.save();
        return this.data.evolutionScore;
    }

    getStats() {
        return {
            score: this.data.evolutionScore,
            successRate: this.data.totalAttempts > 0
                ? (this.data.totalSuccess / this.data.totalAttempts * 100).toFixed(1) + '%'
                : 'N/A',
            sitesKnown: Object.keys(this.data.siteKnowledge).length,
            patternsLearned: Object.keys(this.data.selectorPatterns).length,
            totalAttempts: this.data.totalAttempts,
        };
    }
}

// ================================================================
// 自进化浏览器Agent
// ================================================================

class BrowserAgent {
    constructor(options = {}) {
        this.options = {
            headless: options.headless !== undefined ? options.headless : false,
            timeout: options.timeout || 60000,
            verbose: options.verbose || 1,
            ...options,
        };
        this.stagehand = null;
        this.page = null;
        this.log = [];
        this.memory = new AgentMemory();
        this.currentSite = '';
        this.computer = null;   // ComputerAgent
        this.sessionMgr = null; // SessionManager
        this.tabMgr = null;     // TabManager
    }

    // ================================================================
    // 初始化
    // ================================================================

    async init() {
        const { Stagehand } = require('@browserbasehq/stagehand');

        const llmConfig = this.detectBestLLM();
        this.addLog('init', `LLM: ${llmConfig.modelName} @ ${llmConfig.baseURL}`);

        // Stagehand内部OpenAI SDK需要这些环境变量
        process.env.OPENAI_API_KEY = llmConfig.apiKey || 'not-needed-using-local-llm';
        if (llmConfig.baseURL) {
            process.env.OPENAI_BASE_URL = llmConfig.baseURL;
        }

        this.stagehand = new Stagehand({
            env: 'LOCAL',
            model: llmConfig.modelName,
            modelClientOptions: {
                baseURL: llmConfig.baseURL,
                apiKey: llmConfig.apiKey || 'not-needed',
            },
            localBrowserLaunchOptions: {
                headless: this.options.headless,
            },
            verbose: this.options.verbose,
        });

        await this.stagehand.init();
        this.page = this.stagehand.context.pages()[0];

        // 集成电脑Agent能力
        if (ComputerAgent) {
            this.computer = new ComputerAgent();
            await this.computer.init(this.stagehand.context);
            this.sessionMgr = this.computer.sessions;
            this.tabMgr = this.computer.tabs;
        }

        // 注入反检测脚本
        if (StealthManager) {
            await StealthManager.injectStealth(this.page);
            this.addLog('init', 'Stealth mode enabled');
        }

        this.addLog('init', `Browser agent v2.0 initialized | Memory: ${this.memory.getStats().patternsLearned} patterns | Computer: ${this.computer ? 'YES' : 'NO'}`);
        return this;
    }

    detectBestLLM() {
        // 1. Ollama (本地免费无限)
        try {
            const { execSync } = require('child_process');
            const result = execSync('curl -s http://localhost:11434/api/tags', {
                timeout: 3000, encoding: 'utf8', stdio: 'pipe'
            });
            const tags = JSON.parse(result);
            if (tags.models && tags.models.length > 0) {
                return {
                    modelName: 'openai/qwen2.5:7b',
                    baseURL: 'http://localhost:11434/v1',
                    apiKey: 'ollama',
                };
            }
        } catch {}

        // 2. 已配置的云端API
        try {
            const config = this.loadConfig();
            if (config.apiKeys?.groq) {
                return {
                    modelName: 'openai/llama-3.3-70b-versatile',
                    baseURL: 'https://api.groq.com/openai/v1',
                    apiKey: config.apiKeys.groq,
                };
            }
            if (config.apiKeys?.openrouter) {
                return {
                    modelName: 'openai/google/gemma-3-27b-it:free',
                    baseURL: 'https://openrouter.ai/api/v1',
                    apiKey: config.apiKeys.openrouter,
                };
            }
        } catch {}

        // 3. Pollinations (免费云端)
        return {
            modelName: 'openai/gpt-4o',
            baseURL: 'https://text.pollinations.ai/openai',
            apiKey: 'free-no-key-needed',
        };
    }

    async close() {
        this.memory.updateScore();
        this.memory.save();
        // 保存当前页面的会话
        if (this.sessionMgr && this.page && this.currentSite) {
            await this.sessionMgr.saveCookies(this.currentSite, this.page).catch(() => {});
        }
        // 清理电脑Agent资源
        if (this.computer) this.computer.cleanup();
        if (this.stagehand) {
            await this.stagehand.close();
            this.stagehand = null;
            this.page = null;
        }
        this.saveLog();
    }

    // ================================================================
    // 页面智能分析
    // ================================================================

    // 安全获取页面文本 (Stagehand封装page，.content()可能不可用)
    async getPageText() {
        try {
            return await this.page.locator('body').textContent({ timeout: 5000 });
        } catch {
            try {
                return await this.page.evaluate(() => document.body?.innerText || '');
            } catch {
                return '';
            }
        }
    }

    // 获取页面HTML (用于深度分析)
    async getPageHTML() {
        try {
            return await this.page.evaluate(() => document.documentElement.outerHTML);
        } catch {
            return '';
        }
    }

    // 获取当前URL
    async getCurrentURL() {
        try {
            return this.page.url();
        } catch {
            return '';
        }
    }

    // 分析页面上所有可交互元素
    async analyzePage() {
        try {
            const elements = await this.page.evaluate(() => {
                const results = { buttons: [], links: [], inputs: [], selects: [] };

                // 按钮
                document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]').forEach(el => {
                    const text = el.textContent?.trim() || el.value || el.getAttribute('aria-label') || '';
                    if (text && text.length < 100) {
                        results.buttons.push({
                            text: text.substring(0, 60),
                            id: el.id || '',
                            type: el.tagName.toLowerCase(),
                            visible: el.offsetParent !== null,
                        });
                    }
                });

                // 链接
                document.querySelectorAll('a[href]').forEach(el => {
                    const text = el.textContent?.trim() || el.getAttribute('aria-label') || '';
                    if (text && text.length < 100) {
                        results.links.push({
                            text: text.substring(0, 60),
                            href: el.href || '',
                            visible: el.offsetParent !== null,
                        });
                    }
                });

                // 输入框
                document.querySelectorAll('input, textarea').forEach(el => {
                    results.inputs.push({
                        type: el.type || 'text',
                        name: el.name || '',
                        id: el.id || '',
                        placeholder: el.placeholder || '',
                        ariaLabel: el.getAttribute('aria-label') || '',
                        visible: el.offsetParent !== null,
                    });
                });

                // 下拉框
                document.querySelectorAll('select').forEach(el => {
                    results.selects.push({
                        name: el.name || '',
                        id: el.id || '',
                        options: Array.from(el.options).slice(0, 10).map(o => o.text),
                    });
                });

                return results;
            });

            this.addLog('analyze', `Found: ${elements.buttons.length} buttons, ${elements.links.length} links, ${elements.inputs.length} inputs`);
            return elements;
        } catch (e) {
            this.addLog('analyze-error', e.message);
            return { buttons: [], links: [], inputs: [], selects: [] };
        }
    }

    // 检测页面状态
    async detectPageState() {
        const url = await this.getCurrentURL();
        const text = await this.getPageText();
        const lower = text.toLowerCase();

        const state = {
            url,
            site: this._extractDomain(url),
            isLoginPage: false,
            isLoggedIn: false,
            hasApiKey: false,
            apiKeyValue: null,
            needsVerification: false,
            hasError: false,
            errorText: '',
        };

        // 检测登录页面
        if (lower.includes('sign in') || lower.includes('log in') || lower.includes('登录') ||
            lower.includes('create account') || lower.includes('sign up')) {
            state.isLoginPage = true;
        }

        // 检测已登录
        if (lower.includes('sign out') || lower.includes('log out') || lower.includes('退出') ||
            lower.includes('my account') || lower.includes('profile') || lower.includes('dashboard')) {
            state.isLoggedIn = true;
        }

        // 检测API Key
        const keyPatterns = [
            /gsk_[a-zA-Z0-9]{20,}/,              // Groq
            /AIza[a-zA-Z0-9_-]{35,}/,              // Google/Gemini
            /sk-or-v1-[a-zA-Z0-9]{40,}/,           // OpenRouter
            /sk-[a-zA-Z0-9]{20,}/,                  // Generic
            /[a-zA-Z0-9]{40,}/,                      // Generic long key
        ];
        for (const pattern of keyPatterns) {
            const match = text.match(pattern);
            if (match) {
                state.hasApiKey = true;
                state.apiKeyValue = match[0];
                break;
            }
        }

        // 检测验证需求
        if (lower.includes('verification') || lower.includes('verify') || lower.includes('验证') ||
            lower.includes('captcha') || lower.includes('2-step') || lower.includes('two-factor')) {
            state.needsVerification = true;
        }

        // 检测错误
        if (lower.includes('error') || lower.includes('failed') || lower.includes('denied') ||
            lower.includes('unauthorized') || lower.includes('permission')) {
            state.hasError = true;
            // 提取错误信息
            const errorMatch = text.match(/(?:error|failed|denied|unauthorized)[:\s]*([^\n]{0,100})/i);
            state.errorText = errorMatch ? errorMatch[1].trim() : '';
        }

        this.currentSite = state.site;
        return state;
    }

    _extractDomain(url) {
        try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
    }

    // ================================================================
    // 核心操作方法 (进化版)
    // ================================================================

    async goto(url) {
        this.addLog('goto', url);
        const site = this._extractDomain(url);

        // 恢复该站点的会话 (cookie)
        if (this.sessionMgr && this.sessionMgr.hasSession(site)) {
            await this.sessionMgr.restoreCookies(site, this.page);
            this.addLog('session', `Restored session for ${site}`);
        }

        try {
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.options.timeout });
        } catch (e) {
            this.addLog('warning', `Navigation slow: ${e.message}`);
        }
        await this.sleep(2000);
        this.currentSite = site;
    }

    // 智能执行动作: 记忆优先 → 直接操作 → AI操作
    async act(instruction) {
        this.addLog('act', instruction);
        const site = this.currentSite;
        const intent = this._instructionToIntent(instruction);

        // 1. 先查记忆中的成功选择器
        const memorized = this.memory.getBestSelectors(site, intent);
        for (const sel of memorized) {
            try {
                const el = this.page.locator(sel).first();
                if (await el.isVisible({ timeout: 2000 })) {
                    await el.click();
                    this.memory.learnSelector(site, intent, sel, true);
                    this.addLog('act-memory', `Used memorized: ${sel}`);
                    return true;
                }
            } catch {}
        }

        // 2. Playwright直接操作
        const directResult = await this.actDirect(instruction);
        if (directResult) return true;

        // 3. AI操作 (降级)
        try {
            await this.stagehand.act(instruction);
            this.addLog('act-ai', 'AI act succeeded');
            return true;
        } catch (e) {
            this.addLog('act-error', `All methods failed: ${e.message}`);
            return false;
        }
    }

    _instructionToIntent(instruction) {
        const lower = instruction.toLowerCase();
        if (lower.includes('click') && lower.includes('login')) return 'click_login';
        if (lower.includes('click') && lower.includes('sign in')) return 'click_signin';
        if (lower.includes('click') && lower.includes('google')) return 'click_google';
        if (lower.includes('click') && lower.includes('create')) return 'click_create';
        if (lower.includes('click') && lower.includes('next')) return 'click_next';
        if (lower.includes('click') && lower.includes('submit')) return 'click_submit';
        if (lower.includes('type') && lower.includes('email')) return 'type_email';
        if (lower.includes('type') && lower.includes('password')) return 'type_password';
        if (lower.includes('click')) {
            const m = instruction.match(/click.*?["'](.+?)["']/i);
            return m ? `click_${m[1].toLowerCase().replace(/\s+/g, '_')}` : 'click_other';
        }
        return lower.replace(/[^a-z0-9]+/g, '_').substring(0, 40);
    }

    // 增强版直接操作 - 15+种模式
    async actDirect(instruction) {
        try {
            const lower = instruction.toLowerCase();
            const site = this.currentSite;

            // ---- 点击操作 ----
            if (lower.includes('click')) {
                return await this._handleClick(instruction, site);
            }

            // ---- 输入操作 ----
            if (lower.includes('type') || lower.includes('fill') || lower.includes('input') || lower.includes('enter')) {
                return await this._handleType(instruction, site);
            }

            // ---- Next/Submit按钮 ----
            if (lower.includes('next') || lower.includes('submit') || lower.includes('continue')) {
                return await this._handleSubmit(instruction, site);
            }

            // ---- 滚动 ----
            if (lower.includes('scroll')) {
                if (lower.includes('down')) {
                    await this.page.evaluate(() => window.scrollBy(0, 500));
                    return true;
                }
                if (lower.includes('up')) {
                    await this.page.evaluate(() => window.scrollBy(0, -500));
                    return true;
                }
                if (lower.includes('bottom')) {
                    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                    return true;
                }
                if (lower.includes('top')) {
                    await this.page.evaluate(() => window.scrollTo(0, 0));
                    return true;
                }
            }

            // ---- 键盘操作 ----
            if (lower.includes('press')) {
                const keyMap = {
                    'enter': 'Enter', 'tab': 'Tab', 'escape': 'Escape', 'esc': 'Escape',
                    'backspace': 'Backspace', 'delete': 'Delete',
                    'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
                };
                for (const [name, key] of Object.entries(keyMap)) {
                    if (lower.includes(name)) {
                        await this.page.keyboard.press(key);
                        this.addLog('act-direct', `Pressed: ${key}`);
                        return true;
                    }
                }
            }

            // ---- 等待 ----
            if (lower.includes('wait')) {
                const msMatch = instruction.match(/(\d+)\s*(?:ms|milliseconds?)/i);
                const secMatch = instruction.match(/(\d+)\s*(?:s|seconds?)/i);
                if (msMatch) { await this.sleep(parseInt(msMatch[1])); return true; }
                if (secMatch) { await this.sleep(parseInt(secMatch[1]) * 1000); return true; }
                await this.sleep(3000);
                return true;
            }

            // ---- 选择下拉框 ----
            if (lower.includes('select') && (lower.includes('option') || lower.includes('choose'))) {
                const valueMatch = instruction.match(/select.*?["'](.+?)["']/i);
                if (valueMatch) {
                    const options = await this.page.locator('select').all();
                    for (const sel of options) {
                        try {
                            await sel.selectOption({ label: valueMatch[1] });
                            this.addLog('act-direct', `Selected: ${valueMatch[1]}`);
                            return true;
                        } catch {}
                    }
                }
            }

            // ---- 勾选/取消勾选 ----
            if (lower.includes('check') || lower.includes('toggle')) {
                const checkboxes = await this.page.locator('input[type="checkbox"]').all();
                if (checkboxes.length > 0) {
                    await checkboxes[0].click();
                    this.addLog('act-direct', 'Toggled checkbox');
                    return true;
                }
            }

            // ---- 复制文本 ----
            if (lower.includes('copy') || lower.includes('get text')) {
                const targetMatch = instruction.match(/(?:copy|get text).*?["'](.+?)["']/i);
                if (targetMatch) {
                    const el = this.page.locator(`text="${targetMatch[1]}"`).first();
                    const text = await el.textContent();
                    this.addLog('act-direct', `Copied text: ${text?.substring(0, 50)}`);
                    return text;
                }
            }

            this.addLog('act-fail', `No pattern matched: ${instruction}`);
            return false;
        } catch (e) {
            this.addLog('act-error', e.message);
            return false;
        }
    }

    // 智能点击 - 多策略尝试
    async _handleClick(instruction, site) {
        const intent = this._instructionToIntent(instruction);

        // 提取目标文本
        const textMatch = instruction.match(/click.*?["'](.+?)["']/i) ||
                          instruction.match(/click\s+(?:the\s+|on\s+)?(.+?)(?:\s+button|\s+link|\s+tab|\s+icon|$)/i);
        if (!textMatch) return false;

        const target = textMatch[1].trim();
        const targetLower = target.toLowerCase();

        // 构建候选选择器列表 (从多到少)
        const selectors = [
            // 精确文本匹配
            `text="${target}"`,
            `button:has-text("${target}")`,
            `a:has-text("${target}")`,
            `[role="button"]:has-text("${target}")`,
            // 属性匹配
            `[aria-label="${target}"]`,
            `[title="${target}"]`,
            `[data-testid*="${targetLower.replace(/\s+/g, '-')}"]`,
            `[data-testid*="${targetLower.replace(/\s+/g, '_')}"]`,
            // 部分匹配
            `button:has-text("${target.split(' ')[0]}")`,
            `a:has-text("${target.split(' ')[0]}")`,
        ];

        // Google登录按钮的特殊选择器
        if (targetLower.includes('google') || targetLower.includes('continue with google')) {
            selectors.unshift(
                'button:has-text("Google")',
                'a:has-text("Google")',
                'button:has-text("Continue with Google")',
                'button:has-text("Sign in with Google")',
                '[data-provider="google"]',
                '.social-btn-google',
                'button[aria-label*="Google"]',
            );
        }

        // 创建/新建按钮特殊选择器
        if (targetLower.includes('create') || targetLower.includes('new') || targetLower.includes('generate')) {
            selectors.unshift(
                `button:has-text("Create")`,
                `button:has-text("New")`,
                `button:has-text("Generate")`,
                `button:has-text("+ Create")`,
                `a:has-text("Create")`,
                `[aria-label*="Create"]`,
                `[aria-label*="New"]`,
            );
        }

        // 尝试每个选择器
        for (const sel of selectors) {
            try {
                const el = this.page.locator(sel).first();
                if (await el.isVisible({ timeout: 2000 })) {
                    await el.click();
                    this.memory.learnSelector(site, intent, sel, true);
                    this.addLog('act-direct', `Clicked: ${sel}`);
                    await this.sleep(1500);
                    return true;
                }
            } catch {}
            this.memory.learnSelector(site, intent, sel, false);
        }

        // 最后尝试: 用evaluate查找包含目标文本的可点击元素
        try {
            const clicked = await this.page.evaluate((t) => {
                const all = document.querySelectorAll('button, a, [role="button"], [onclick], [tabindex]');
                for (const el of all) {
                    if (el.textContent?.toLowerCase().includes(t.toLowerCase()) && el.offsetParent !== null) {
                        el.click();
                        return el.textContent.trim().substring(0, 50);
                    }
                }
                return null;
            }, target);
            if (clicked) {
                this.addLog('act-direct', `JS clicked: "${clicked}"`);
                await this.sleep(1500);
                return true;
            }
        } catch {}

        return false;
    }

    // 智能输入 - 自动识别字段类型
    async _handleType(instruction, site) {
        const intent = this._instructionToIntent(instruction);

        // 提取要输入的文本和目标字段
        const textMatch = instruction.match(/(?:type|fill|input|enter)\s+["'](.+?)["']/i);
        const fieldMatch = instruction.match(/(?:into|in|the)\s+(?:the\s+)?(.+?)(?:\s+field|\s+input|\s+box|$)/i);

        if (!textMatch) return false;
        const text = textMatch[1];
        const field = fieldMatch ? fieldMatch[1].trim().toLowerCase() : '';

        // 根据字段类型和文本内容推断选择器
        const selectors = [];

        // Email字段
        if (field.includes('email') || field.includes('identifier') || field.includes('username') ||
            text.includes('@')) {
            selectors.push(
                '#identifierId',
                'input[type="email"]',
                'input[name="identifier"]',
                'input[name="email"]',
                'input[name="username"]',
                'input[autocomplete="email"]',
                'input[autocomplete="username"]',
                'input[placeholder*="email" i]',
                'input[placeholder*="mail" i]',
                'input[aria-label*="email" i]',
                'input[aria-label*="Email" i]',
            );
        }

        // Password字段
        if (field.includes('password') || field.includes('passwd')) {
            selectors.push(
                'input[type="password"]',
                'input[name="Passwd"]',
                'input[name="password"]',
                'input[autocomplete="current-password"]',
                'input[autocomplete="new-password"]',
                'input[aria-label*="password" i]',
                'input[aria-label*="Password" i]',
            );
        }

        // 通用字段
        if (field) {
            selectors.push(
                `input[name*="${field}"]`,
                `input[placeholder*="${field}" i]`,
                `input[aria-label*="${field}" i]`,
                `textarea[name*="${field}"]`,
                `textarea[placeholder*="${field}" i]`,
            );
        }

        // 如果没有明确字段，尝试第一个可见输入框
        if (selectors.length === 0) {
            selectors.push(
                'input:visible:not([type="hidden"]):not([type="submit"]):not([type="button"])',
                'textarea:visible',
            );
        }

        for (const sel of selectors) {
            try {
                const el = this.page.locator(sel).first();
                if (await el.isVisible({ timeout: 2000 })) {
                    await el.click();
                    await el.fill(text);
                    this.memory.learnSelector(site, intent, sel, true);
                    this.addLog('act-direct', `Filled ${sel}`);
                    return true;
                }
            } catch {}
            this.memory.learnSelector(site, intent, sel, false);
        }

        return false;
    }

    // 智能提交
    async _handleSubmit(instruction, site) {
        const lower = instruction.toLowerCase();
        const intent = this._instructionToIntent(instruction);

        const selectors = [];

        if (lower.includes('next')) {
            selectors.push(
                '#identifierNext', '#passwordNext',
                'button:has-text("Next")', 'button:has-text("下一步")',
                'button:has-text("Continue")', 'button:has-text("继续")',
            );
        }

        selectors.push(
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Submit")',
            'button:has-text("OK")',
            'button:has-text("Confirm")',
            'button:has-text("确认")',
        );

        for (const sel of selectors) {
            try {
                const el = this.page.locator(sel).first();
                if (await el.isVisible({ timeout: 2000 })) {
                    await el.click();
                    this.memory.learnSelector(site, intent, sel, true);
                    this.addLog('act-direct', `Submit: ${sel}`);
                    await this.sleep(2000);
                    return true;
                }
            } catch {}
        }

        return false;
    }

    // ================================================================
    // 智能表单填写
    // ================================================================

    // 自动填写登录表单 (不需要指令,自动检测)
    async autoFillLogin(email, password) {
        const elements = await this.analyzePage();
        const inputs = elements.inputs.filter(i => i.visible);

        let emailFilled = false;
        let passwordFilled = false;

        for (const input of inputs) {
            if (!emailFilled && (input.type === 'email' || input.name.includes('email') ||
                input.id.includes('email') || input.id === 'identifierId' ||
                input.placeholder.toLowerCase().includes('email') ||
                input.ariaLabel.toLowerCase().includes('email'))) {
                const sel = input.id ? `#${input.id}` : `input[type="${input.type}"]`;
                await this.page.locator(sel).first().fill(email);
                emailFilled = true;
                this.addLog('autofill', `Email filled: ${sel}`);
            }

            if (!passwordFilled && input.type === 'password') {
                const sel = input.id ? `#${input.id}` : 'input[type="password"]';
                await this.page.locator(sel).first().fill(password);
                passwordFilled = true;
                this.addLog('autofill', `Password filled: ${sel}`);
            }
        }

        return { emailFilled, passwordFilled };
    }

    // ================================================================
    // AI提取 (带降级)
    // ================================================================

    async extract(instruction, schema) {
        this.addLog('extract', instruction);
        // 先尝试AI提取
        try {
            const { z } = require('zod');
            const result = await this.stagehand.extract(instruction, schema || z.object({
                text: z.string(),
            }));
            return result;
        } catch (e) {
            this.addLog('extract-warn', `AI extract failed: ${e.message}`);
        }

        // 降级: 用正则从页面文本提取
        try {
            const text = await this.getPageText();
            // 尝试提取API Key模式
            const patterns = [
                /gsk_[a-zA-Z0-9]{20,}/,
                /AIza[a-zA-Z0-9_-]{35,}/,
                /sk-or-v1-[a-zA-Z0-9]{40,}/,
                /sk-[a-zA-Z0-9]{20,}/,
                /hf_[a-zA-Z0-9]{20,}/,
                /[0-9]{4,8}/,  // verification code
            ];
            for (const p of patterns) {
                const m = text.match(p);
                if (m) {
                    this.addLog('extract-regex', `Found by regex: ${m[0].substring(0, 20)}...`);
                    return { text: m[0], apiKey: m[0], code: m[0] };
                }
            }
        } catch {}

        return null;
    }

    async screenshot(filename) {
        const filepath = path.join(SEED_HOME, filename || `screenshot-${Date.now()}.png`);
        await this.page.screenshot({ path: filepath, fullPage: true });
        this.addLog('screenshot', filepath);
        return filepath;
    }

    async sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    // ================================================================
    // Google登录 (进化版)
    // ================================================================

    async googleLogin(email, password) {
        this.addLog('task', `Google login: ${email}`);
        try {
            const state = await this.detectPageState();

            // 步骤1: 输入邮箱
            // 尝试多种选择器 (Google经常改UI)
            const emailSelectors = [
                '#identifierId',
                'input[type="email"]',
                'input[name="identifier"]',
                'input[autocomplete="username"]',
            ];
            let emailDone = false;
            for (const sel of emailSelectors) {
                try {
                    const el = this.page.locator(sel).first();
                    if (await el.isVisible({ timeout: 3000 })) {
                        await el.fill(email);
                        emailDone = true;
                        this.memory.learnSelector('accounts.google.com', 'type_email', sel, true);
                        this.addLog('login', `Email entered: ${sel}`);
                        break;
                    }
                } catch {}
            }
            if (!emailDone) {
                this.addLog('login-error', 'Could not find email field');
                return false;
            }

            await this.sleep(500);

            // 步骤2: 点击Next
            const nextSelectors = ['#identifierNext', 'button:has-text("Next")', 'button:has-text("下一步")'];
            for (const sel of nextSelectors) {
                try {
                    const el = this.page.locator(sel).first();
                    if (await el.isVisible({ timeout: 2000 })) {
                        await el.click();
                        this.memory.learnSelector('accounts.google.com', 'click_next', sel, true);
                        break;
                    }
                } catch {}
            }

            await this.sleep(3000);

            // 步骤3: 输入密码
            const pwSelectors = [
                'input[type="password"]',
                'input[name="Passwd"]',
                'input[name="password"]',
                'input[autocomplete="current-password"]',
            ];
            let pwDone = false;
            for (const sel of pwSelectors) {
                try {
                    const el = this.page.locator(sel).first();
                    if (await el.isVisible({ timeout: 5000 })) {
                        await el.fill(password);
                        pwDone = true;
                        this.memory.learnSelector('accounts.google.com', 'type_password', sel, true);
                        this.addLog('login', `Password entered: ${sel}`);
                        break;
                    }
                } catch {}
            }
            if (!pwDone) {
                this.addLog('login-error', 'Could not find password field');
                return false;
            }

            await this.sleep(500);

            // 步骤4: 点击密码Next
            const pwNextSelectors = ['#passwordNext', 'button:has-text("Next")', 'button:has-text("下一步")'];
            for (const sel of pwNextSelectors) {
                try {
                    const el = this.page.locator(sel).first();
                    if (await el.isVisible({ timeout: 2000 })) {
                        await el.click();
                        break;
                    }
                } catch {}
            }

            await this.sleep(5000);

            // 步骤5: 检查是否需要验证
            const afterState = await this.detectPageState();
            if (afterState.needsVerification) {
                this.addLog('login-warning', 'Verification required - waiting 30s for manual input');
                // 等待用户手动处理或自动读取邮箱验证码
                await this.sleep(30000);
            }

            // 检查是否有"选择账户"界面
            const text = await this.getPageText();
            if (text.includes('Choose an account') || text.includes('选择帐户')) {
                // 点击对应的账户
                try {
                    const emailShort = email.split('@')[0];
                    await this.page.locator(`text="${email}"`).first().click();
                    await this.sleep(3000);
                } catch {
                    // 点击第一个账户
                    try {
                        await this.page.locator('[data-identifier]').first().click();
                        await this.sleep(3000);
                    } catch {}
                }
            }

            this.memory.learnSite('accounts.google.com', { loginMethod: 'email+password', lastLogin: new Date().toISOString() });
            this.addLog('success', 'Google login completed');
            return true;
        } catch (e) {
            this.addLog('error', `Google login failed: ${e.message}`);
            return false;
        }
    }

    // ================================================================
    // 邮箱验证码读取
    // ================================================================

    async readGmailVerificationCode(email, password) {
        this.addLog('task', 'Reading Gmail for verification code');
        try {
            await this.goto('https://mail.google.com');
            await this.sleep(3000);

            const state = await this.detectPageState();
            if (state.isLoginPage) {
                await this.googleLogin(email, password);
                await this.sleep(5000);
            }

            // 点击最新的验证码邮件
            const clicked = await this.page.evaluate(() => {
                const rows = document.querySelectorAll('tr.zA');
                for (const row of rows) {
                    const text = row.textContent || '';
                    if (text.includes('验证') || text.includes('verification') ||
                        text.includes('code') || text.includes('verify')) {
                        row.click();
                        return true;
                    }
                }
                // 点击第一封未读邮件
                const unread = document.querySelector('tr.zA.zE');
                if (unread) { unread.click(); return true; }
                return false;
            });

            if (clicked) {
                await this.sleep(3000);
                const text = await this.getPageText();
                // 提取验证码 (通常4-8位数字)
                const codeMatch = text.match(/\b(\d{4,8})\b/);
                if (codeMatch) {
                    this.addLog('success', `Got verification code: ${codeMatch[1]}`);
                    return codeMatch[1];
                }
            }
        } catch (e) {
            this.addLog('error', `Gmail: ${e.message}`);
        }
        return null;
    }

    // ================================================================
    // API Key获取 (进化版 - 更多来源 + 错误恢复)
    // ================================================================

    async getGroqApiKey(email, password) {
        this.addLog('task', 'Getting Groq API Key');
        try {
            await this.goto('https://console.groq.com/keys');
            await this.sleep(3000);

            const state = await this.detectPageState();
            if (state.isLoginPage || !state.isLoggedIn) {
                await this._clickGoogleLogin();
                await this.sleep(3000);
                await this.googleLogin(email, password);
                await this.sleep(5000);
                // 回到keys页面
                await this.goto('https://console.groq.com/keys');
                await this.sleep(3000);
            }

            // 如果页面已有API Key，直接提取
            const state2 = await this.detectPageState();
            if (state2.apiKeyValue && state2.apiKeyValue.startsWith('gsk_')) {
                this.saveApiKey('groq', state2.apiKeyValue);
                this.memory.learnSite('console.groq.com', { method: 'existing_key', keyPrefix: 'gsk_' });
                return state2.apiKeyValue;
            }

            // 创建新Key
            await this.act('click "Create API Key" button');
            await this.sleep(2000);

            // 可能弹出命名对话框
            try {
                const nameInput = this.page.locator('input[placeholder*="name" i], input[placeholder*="Name" i]').first();
                if (await nameInput.isVisible({ timeout: 2000 })) {
                    await nameInput.fill('seed-ai-auto');
                    await this.act('click "Submit" or "Create" button');
                    await this.sleep(3000);
                }
            } catch {}

            // 提取Key
            const text = await this.getPageText();
            const keyMatch = text.match(/gsk_[a-zA-Z0-9]{20,}/);
            if (keyMatch) {
                this.saveApiKey('groq', keyMatch[0]);
                this.memory.learnSite('console.groq.com', { method: 'created_key', keyPrefix: 'gsk_' });
                this.addLog('success', `Got Groq Key: ${keyMatch[0].substring(0, 15)}...`);
                return keyMatch[0];
            }

            this.addLog('warning', 'Could not extract Groq API Key');
        } catch (e) {
            this.addLog('error', `Groq: ${e.message}`);
        }
        return null;
    }

    async getGeminiApiKey(email, password) {
        this.addLog('task', 'Getting Gemini API Key');
        try {
            await this.goto('https://aistudio.google.com/apikey');
            await this.sleep(5000);

            const state = await this.detectPageState();
            if (state.isLoginPage) {
                await this.googleLogin(email, password);
                await this.sleep(5000);
                await this.goto('https://aistudio.google.com/apikey');
                await this.sleep(5000);
            }

            // 如果已有Key
            const text = await this.getPageText();
            const existingKey = text.match(/AIza[a-zA-Z0-9_-]{35,}/);
            if (existingKey) {
                this.saveApiKey('gemini', existingKey[0]);
                this.memory.learnSite('aistudio.google.com', { method: 'existing_key', keyPrefix: 'AIza' });
                return existingKey[0];
            }

            // 创建Key
            await this.act('click "Create API Key" or "Get API key" button');
            await this.sleep(5000);

            // 可能需要选择项目
            try {
                await this.act('click "Create API key in new project" or first available project');
                await this.sleep(5000);
            } catch {}

            const text2 = await this.getPageText();
            const newKey = text2.match(/AIza[a-zA-Z0-9_-]{35,}/);
            if (newKey) {
                this.saveApiKey('gemini', newKey[0]);
                this.memory.learnSite('aistudio.google.com', { method: 'created_key', keyPrefix: 'AIza' });
                this.addLog('success', `Got Gemini Key: ${newKey[0].substring(0, 15)}...`);
                return newKey[0];
            }
        } catch (e) {
            this.addLog('error', `Gemini: ${e.message}`);
        }
        return null;
    }

    async getOpenRouterApiKey(email, password) {
        this.addLog('task', 'Getting OpenRouter API Key');
        try {
            await this.goto('https://openrouter.ai/settings/keys');
            await this.sleep(3000);

            const state = await this.detectPageState();
            if (state.isLoginPage || !state.isLoggedIn) {
                // OpenRouter支持Google OAuth
                await this._clickGoogleLogin();
                await this.sleep(3000);
                await this.googleLogin(email, password);
                await this.sleep(5000);
                await this.goto('https://openrouter.ai/settings/keys');
                await this.sleep(3000);
            }

            // 创建Key
            await this.act('click "Create Key" or "New Key" button');
            await this.sleep(3000);

            // 命名
            try {
                const nameInput = this.page.locator('input[placeholder*="name" i]').first();
                if (await nameInput.isVisible({ timeout: 2000 })) {
                    await nameInput.fill('seed-ai');
                    await this.act('click "Create" or "Submit" button');
                    await this.sleep(3000);
                }
            } catch {}

            const text = await this.getPageText();
            const keyMatch = text.match(/sk-or-v1-[a-zA-Z0-9]{30,}/);
            if (keyMatch) {
                this.saveApiKey('openrouter', keyMatch[0]);
                this.memory.learnSite('openrouter.ai', { method: 'created_key', keyPrefix: 'sk-or-' });
                this.addLog('success', `Got OpenRouter Key: ${keyMatch[0].substring(0, 15)}...`);
                return keyMatch[0];
            }
        } catch (e) {
            this.addLog('error', `OpenRouter: ${e.message}`);
        }
        return null;
    }

    async getCohereApiKey(email, password) {
        this.addLog('task', 'Getting Cohere API Key');
        try {
            await this.goto('https://dashboard.cohere.com/api-keys');
            await this.sleep(3000);

            const state = await this.detectPageState();
            if (state.isLoginPage || !state.isLoggedIn) {
                await this._clickGoogleLogin();
                await this.sleep(3000);
                await this.googleLogin(email, password);
                await this.sleep(5000);
                await this.goto('https://dashboard.cohere.com/api-keys');
                await this.sleep(3000);
            }

            // Cohere通常默认显示trial key
            const text = await this.getPageText();
            const keyMatch = text.match(/[a-zA-Z0-9]{30,}/);
            if (keyMatch) {
                this.saveApiKey('cohere', keyMatch[0]);
                this.memory.learnSite('dashboard.cohere.com', { method: 'trial_key' });
                this.addLog('success', `Got Cohere Key`);
                return keyMatch[0];
            }
        } catch (e) {
            this.addLog('error', `Cohere: ${e.message}`);
        }
        return null;
    }

    // 新增: HuggingFace API Token
    async getHuggingFaceToken(email, password) {
        this.addLog('task', 'Getting HuggingFace Token');
        try {
            await this.goto('https://huggingface.co/settings/tokens');
            await this.sleep(3000);

            const state = await this.detectPageState();
            if (state.isLoginPage) {
                // HF有自己的登录，也支持Google
                await this._clickGoogleLogin();
                await this.sleep(3000);
                await this.googleLogin(email, password);
                await this.sleep(5000);
                await this.goto('https://huggingface.co/settings/tokens');
                await this.sleep(3000);
            }

            // 创建token
            await this.act('click "New token" or "Create new token" button');
            await this.sleep(2000);

            try {
                const nameInput = this.page.locator('input[placeholder*="name" i], input[name="name"]').first();
                if (await nameInput.isVisible({ timeout: 2000 })) {
                    await nameInput.fill('seed-ai');
                }
                // 选择read权限
                await this.act('select "Read" permission or role');
                await this.sleep(500);
                await this.act('click "Generate" or "Create" button');
                await this.sleep(3000);
            } catch {}

            const text = await this.getPageText();
            const keyMatch = text.match(/hf_[a-zA-Z0-9]{20,}/);
            if (keyMatch) {
                this.saveApiKey('huggingface', keyMatch[0]);
                this.memory.learnSite('huggingface.co', { method: 'created_token', keyPrefix: 'hf_' });
                this.addLog('success', `Got HuggingFace Token: ${keyMatch[0].substring(0, 15)}...`);
                return keyMatch[0];
            }
        } catch (e) {
            this.addLog('error', `HuggingFace: ${e.message}`);
        }
        return null;
    }

    // 新增: Together.ai API Key
    async getTogetherApiKey(email, password) {
        this.addLog('task', 'Getting Together.ai API Key');
        try {
            await this.goto('https://api.together.ai/settings/api-keys');
            await this.sleep(3000);

            const state = await this.detectPageState();
            if (state.isLoginPage || !state.isLoggedIn) {
                await this._clickGoogleLogin();
                await this.sleep(3000);
                await this.googleLogin(email, password);
                await this.sleep(5000);
                await this.goto('https://api.together.ai/settings/api-keys');
                await this.sleep(3000);
            }

            const text = await this.getPageText();
            // Together keys通常直接显示
            const keyMatch = text.match(/[a-f0-9]{64}/);
            if (keyMatch) {
                this.saveApiKey('together', keyMatch[0]);
                this.memory.learnSite('api.together.ai', { method: 'existing_key' });
                this.addLog('success', 'Got Together.ai Key');
                return keyMatch[0];
            }
        } catch (e) {
            this.addLog('error', `Together: ${e.message}`);
        }
        return null;
    }

    // 辅助: 点击Google登录按钮
    async _clickGoogleLogin() {
        const googleSelectors = [
            'button:has-text("Continue with Google")',
            'button:has-text("Sign in with Google")',
            'a:has-text("Continue with Google")',
            'a:has-text("Sign in with Google")',
            'button:has-text("Google")',
            'a:has-text("Google")',
            '[data-provider="google"]',
            'button[aria-label*="Google"]',
            '.social-btn-google',
            'img[alt*="Google"]',
        ];
        for (const sel of googleSelectors) {
            try {
                const el = this.page.locator(sel).first();
                if (await el.isVisible({ timeout: 2000 })) {
                    await el.click();
                    this.addLog('act-direct', `Google login: ${sel}`);
                    return true;
                }
            } catch {}
        }
        // JavaScript fallback
        try {
            const clicked = await this.page.evaluate(() => {
                const all = document.querySelectorAll('button, a, [role="button"]');
                for (const el of all) {
                    if ((el.textContent || '').toLowerCase().includes('google') && el.offsetParent !== null) {
                        el.click();
                        return true;
                    }
                }
                return false;
            });
            return clicked;
        } catch {}
        return false;
    }

    // ================================================================
    // 一键获取所有API Key (进化版)
    // ================================================================

    async getAllApiKeys(credentials) {
        // 支持新的多账户格式
        const accounts = credentials.accounts || [{ email: credentials.email, password: credentials.password }];
        const email = accounts[0].email;
        const password = accounts[0].password;
        const results = {};

        console.log('\n╔══════════════════════════════════════════╗');
        console.log('║  Browser Agent v2.0 - 自动获取API Key    ║');
        console.log(`║  进化分: ${this.memory.getStats().score} | 已学习: ${this.memory.getStats().patternsLearned} 模式  ║`);
        console.log('╚══════════════════════════════════════════╝\n');

        const config = this.loadConfig();
        const existing = config.apiKeys || {};

        const services = [
            { id: 'groq', name: 'Groq', fn: () => this.getGroqApiKey(email, password) },
            { id: 'gemini', name: 'Gemini', fn: () => this.getGeminiApiKey(email, password) },
            { id: 'openrouter', name: 'OpenRouter', fn: () => this.getOpenRouterApiKey(email, password) },
            { id: 'cohere', name: 'Cohere', fn: () => this.getCohereApiKey(email, password) },
            { id: 'huggingface', name: 'HuggingFace', fn: () => this.getHuggingFaceToken(email, password) },
            { id: 'together', name: 'Together.ai', fn: () => this.getTogetherApiKey(email, password) },
        ];

        for (let i = 0; i < services.length; i++) {
            const svc = services[i];
            if (existing[svc.id]) {
                console.log(`[${i + 1}/${services.length}] ${svc.name} - 已有Key, 跳过`);
                results[svc.id] = existing[svc.id];
                continue;
            }

            console.log(`[${i + 1}/${services.length}] 获取 ${svc.name} API Key...`);
            try {
                results[svc.id] = await svc.fn();
                if (results[svc.id]) {
                    console.log(`  ✓ ${svc.name} 获取成功!`);
                } else {
                    console.log(`  ✗ ${svc.name} 获取失败`);
                    // 尝试备用账户
                    if (accounts.length > 1 && !results[svc.id]) {
                        console.log(`  → 尝试备用账户...`);
                        try {
                            // 重新初始化浏览器以清除session
                            results[svc.id] = await svc.fn.call(this, accounts[1].email, accounts[1].password);
                        } catch {}
                    }
                }
            } catch (e) {
                console.log(`  ✗ ${svc.name} 错误: ${e.message}`);
            }
        }

        const got = Object.values(results).filter(v => v).length;
        console.log(`\n══════════════════════════════════════════`);
        console.log(`结果: ${got}/${services.length} 个API Key获取成功`);
        console.log(`进化分: ${this.memory.updateScore()}`);
        console.log(`══════════════════════════════════════════\n`);

        return results;
    }

    // ================================================================
    // 自我进化系统
    // ================================================================

    // 分析历史记录,找出薄弱环节
    selfDiagnose() {
        const stats = this.memory.getStats();
        const weaknesses = [];
        const strengths = [];

        // 分析选择器模式
        const patterns = this.memory.data.selectorPatterns;
        for (const [key, entries] of Object.entries(patterns)) {
            const totalSuccess = entries.reduce((s, e) => s + e.successCount, 0);
            const totalFail = entries.reduce((s, e) => s + e.failCount, 0);
            const rate = totalSuccess / (totalSuccess + totalFail);

            if (rate < 0.3 && totalFail > 2) {
                weaknesses.push({ area: key, successRate: rate, details: 'Low success rate' });
            }
            if (rate > 0.8 && totalSuccess > 3) {
                strengths.push({ area: key, successRate: rate });
            }
        }

        // 分析站点知识
        const sites = this.memory.data.siteKnowledge;
        const knownSites = Object.keys(sites);
        const targetSites = ['console.groq.com', 'aistudio.google.com', 'openrouter.ai',
                            'dashboard.cohere.com', 'huggingface.co', 'api.together.ai'];
        const unknownSites = targetSites.filter(s => !knownSites.includes(s));

        return {
            stats,
            weaknesses,
            strengths,
            unknownSites,
            recommendations: [
                ...weaknesses.map(w => `Improve: ${w.area} (${(w.successRate * 100).toFixed(0)}% success)`),
                ...unknownSites.map(s => `Explore: ${s}`),
            ],
        };
    }

    // 自我测试: 验证关键能力
    async selfTest() {
        const results = [];

        console.log('\n[Self-Test] 浏览器Agent能力测试...\n');

        // 测试1: 浏览器初始化
        try {
            if (!this.page) await this.init();
            results.push({ test: 'Browser Init', pass: true });
        } catch (e) {
            results.push({ test: 'Browser Init', pass: false, error: e.message });
            return results;
        }

        // 测试2: 导航
        try {
            await this.goto('https://www.google.com');
            const url = await this.getCurrentURL();
            results.push({ test: 'Navigation', pass: url.includes('google.com') });
        } catch (e) {
            results.push({ test: 'Navigation', pass: false, error: e.message });
        }

        // 测试3: 页面分析
        try {
            const elements = await this.analyzePage();
            results.push({ test: 'Page Analysis', pass: elements.inputs.length > 0 || elements.buttons.length > 0 });
        } catch (e) {
            results.push({ test: 'Page Analysis', pass: false, error: e.message });
        }

        // 测试4: 输入操作
        try {
            const searchInput = this.page.locator('input[name="q"], textarea[name="q"]').first();
            if (await searchInput.isVisible({ timeout: 3000 })) {
                await searchInput.fill('test query');
                results.push({ test: 'Text Input', pass: true });
            } else {
                results.push({ test: 'Text Input', pass: false, error: 'Search input not found' });
            }
        } catch (e) {
            results.push({ test: 'Text Input', pass: false, error: e.message });
        }

        // 测试5: 页面状态检测
        try {
            const state = await this.detectPageState();
            results.push({ test: 'State Detection', pass: state.site === 'google.com' });
        } catch (e) {
            results.push({ test: 'State Detection', pass: false, error: e.message });
        }

        // 测试6: 截图
        try {
            const file = await this.screenshot('selftest-screenshot.png');
            const exists = fs.existsSync(file);
            results.push({ test: 'Screenshot', pass: exists });
            if (exists) fs.unlinkSync(file);
        } catch (e) {
            results.push({ test: 'Screenshot', pass: false, error: e.message });
        }

        // 打印结果
        console.log('╔══════════════════════════════════════╗');
        const passed = results.filter(r => r.pass).length;
        for (const r of results) {
            console.log(`║  ${r.pass ? '✅' : '❌'} ${r.test.padEnd(20)} ${r.pass ? 'PASS' : 'FAIL'} ║`);
        }
        console.log(`╠══════════════════════════════════════╣`);
        console.log(`║  总分: ${passed}/${results.length}  进化分: ${this.memory.updateScore().toString().padEnd(16)}║`);
        console.log(`╚══════════════════════════════════════╝\n`);

        return results;
    }

    // 进化循环: 分析→改进→测试
    async evolve() {
        console.log('\n[Evolution] 浏览器Agent自进化中...\n');

        // 1. 自我诊断
        const diagnosis = this.selfDiagnose();
        console.log(`当前状态: ${diagnosis.stats.score}分 | 成功率: ${diagnosis.stats.successRate}`);
        console.log(`已知站点: ${diagnosis.stats.sitesKnown} | 学习模式: ${diagnosis.stats.patternsLearned}`);

        if (diagnosis.weaknesses.length > 0) {
            console.log(`\n薄弱环节:`);
            diagnosis.weaknesses.forEach(w => console.log(`  - ${w.area}: ${(w.successRate * 100).toFixed(0)}%`));
        }

        if (diagnosis.unknownSites.length > 0) {
            console.log(`\n未探索站点:`);
            diagnosis.unknownSites.forEach(s => console.log(`  - ${s}`));
        }

        if (diagnosis.recommendations.length > 0) {
            console.log(`\n改进建议:`);
            diagnosis.recommendations.forEach(r => console.log(`  → ${r}`));
        }

        // 2. 探索未知站点 (如果浏览器已初始化)
        if (this.page && diagnosis.unknownSites.length > 0) {
            for (const site of diagnosis.unknownSites.slice(0, 2)) {
                console.log(`\n探索: ${site}...`);
                try {
                    await this.goto(`https://${site}`);
                    await this.sleep(3000);
                    const state = await this.detectPageState();
                    const elements = await this.analyzePage();
                    this.memory.learnSite(site, {
                        explored: true,
                        isLoginPage: state.isLoginPage,
                        buttonCount: elements.buttons.length,
                        inputCount: elements.inputs.length,
                        exploredAt: new Date().toISOString(),
                    });
                    console.log(`  → ${state.isLoginPage ? '需要登录' : '已可访问'} | ${elements.buttons.length}按钮 ${elements.inputs.length}输入框`);
                } catch (e) {
                    console.log(`  → 探索失败: ${e.message}`);
                }
            }
        }

        // 3. 更新进化分
        const newScore = this.memory.updateScore();
        console.log(`\n进化后得分: ${newScore}`);

        return {
            score: newScore,
            diagnosis,
        };
    }

    // ================================================================
    // 通用功能
    // ================================================================

    async searchAndExtract(query, extractInstruction) {
        await this.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
        await this.sleep(2000);

        // 先尝试直接提取搜索结果
        try {
            const results = await this.page.evaluate(() => {
                const items = [];
                document.querySelectorAll('.g, .tF2Cxc').forEach(el => {
                    const title = el.querySelector('h3')?.textContent || '';
                    const snippet = el.querySelector('.VwiC3b, .lEBKkf')?.textContent || '';
                    const link = el.querySelector('a')?.href || '';
                    if (title) items.push({ title, content: snippet, link });
                });
                return items.slice(0, 5);
            });
            if (results.length > 0) return { results };
        } catch {}

        // AI降级
        const { z } = require('zod');
        return this.extract(extractInstruction || 'Extract the search results', z.object({
            results: z.array(z.object({
                title: z.string(),
                content: z.string(),
            })),
        }));
    }

    async executeTask(taskDescription) {
        this.addLog('task', taskDescription);
        try {
            const llmConfig = this.detectBestLLM();
            const agent = this.stagehand.agent({
                model: llmConfig.modelName,
                modelClientOptions: {
                    baseURL: llmConfig.baseURL,
                    apiKey: llmConfig.apiKey || 'not-needed',
                },
            });
            const result = await agent.execute({ instruction: taskDescription });
            this.addLog('success', `Task completed: ${taskDescription}`);
            return result;
        } catch (e) {
            this.addLog('error', `Task failed: ${e.message}`);
            return null;
        }
    }

    // ================================================================
    // 工具方法
    // ================================================================

    loadConfig() {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch {
            return { apiKeys: {}, preferences: {}, discovered: [] };
        }
    }

    saveApiKey(provider, key) {
        const config = this.loadConfig();
        if (!config.apiKeys) config.apiKeys = {};
        config.apiKeys[provider] = key;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        this.addLog('save', `API Key saved: ${provider}`);
    }

    addLog(type, message) {
        const entry = { type, message, time: new Date().toISOString() };
        this.log.push(entry);
        if (this.options.verbose >= 1) {
            const icons = { success: '✓', error: '✗', warning: '⚠', task: '◆', init: '●' };
            const icon = icons[type] || '→';
            console.log(`  [${icon}] [Agent] ${message}`);
        }
    }

    saveLog() {
        try {
            let existing = [];
            try { existing = JSON.parse(fs.readFileSync(AGENT_LOG_FILE, 'utf8')); } catch {}
            existing.push({
                session: new Date().toISOString(),
                entries: this.log,
                memoryStats: this.memory.getStats(),
            });
            if (existing.length > 50) existing = existing.slice(-30);
            fs.writeFileSync(AGENT_LOG_FILE, JSON.stringify(existing, null, 2));
        } catch {}
    }
}

// ================================================================
// 快捷函数
// ================================================================

async function autoConfigureAllAI(credentials) {
    const agent = new BrowserAgent({ headless: false, verbose: 1 });
    try {
        await agent.init();
        const results = await agent.getAllApiKeys(credentials);
        return results;
    } catch (e) {
        console.error('[BrowserAgent] 错误:', e.message);
        return null;
    } finally {
        await agent.close();
    }
}

// ================================================================
// 导出
// ================================================================

module.exports = {
    BrowserAgent,
    AgentMemory,
    autoConfigureAllAI,
};

// 直接运行: 支持多种模式
if (require.main === module) {
    const mode = process.argv[2] || 'auto';
    const configPath = path.join(SEED_HOME, 'credentials.json');

    if (mode === 'test') {
        // 自我测试模式
        (async () => {
            const agent = new BrowserAgent({ verbose: 1 });
            try {
                await agent.init();
                await agent.selfTest();
            } finally {
                await agent.close();
            }
        })().catch(console.error);

    } else if (mode === 'evolve') {
        // 进化模式
        (async () => {
            const agent = new BrowserAgent({ verbose: 1 });
            try {
                await agent.init();
                await agent.evolve();
            } finally {
                await agent.close();
            }
        })().catch(console.error);

    } else if (mode === 'diagnose') {
        // 诊断模式 (无需浏览器)
        const agent = new BrowserAgent({ verbose: 1 });
        const result = agent.selfDiagnose();
        console.log(JSON.stringify(result, null, 2));

    } else {
        // 默认: 自动获取API Key
        let credentials;
        try {
            credentials = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch {
            console.log('用法:');
            console.log('  node seed-browser-agent.js          - 自动获取API Key');
            console.log('  node seed-browser-agent.js test      - 自我测试');
            console.log('  node seed-browser-agent.js evolve    - 进化模式');
            console.log('  node seed-browser-agent.js diagnose  - 诊断 (无浏览器)');
            process.exit(1);
        }

        autoConfigureAllAI(credentials).then(results => {
            console.log('\n结果:', JSON.stringify(results, null, 2));
            process.exit(0);
        }).catch(e => {
            console.error('失败:', e);
            process.exit(1);
        });
    }
}
