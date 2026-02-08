/**
 * 智能搜索进化 - 根据弱点自动搜索最新开源方案
 * 不是固定搜索，而是: 分析弱点→搜索方案→评估可行性→推荐升级
 */
const https = require('https');

// npm搜索
async function searchNpm(keyword) {
    return new Promise((resolve) => {
        https.get('https://registry.npmjs.org/-/v1/search?text=' + encodeURIComponent(keyword) + '&size=5', (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const results = JSON.parse(data).objects || [];
                    resolve(results.map(r => ({
                        name: r.package.name,
                        description: r.package.description,
                        version: r.package.version,
                        score: r.score?.final || 0
                    })));
                } catch { resolve([]); }
            });
        }).on('error', () => resolve([]));
    });
}

// 根据弱点生成搜索策略
function generateSearchQueries(weakCapabilities) {
    const queryMap = {
        nlu: ['natural language understanding javascript', 'intent classification npm', 'chinese text nlp node'],
        memory: ['vector database javascript', 'semantic search node', 'embedding store npm'],
        codegen: ['code generation javascript', 'llm api wrapper node', 'ast parser npm'],
        reasoning: ['chain of thought prompt', 'task planning ai agent', 'reasoning framework node'],
    };

    const queries = [];
    for (const cap of weakCapabilities) {
        if (queryMap[cap]) {
            queries.push(...queryMap[cap]);
        }
    }
    return queries;
}

// 评估npm包是否适合升级
function evaluatePackage(pkg) {
    let score = 0;
    if (pkg.score > 0.5) score += 3;    // npm质量分
    if (pkg.description && pkg.description.length > 20) score += 1;
    // 排除太大或不相关的包
    if (['react', 'vue', 'angular', 'express'].includes(pkg.name)) score -= 5;
    return score;
}

// 自动搜索最佳开源方案
async function findUpgrades(benchmarkResults) {
    const weakAreas = [];
    if (benchmarkResults.nlu?.score < 60) weakAreas.push('nlu');
    if (benchmarkResults.memory?.score < 60) weakAreas.push('memory');
    if (benchmarkResults.codegen?.score < 60) weakAreas.push('codegen');

    const queries = generateSearchQueries(weakAreas);
    const allResults = [];

    for (const query of queries.slice(0, 5)) {
        const results = await searchNpm(query);
        allResults.push(...results.map(r => ({ ...r, query, relevance: evaluatePackage(r) })));
    }

    // 按相关性排序
    allResults.sort((a, b) => b.relevance - a.relevance);
    return allResults.slice(0, 10);
}

module.exports = { searchNpm, findUpgrades, generateSearchQueries, evaluatePackage };
