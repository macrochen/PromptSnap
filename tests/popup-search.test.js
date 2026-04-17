const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const context = {
    document: {
        addEventListener: () => {}
    },
    console,
    chrome: { storage: { local: { get: () => {} } } }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.js'), 'utf8'), context);

const prompts = [
    { title: '代码解释器', category: '编程', content: '解释 JavaScript 代码' },
    { title: '英文润色', category: '写作', content: 'Polish this paragraph' },
    { title: '会议总结', category: '工作', content: '提炼 action items' }
];

assert.deepStrictEqual(
    context.filterPromptsForView(prompts, 'ALL', 'javascript').map(p => p.title),
    ['代码解释器']
);

assert.deepStrictEqual(
    context.filterPromptsForView(prompts, '写作', 'paragraph').map(p => p.title),
    ['英文润色']
);

assert.deepStrictEqual(
    context.filterPromptsForView(prompts, '编程', 'paragraph').map(p => p.title),
    []
);

assert.deepStrictEqual(
    context.filterPromptsForView(prompts, 'ALL', '').map(p => p.title),
    ['代码解释器', '英文润色', '会议总结']
);
