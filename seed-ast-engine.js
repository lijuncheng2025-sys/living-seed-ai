/**
 * AST代码分析引擎 - 真正理解代码结构
 * 不是字符串匹配，而是语法树分析
 */
const acorn = require('acorn');
const estraverse = require('estraverse');

function analyzeCode(code) {
    try {
        const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
        const analysis = {
            functions: [],
            classes: [],
            imports: [],
            exports: [],
            variables: [],
            complexity: 0,
        };

        estraverse.traverse(ast, {
            enter(node) {
                switch (node.type) {
                    case 'FunctionDeclaration':
                        analysis.functions.push({ name: node.id?.name, params: node.params.length, loc: node.loc });
                        analysis.complexity++;
                        break;
                    case 'ClassDeclaration':
                        analysis.classes.push({ name: node.id?.name, loc: node.loc });
                        break;
                    case 'ImportDeclaration':
                        analysis.imports.push({ source: node.source.value });
                        break;
                    case 'ExportNamedDeclaration':
                    case 'ExportDefaultDeclaration':
                        analysis.exports.push({ type: node.type });
                        break;
                    case 'VariableDeclaration':
                        node.declarations.forEach(d => {
                            analysis.variables.push({ name: d.id?.name, kind: node.kind });
                        });
                        break;
                    case 'IfStatement':
                    case 'ForStatement':
                    case 'WhileStatement':
                    case 'SwitchStatement':
                        analysis.complexity++;
                        break;
                }
            }
        });

        return analysis;
    } catch (e) {
        return { error: e.message, functions: [], classes: [] };
    }
}

module.exports = { analyzeCode };
