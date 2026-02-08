/**
 * 种子自动网络学习引擎
 * 自动从网络获取知识并整合到知识库
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_PATH = __dirname;
const KNOWLEDGE_FILE = path.join(BASE_PATH, 'open-knowledge-base.json');
const LEARNED_FILE = path.join(BASE_PATH, 'learned-from-network.json');

class AutoLearner {
    constructor() {
        this.learnedData = [];
        this.isRunning = false;
        this.learnCount = 0;
        this.loadLearnedData();
    }

    // 加载已学习的数据
    loadLearnedData() {
        try {
            if (fs.existsSync(LEARNED_FILE)) {
                this.learnedData = JSON.parse(fs.readFileSync(LEARNED_FILE, 'utf8'));
            }
        } catch (e) {}
    }

    // 保存学习的数据
    saveLearnedData() {
        fs.writeFileSync(LEARNED_FILE, JSON.stringify(this.learnedData, null, 2), 'utf8');
    }

    // HTTP GET请求
    httpGet(url) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const options = {
                hostname: urlObj.hostname,
                path: urlObj.pathname + urlObj.search,
                headers: { 'User-Agent': 'SeedAI-Learner/1.0' }
            };

            https.get(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
    }

    // 从GitHub学习热门项目
    async learnFromGitHub(topic = 'AI') {
        console.log(`[自动学习] GitHub搜索: ${topic}`);
        try {
            const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}&sort=stars&per_page=10`;
            const data = await this.httpGet(url);
            const result = JSON.parse(data);

            if (result.items) {
                const knowledge = [];
                for (const repo of result.items.slice(0, 5)) {
                    const key = repo.name.toLowerCase();
                    const value = `${repo.name}: ${repo.description || '无描述'} (GitHub ${repo.stargazers_count}星)`;

                    knowledge.push({ key, value, source: 'github', stars: repo.stargazers_count });
                    this.learnedData.push({
                        key,
                        value,
                        source: 'github',
                        url: repo.html_url,
                        learnedAt: new Date().toISOString()
                    });
                }

                this.saveLearnedData();
                this.learnCount += knowledge.length;
                console.log(`[自动学习] 从GitHub学习了 ${knowledge.length} 条知识`);
                return knowledge;
            }
        } catch (e) {
            console.log(`[自动学习] GitHub学习失败: ${e.message}`);
        }
        return [];
    }

    // 从NPM学习热门包
    async learnFromNPM(topic = 'ai') {
        console.log(`[自动学习] NPM搜索: ${topic}`);
        try {
            const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(topic)}&size=10`;
            const data = await this.httpGet(url);
            const result = JSON.parse(data);

            if (result.objects) {
                const knowledge = [];
                for (const obj of result.objects.slice(0, 5)) {
                    const pkg = obj.package;
                    const key = pkg.name.toLowerCase();
                    const value = `${pkg.name}: ${pkg.description || '无描述'} (NPM包)`;

                    knowledge.push({ key, value, source: 'npm' });
                    this.learnedData.push({
                        key,
                        value,
                        source: 'npm',
                        version: pkg.version,
                        learnedAt: new Date().toISOString()
                    });
                }

                this.saveLearnedData();
                this.learnCount += knowledge.length;
                console.log(`[自动学习] 从NPM学习了 ${knowledge.length} 条知识`);
                return knowledge;
            }
        } catch (e) {
            console.log(`[自动学习] NPM学习失败: ${e.message}`);
        }
        return [];
    }

    // 整合知识到主知识库
    integrateKnowledge(newKnowledge) {
        try {
            let data = { knowledge: {} };
            if (fs.existsSync(KNOWLEDGE_FILE)) {
                data = JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, 'utf8'));
            }

            let added = 0;
            for (const item of newKnowledge) {
                if (!data.knowledge[item.key]) {
                    data.knowledge[item.key] = item.value;
                    added++;
                }
            }

            data.count = Object.keys(data.knowledge).length;
            data.updatedAt = new Date().toISOString();

            fs.writeFileSync(KNOWLEDGE_FILE, JSON.stringify(data, null, 2), 'utf8');
            console.log(`[自动学习] 整合了 ${added} 条新知识，总计 ${data.count} 条`);
            return added;
        } catch (e) {
            console.log(`[自动学习] 整合失败: ${e.message}`);
            return 0;
        }
    }

    // 执行一次学习周期
    async learnOnce(topics = ['AI', 'machine-learning', 'chatbot', 'automation']) {
        console.log('\n========== 自动学习周期开始 ==========\n');

        const allKnowledge = [];

        // 从多个来源学习
        for (const topic of topics) {
            const github = await this.learnFromGitHub(topic);
            allKnowledge.push(...github);
            await this.delay(1000); // 避免请求过快

            const npm = await this.learnFromNPM(topic);
            allKnowledge.push(...npm);
            await this.delay(1000);
        }

        // 整合到知识库
        const added = this.integrateKnowledge(allKnowledge);

        console.log('\n========== 自动学习周期完成 ==========');
        console.log(`本次学习: ${allKnowledge.length} 条`);
        console.log(`新增知识: ${added} 条`);
        console.log(`总学习量: ${this.learnCount} 条\n`);

        return { learned: allKnowledge.length, added };
    }

    // 启动持续学习
    async startContinuousLearning(intervalMinutes = 30) {
        if (this.isRunning) {
            console.log('[自动学习] 已经在运行中');
            return;
        }

        this.isRunning = true;
        console.log(`[自动学习] 启动持续学习，间隔 ${intervalMinutes} 分钟`);

        // 立即执行一次
        await this.learnOnce();

        // 定时执行
        this.timer = setInterval(async () => {
            if (this.isRunning) {
                await this.learnOnce();
            }
        }, intervalMinutes * 60 * 1000);
    }

    // 停止持续学习
    stopContinuousLearning() {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        console.log('[自动学习] 已停止');
    }

    // 获取学习统计
    getStats() {
        return {
            isRunning: this.isRunning,
            totalLearned: this.learnedData.length,
            learnCount: this.learnCount,
            sources: {
                github: this.learnedData.filter(d => d.source === 'github').length,
                npm: this.learnedData.filter(d => d.source === 'npm').length
            }
        };
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 创建单例
const autoLearner = new AutoLearner();

// 命令行支持
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'once';

    if (command === 'once') {
        autoLearner.learnOnce().then(() => process.exit(0));
    } else if (command === 'continuous') {
        autoLearner.startContinuousLearning(parseInt(args[1]) || 30);
    } else if (command === 'stats') {
        console.log(autoLearner.getStats());
    } else {
        console.log('用法: node seed-auto-learner.js [once|continuous|stats]');
    }
}

module.exports = { AutoLearner, autoLearner };
