/**
 * PromptSnap Web — Variable Template Engine
 * 
 * 从插件 popup.js 提取的变量模板解析和替换逻辑。
 * 支持语法：
 *   {{变量名}}          — 自由文本输入
 *   {{变量名:默认值}}    — 带默认值的文本输入
 *   {{变量名:A;B;C}}    — 分号分隔时渲染为下拉选择框
 */

const Variables = {
    /**
     * 解析模板内容中的所有变量
     * @param {string} content - Prompt 内容
     * @returns {Array<{name: string, default: string, options: string[]}>}
     */
    parse(content) {
        const regex = /\{\{\s*([\s\S]*?)\s*\}\}/g;
        const matches = [...content.matchAll(regex)];
        const varsMap = new Map();

        matches.forEach(m => {
            const inner = m[1];
            let name = inner;
            let def = '';

            if (inner.includes(':')) {
                const parts = inner.split(':');
                name = parts[0].trim();
                def = parts.slice(1).join(':').trim();
            } else {
                name = name.trim();
            }

            // 去重：同名变量只保留第一个有默认值的
            if (!varsMap.has(name) || (def && !varsMap.get(name))) {
                varsMap.set(name, def);
            }
        });

        return Array.from(varsMap.entries()).map(([name, def]) => {
            const options = def.includes(';')
                ? def.split(';').map(s => s.trim()).filter(s => s)
                : [];
            return { name, default: def, options };
        });
    },

    /**
     * 检测内容中是否包含变量
     */
    hasVariables(content) {
        return /\{\{\s*[\s\S]*?\s*\}\}/.test(content);
    },

    /**
     * 渲染变量输入表单
     * @param {Array} vars - parse() 的返回值
     * @param {HTMLElement} container - 表单容器
     */
    renderForm(vars, container) {
        container.innerHTML = '';

        if (vars.length === 0) {
            const msg = document.createElement('div');
            msg.className = 'var-empty-msg';
            msg.textContent = '此 Prompt 无需填写变量，直接点击确认复制。';
            container.appendChild(msg);
            return;
        }

        vars.forEach((v, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'var-field';

            const label = document.createElement('label');
            label.className = 'var-label';
            label.textContent = v.name;

            let control;
            if (v.options.length > 1) {
                // 下拉选择框
                control = document.createElement('select');
                control.className = 'var-input var-select';
                v.options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    control.appendChild(option);
                });
            } else {
                // 文本输入
                control = document.createElement('textarea');
                control.className = 'var-input var-textarea';
                control.value = v.default;
                control.rows = v.default.includes('\n') ? 4 : 2;
                control.placeholder = `请输入 ${v.name}`;
            }

            control.dataset.varName = v.name;

            // 自动聚焦第一个
            if (index === 0) {
                setTimeout(() => control.focus(), 50);
            }

            wrapper.appendChild(label);
            wrapper.appendChild(control);
            container.appendChild(wrapper);
        });
    },

    /**
     * 从表单中收集值并替换模板
     * @param {string} content - 原始 Prompt 内容
     * @param {HTMLElement} container - 包含 .var-input 的容器
     * @returns {string} 替换后的内容
     */
    resolve(content, container) {
        let result = content;
        const controls = container.querySelectorAll('.var-input');

        controls.forEach(control => {
            const name = control.dataset.varName;
            const value = control.value;
            // 匹配 {{ name }} 或 {{ name:default }}（含换行符的默认值）
            const regex = new RegExp(
                `\\{\\{\\s*${this._escapeRegex(name)}\\s*(?::[\\s\\S]*?)?\\s*\\}\\}`,
                'g'
            );
            result = result.replace(regex, value);
        });

        return result;
    },

    /**
     * 正则转义
     */
    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
};
