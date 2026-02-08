/**
 * 活体种子AI - LLM驱动进化引擎
 *
 * 核心理念: 用AI进化AI
 *
 * 能力:
 * 1. 代码自分析 - LLM分析自身代码，找出改进点
 * 2. 代码自生成 - LLM生成新的功能代码
 * 3. 网络知识获取 - 搜索并学习新技术
 * 4. 自我评估 - 评估进化效果
 * 5. Claude协作 - 接收更高级AI的指导
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const SEED_PATH = __dirname;
const EVOLUTION_LOG = path.join(SEED_PATH, 'llm-evolution-log.json');
const EVOLUTION_QUEUE = path.join(SEED_PATH, 'evolution-queue.json');
const CLAUDE_INSTRUCTIONS = path.join(SEED_PATH, 'claude-instructions.json');
const KNOWLEDGE_GRAPH = path.join(SEED_PATH, 'knowledge-graph.json');
const LLM_RESPONSE_CACHE = path.join(SEED_PATH, 'llm-response-cache.json');
const CONTINUOUS_LEARNING_LOG = path.join(SEED_PATH, 'continuous-learning.json');

// 颜色
const Color = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(type, message) {
  const time = new Date().toLocaleTimeString();
  const colors = {
    EVOLVE: Color.magenta,
    ANALYZE: Color.cyan,
    GENERATE: Color.green,
    SEARCH: Color.blue,
    CLAUDE: Color.yellow,
    ERROR: Color.red,
  };
  console.log(`${colors[type] || Color.reset}[${time}] [${type}] ${message}${Color.reset}`);
}

class LLMEvolutionEngine {
  constructor() {
    this.ollamaHost = 'http://127.0.0.1:11434';
    this.model = 'qwen2.5:7b';
    this.evolutionLog = this.loadEvolutionLog();
    this.evolutionQueue = this.loadQueue();
    this.claudeInstructions = this.loadClaudeInstructions();
    this.isEvolving = false;
    this.cycleCount = 0;
  }

  loadEvolutionLog() {
    const defaults = { cycles: [], improvements: [], codeChanges: [] };
    try {
      if (fs.existsSync(EVOLUTION_LOG)) {
        const data = JSON.parse(fs.readFileSync(EVOLUTION_LOG, 'utf8'));
        return { ...defaults, ...data };
      }
    } catch (e) { console.error(e); }
    return defaults;
  }

  saveEvolutionLog() {
    fs.writeFileSync(EVOLUTION_LOG, JSON.stringify(this.evolutionLog, null, 2));
  }

  loadQueue() {
    try {
      if (fs.existsSync(EVOLUTION_QUEUE)) {
        const data = JSON.parse(fs.readFileSync(EVOLUTION_QUEUE, 'utf8'));
        // 兼容旧格式 { queue: [], lastUpdate } → 新格式 { pending: [], completed: [] }
        if (data.queue && !data.pending) {
          return { pending: data.queue, completed: [] };
        }
        // 确保pending和completed都是数组
        return {
          pending: Array.isArray(data.pending) ? data.pending : [],
          completed: Array.isArray(data.completed) ? data.completed : [],
        };
      }
    } catch (e) {}
    return { pending: [], completed: [] };
  }

  saveQueue() {
    fs.writeFileSync(EVOLUTION_QUEUE, JSON.stringify(this.evolutionQueue, null, 2));
  }

  loadClaudeInstructions() {
    try {
      if (fs.existsSync(CLAUDE_INSTRUCTIONS)) {
        return JSON.parse(fs.readFileSync(CLAUDE_INSTRUCTIONS, 'utf8'));
      }
    } catch (e) {}
    return { instructions: [], lastUpdate: 0 };
  }

  saveClaudeInstructions() {
    fs.writeFileSync(CLAUDE_INSTRUCTIONS, JSON.stringify(this.claudeInstructions, null, 2));
  }

  /**
   * HTTP请求
   */
  async httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const req = protocol.request(url, {
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 120000,
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  }

  /**
   * 调用LLM
   */
  async askLLM(prompt, systemPrompt = '') {
    try {
      const response = await this.httpRequest(`${this.ollamaHost}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        timeout: 180000,
        body: {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt || '你是活体种子AI的进化引擎核心。你的任务是分析代码、提出改进、生成新功能。' },
            { role: 'user', content: prompt }
          ],
          stream: false,
          options: { temperature: 0.7, num_predict: 2000 }
        },
      });

      if (response.status === 200 && response.data.message) {
        return { success: true, content: response.data.message.content };
      }
      return { success: false, error: 'No response' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * 核心能力1: 代码自分析
   */
  async analyzeOwnCode(filePath) {
    log('ANALYZE', `分析代码: ${path.basename(filePath)}`);

    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const codePreview = code.substring(0, 8000); // 限制长度

      const prompt = `请分析以下JavaScript代码，找出可以改进的地方：

\`\`\`javascript
${codePreview}
\`\`\`

请从以下角度分析：
1. 代码质量问题（bug、错误处理）
2. 性能优化机会
3. 可以添加的新功能
4. 代码结构改进

用JSON格式回复：
{
  "issues": [{"type": "bug/performance/structure", "description": "描述", "line": "大概位置"}],
  "suggestions": [{"type": "feature/optimization", "description": "描述", "priority": 1-5}],
  "overall_quality": 1-10
}`;

      const result = await this.askLLM(prompt);

      if (result.success) {
        try {
          // 尝试提取JSON
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let analysis; try { analysis = JSON.parse(jsonMatch[0]); } catch { analysis = null; }
            log('ANALYZE', `分析完成: ${analysis.issues?.length || 0}个问题, ${analysis.suggestions?.length || 0}条建议`);
            return { success: true, analysis };
          }
        } catch (e) {
          // JSON解析失败，返回原始文本
          return { success: true, analysis: { raw: result.content } };
        }
      }

      return result;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  /**
   * 核心能力2: 代码生成
   */
  async generateCode(description, context = '') {
    log('GENERATE', `生成代码: ${description.substring(0, 50)}...`);

    const prompt = `请为活体种子AI生成以下功能的JavaScript代码：

功能描述: ${description}

${context ? `上下文信息: ${context}` : ''}

要求：
1. 代码必须是完整可运行的
2. 包含必要的错误处理
3. 添加清晰的注释
4. 导出为模块或函数

请只返回代码，用\`\`\`javascript包裹。`;

    const result = await this.askLLM(prompt);

    if (result.success) {
      // 提取代码块
      const codeMatch = result.content.match(/```javascript\n([\s\S]*?)```/);
      if (codeMatch) {
        return { success: true, code: codeMatch[1] };
      }
      return { success: true, code: result.content };
    }

    return result;
  }

  /**
   * 核心能力3: 网络搜索学习 (带重试和多源搜索)
   */
  async searchAndLearn(topic, retries = 3) {
    log('SEARCH', `搜索学习: ${topic}`);

    // 关键词变体
    const keywords = [
      topic,
      topic + ' javascript',
      topic + ' nodejs',
      topic.replace(/ /g, '-'),
    ];

    for (let retry = 0; retry < retries; retry++) {
      const keyword = keywords[retry % keywords.length];

      try {
        // 搜索GitHub
        const encodedTopic = encodeURIComponent(keyword);
        const response = await this.httpRequest(
          `https://api.github.com/search/repositories?q=${encodedTopic}&sort=stars&per_page=5`,
          {
            headers: {
              'User-Agent': 'SeedAI-Evolution/1.0',
              'Accept': 'application/vnd.github.v3+json'
            },
            timeout: 15000
          }
        );

        if (response.status === 200 && response.data.items && response.data.items.length > 0) {
          const projects = response.data.items.map(repo => ({
            name: repo.full_name,
            description: repo.description,
            stars: repo.stargazers_count,
            url: repo.html_url,
            topics: repo.topics,
          }));

          // 让LLM分析这些项目，提取可学习的内容
          const analysisPrompt = `我发现了以下开源项目，请分析它们对活体种子AI的价值：

${projects.map(p => `- ${p.name} (${p.stars}⭐): ${p.description}`).join('\n')}

请分析：
1. 哪些项目最有学习价值？
2. 可以借鉴什么技术或思路？
3. 建议整合哪些功能？`;

          const analysis = await this.askLLM(analysisPrompt);

          // 保存学习结果
          this.saveLearningResult(topic, projects, analysis);

          return {
            success: true,
            projects,
            analysis: analysis.success ? analysis.content : null
          };
        }

        // 无结果，尝试下一个关键词
        if (retry < retries - 1) {
          log('SEARCH', `关键词"${keyword}"无结果，尝试变体...`);
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (e) {
        log('SEARCH', `搜索失败(${retry + 1}/${retries}): ${e.message}`);
        if (retry < retries - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    return { success: false, error: 'All search attempts failed' };
  }

  /**
   * 保存学习结果到持续学习日志
   */
  saveLearningResult(topic, projects, analysis) {
    try {
      let learningLog = { entries: [] };
      if (fs.existsSync(CONTINUOUS_LEARNING_LOG)) {
        const raw = JSON.parse(fs.readFileSync(CONTINUOUS_LEARNING_LOG, 'utf8'));
        // 兼容旧格式（数组）→ 新格式（对象）
        if (Array.isArray(raw)) {
          learningLog = { entries: raw };
        } else {
          learningLog = raw;
          if (!Array.isArray(learningLog.entries)) {
            learningLog.entries = [];
          }
        }
      }

      learningLog.entries.push({
        timestamp: Date.now(),
        topic,
        projectsFound: projects.length,
        topProjects: projects.slice(0, 3).map(p => p.name),
        hasAnalysis: analysis?.success || false,
      });

      // 保留最近500条
      if (learningLog.entries.length > 500) {
        learningLog.entries = learningLog.entries.slice(-500);
      }

      learningLog.lastUpdate = Date.now();
      learningLog.totalSearches = (learningLog.totalSearches || 0) + 1;

      fs.writeFileSync(CONTINUOUS_LEARNING_LOG, JSON.stringify(learningLog, null, 2));
    } catch (e) {
      log('ERROR', `保存学习结果失败: ${e.message}`);
    }
  }

  /**
   * 核心能力4: 自我评估
   */
  async evaluateSelf() {
    log('EVOLVE', '执行自我评估...');

    // 收集种子的所有核心文件
    const coreFiles = [
      'seed-brain.js',
      'seed-chat.js',
      'seed-auto-evolution.js',
      'seed-self-evolve.js',
      'seed-llm-integrator.js',
    ];

    const fileStats = [];
    for (const file of coreFiles) {
      const filePath = path.join(SEED_PATH, file);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        fileStats.push({
          name: file,
          size: stat.size,
          lines: content.split('\n').length,
          functions: (content.match(/function\s+\w+|async\s+\w+\s*\(|=>\s*\{/g) || []).length,
        });
      }
    }

    const prompt = `请评估活体种子AI的当前状态：

核心文件统计：
${fileStats.map(f => `- ${f.name}: ${f.lines}行, ${f.functions}个函数`).join('\n')}

进化历史：
- 已完成周期: ${this.evolutionLog.cycles.length}
- 代码改进次数: ${this.evolutionLog.codeChanges.length}

请评估：
1. 当前进化阶段（初级/中级/高级）
2. 最需要改进的能力
3. 下一步进化方向建议

用JSON格式回复：
{
  "stage": "初级/中级/高级",
  "score": 1-100,
  "weaknesses": ["弱点1", "弱点2"],
  "nextSteps": ["下一步1", "下一步2"],
  "recommendation": "总体建议"
}`;

    const result = await this.askLLM(prompt);

    if (result.success) {
      try {
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return { success: true, evaluation: JSON.parse(jsonMatch[0]) };
        }
      } catch (e) {}
      return { success: true, evaluation: { raw: result.content } };
    }

    return result;
  }

  /**
   * 核心能力5: Claude协作接口
   * Claude可以通过写入指令文件来指导种子进化
   */
  processClaudeInstructions() {
    const instructions = this.claudeInstructions.instructions.filter(i => !i.processed);

    for (const instruction of instructions) {
      log('CLAUDE', `处理Claude指令: ${instruction.type}`);

      switch (instruction.type) {
        case 'add_feature':
          this.evolutionQueue.pending.push({
            type: 'generate',
            description: instruction.description,
            priority: instruction.priority || 3,
            source: 'claude',
            timestamp: Date.now(),
          });
          break;

        case 'fix_issue':
          this.evolutionQueue.pending.push({
            type: 'fix',
            file: instruction.file,
            issue: instruction.issue,
            priority: instruction.priority || 5,
            source: 'claude',
            timestamp: Date.now(),
          });
          break;

        case 'search_learn':
          this.evolutionQueue.pending.push({
            type: 'search',
            topic: instruction.topic,
            priority: instruction.priority || 2,
            source: 'claude',
            timestamp: Date.now(),
          });
          break;

        case 'evolve_direction':
          this.evolutionLog.directionFromClaude = instruction.direction;
          break;
      }

      instruction.processed = true;
      instruction.processedAt = Date.now();
    }

    this.saveClaudeInstructions();
    this.saveQueue();
  }

  /**
   * 添加Claude指令（供外部调用）
   */
  addClaudeInstruction(instruction) {
    this.claudeInstructions.instructions.push({
      ...instruction,
      addedAt: Date.now(),
      processed: false,
    });
    this.claudeInstructions.lastUpdate = Date.now();
    this.saveClaudeInstructions();
    log('CLAUDE', `新指令已添加: ${instruction.type}`);
  }

  /**
   * 执行一轮进化
   */
  async runEvolutionCycle() {
    if (this.isEvolving) {
      log('EVOLVE', '上一轮进化尚未完成，跳过');
      return;
    }

    this.isEvolving = true;
    this.cycleCount++;

    log('EVOLVE', `===== 开始第 ${this.cycleCount} 轮LLM驱动进化 =====`);

    const cycleResult = {
      cycle: this.cycleCount,
      timestamp: Date.now(),
      actions: [],
    };

    try {
      // 1. 处理Claude指令
      this.processClaudeInstructions();

      // 2. 处理进化队列
      const pendingTasks = this.evolutionQueue.pending
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
        .slice(0, 3); // 每轮最多处理3个任务

      for (const task of pendingTasks) {
        log('EVOLVE', `处理任务: ${task.type} - ${task.description || task.topic || task.issue}`);

        let result;
        switch (task.type) {
          case 'generate':
            result = await this.generateCode(task.description);
            break;
          case 'search':
            result = await this.searchAndLearn(task.topic);
            break;
          case 'analyze':
            result = await this.analyzeOwnCode(path.join(SEED_PATH, task.file));
            break;
        }

        cycleResult.actions.push({
          task: task.type,
          success: result?.success || false,
        });

        // 移动到已完成
        this.evolutionQueue.pending = this.evolutionQueue.pending.filter(t => t !== task);
        this.evolutionQueue.completed.push({ ...task, result, completedAt: Date.now() });
      }

      // 3. 如果队列空闲，自动寻找进化方向
      if (this.evolutionQueue.pending.length === 0 && this.cycleCount % 5 === 0) {
        log('EVOLVE', '队列空闲，执行自我评估...');
        const evaluation = await this.evaluateSelf();

        if (evaluation.success && evaluation.evaluation?.nextSteps && Array.isArray(evaluation.evaluation.nextSteps)) {
          for (const step of evaluation.evaluation.nextSteps.slice(0, 2)) {
            this.evolutionQueue.pending.push({
              type: 'search',
              topic: step,
              priority: 2,
              source: 'self-evaluation',
              timestamp: Date.now(),
            });
          }
        }

        cycleResult.evaluation = evaluation.evaluation;
      }

      // 4. 每10轮进行一次代码自分析
      if (this.cycleCount % 10 === 0) {
        const files = ['seed-brain.js', 'seed-chat.js'];
        const file = files[this.cycleCount % files.length];
        log('EVOLVE', `定期代码分析: ${file}`);

        const analysis = await this.analyzeOwnCode(path.join(SEED_PATH, file));
        cycleResult.codeAnalysis = analysis;

        // 如果发现问题，加入队列
        if (analysis.success && analysis.analysis?.suggestions) {
          for (const suggestion of analysis.analysis.suggestions.slice(0, 2)) {
            if (suggestion.priority >= 3) {
              this.evolutionQueue.pending.push({
                type: 'generate',
                description: suggestion.description,
                priority: suggestion.priority,
                source: 'code-analysis',
                timestamp: Date.now(),
              });
            }
          }
        }
      }

    } catch (e) {
      log('ERROR', `进化周期错误: ${e.message}`);
      cycleResult.error = e.message;
    }

    // 保存进化日志
    this.evolutionLog.cycles.push(cycleResult);
    if (this.evolutionLog.cycles.length > 100) {
      this.evolutionLog.cycles = this.evolutionLog.cycles.slice(-100);
    }
    this.saveEvolutionLog();
    this.saveQueue();

    this.isEvolving = false;
    log('EVOLVE', `===== 第 ${this.cycleCount} 轮进化完成 =====\n`);

    return cycleResult;
  }

  /**
   * 启动持续进化
   */
  startContinuousEvolution(intervalMs = 60000) { // 改为1分钟
    log('EVOLVE', `启动LLM驱动持续进化 (间隔: ${intervalMs/1000}秒)`);

    // 立即执行一次
    this.runEvolutionCycle();

    // 定时执行进化周期
    setInterval(() => {
      this.runEvolutionCycle();
    }, intervalMs);

    // 启动持续网络学习（每小时）
    this.startContinuousLearning();

    // 启动内存自动清理（每小时检查一次）
    this.startAutoMemoryCleanup();
  }

  /**
   * 自动内存清理 - 防止内存无限增长
   */
  startAutoMemoryCleanup() {
    log('EVOLVE', '启动内存自动清理 (每小时检查)');

    const checkAndCleanup = async () => {
      try {
        const { shouldAutoCleanup, cleanup } = require('./seed-memory-cleanup');

        if (shouldAutoCleanup()) {
          log('EVOLVE', '[内存清理] 检测到内存过大，自动清理中...');
          await cleanup();
          log('EVOLVE', '[内存清理] 清理完成');
        }
      } catch (e) {
        // 清理模块可能不存在，忽略
      }
    };

    // 立即检查一次
    checkAndCleanup();

    // 每小时检查
    setInterval(checkAndCleanup, 3600000);
  }

  /**
   * 持续网络学习 - 每小时搜索最新AI技术
   */
  startContinuousLearning() {
    log('SEARCH', '启动持续网络学习 (每小时自动搜索)');

    // AI领域热门主题
    const learningTopics = [
      'AI self-improvement 2026',
      'autonomous agent framework',
      'code generation AI latest',
      'knowledge graph neural network',
      'self-evolving AI system',
      'LLM fine-tuning techniques',
      'AI memory systems',
      'multi-agent collaboration',
      'neural code synthesis',
      'AI reasoning capabilities',
    ];

    let topicIndex = 0;

    // 每小时搜索一个主题
    setInterval(async () => {
      const topic = learningTopics[topicIndex % learningTopics.length];
      topicIndex++;

      log('SEARCH', `[持续学习] 自动搜索: ${topic}`);

      const result = await this.searchAndLearn(topic);

      if (result.success) {
        log('SEARCH', `[持续学习] 发现 ${result.projects?.length || 0} 个相关项目`);

        // 如果发现高价值项目，加入进化队列
        if (result.projects && result.projects.some(p => p.stars > 5000)) {
          this.evolutionQueue.pending.push({
            type: 'analyze_project',
            topic: topic,
            projects: result.projects.filter(p => p.stars > 5000),
            priority: 4,
            source: 'continuous-learning',
            timestamp: Date.now(),
          });
          this.saveQueue();
        }
      }
    }, 3600000); // 每小时

    // 立即执行一次
    setTimeout(async () => {
      const topic = learningTopics[0];
      log('SEARCH', `[持续学习] 初始搜索: ${topic}`);
      await this.searchAndLearn(topic);
    }, 30000); // 30秒后开始第一次搜索
  }

  /**
   * 保存知识图谱
   */
  saveKnowledgeGraph(nodes, edges) {
    try {
      let graph = { nodes: [], edges: [], lastUpdate: 0 };
      if (fs.existsSync(KNOWLEDGE_GRAPH)) {
        graph = JSON.parse(fs.readFileSync(KNOWLEDGE_GRAPH, 'utf8'));
      }

      // 合并新节点
      for (const node of nodes) {
        const existing = graph.nodes.find(n => n.id === node.id);
        if (existing) {
          existing.weight = (existing.weight || 1) + 1;
          existing.lastSeen = Date.now();
        } else {
          graph.nodes.push({ ...node, weight: 1, addedAt: Date.now() });
        }
      }

      // 合并新边
      for (const edge of edges) {
        const existing = graph.edges.find(e => e.from === edge.from && e.to === edge.to);
        if (existing) {
          existing.weight = (existing.weight || 1) + 1;
        } else {
          graph.edges.push({ ...edge, weight: 1, addedAt: Date.now() });
        }
      }

      // 限制大小
      if (graph.nodes.length > 1000) {
        graph.nodes = graph.nodes.sort((a, b) => b.weight - a.weight).slice(0, 1000);
      }
      if (graph.edges.length > 5000) {
        graph.edges = graph.edges.sort((a, b) => b.weight - a.weight).slice(0, 5000);
      }

      graph.lastUpdate = Date.now();
      fs.writeFileSync(KNOWLEDGE_GRAPH, JSON.stringify(graph, null, 2));
      log('EVOLVE', `知识图谱已更新: ${graph.nodes.length}节点, ${graph.edges.length}边`);
    } catch (e) {
      log('ERROR', `保存知识图谱失败: ${e.message}`);
    }
  }

  /**
   * 获取进化状态
   */
  getStatus() {
    return {
      cycleCount: this.cycleCount,
      isEvolving: this.isEvolving,
      pendingTasks: this.evolutionQueue.pending.length,
      completedTasks: this.evolutionQueue.completed.length,
      totalCycles: this.evolutionLog.cycles.length,
      lastCycle: this.evolutionLog.cycles[this.evolutionLog.cycles.length - 1],
      claudeInstructions: this.claudeInstructions.instructions.filter(i => !i.processed).length,
      continuousLearning: fs.existsSync(CONTINUOUS_LEARNING_LOG)
        ? JSON.parse(fs.readFileSync(CONTINUOUS_LEARNING_LOG, 'utf8')).totalSearches || 0
        : 0,
    };
  }
}

// 导出
module.exports = { LLMEvolutionEngine };

// 如果直接运行
if (require.main === module) {
  const engine = new LLMEvolutionEngine();

  console.log('\n' + '='.repeat(60));
  console.log('  活体种子AI - LLM驱动进化引擎 v2.0');
  console.log('  用AI进化AI - 几何倍数进化');
  console.log('='.repeat(60));
  console.log('  进化周期: 每1分钟');
  console.log('  持续学习: 每1小时搜索最新AI技术');
  console.log('  知识图谱: 自动持久化');
  console.log('='.repeat(60) + '\n');

  // 启动持续进化（每1分钟一轮）
  engine.startContinuousEvolution(60000);
}
