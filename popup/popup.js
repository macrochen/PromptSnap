let currentFilter = 'ALL'; // 当前选中的分类

document.addEventListener('DOMContentLoaded', () => {
    loadPrompts();

    document.getElementById('btn-add').addEventListener('click', () => {
        chrome.tabs.create({ url: 'editor.html' });
    });
});

function loadPrompts() {
    chrome.storage.local.get(['prompts'], (result) => {
        let prompts = result.prompts || [];
        
        // 兼容处理：如果没有 category 字段，默认为 '未分类'
        prompts.forEach(p => {
            if (!p.category) p.category = '未分类';
        });

        // 提取所有分类
        const categories = new Set(['ALL']);
        prompts.forEach(p => categories.add(p.category));
        
        // 渲染分类标签栏
        renderTags(Array.from(categories), prompts);

        // 渲染列表 (初始显示全部)
        renderList(prompts);
    });
}

function renderTags(categories, allPrompts) {
    const bar = document.getElementById('tags-bar');
    bar.innerHTML = '';

    categories.forEach(cat => {
        const tag = document.createElement('div');
        tag.className = `tag ${cat === currentFilter ? 'active' : ''}`;
        // 显示名称 (ALL -> 全部)
        tag.textContent = cat === 'ALL' ? '全部' : cat;
        
        tag.addEventListener('click', () => {
            // 切换选中状态
            currentFilter = cat;
            
            // 更新 UI 高亮
            document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            
            // 过滤并重新渲染列表
            const filtered = cat === 'ALL' 
                ? allPrompts 
                : allPrompts.filter(p => p.category === cat);
            
            renderList(filtered);
        });
        
        bar.appendChild(tag);
    });
}

function renderList(prompts) {
    // 排序逻辑：按最后使用/创建时间倒序 (新/刚用的在最前)
    prompts.sort((a, b) => {
        const timeA = a.lastUsedAt || a.id || 0; // 兜底：旧数据可能没有 lastUsedAt，用 id 代替
        const timeB = b.lastUsedAt || b.id || 0;
        return timeB - timeA;
    });
    
    const listEl = document.getElementById('list');
    listEl.innerHTML = '';

    if (prompts.length === 0) {
        listEl.innerHTML = '<div class="empty">暂无 Prompt</div>';
        return;
    }

    prompts.forEach(p => {
        const item = document.createElement('div');
        item.className = 'item';
        
        // 列表项 HTML (可选：在标题旁显示小分类标签，或者隐藏，因为上面已经筛了)
        item.innerHTML = `
            <div class="item-title" title="${escapeHtml(p.content)}">
                ${escapeHtml(p.title)}
            </div>
            <div class="item-actions">
                <button class="icon-btn icon-edit" title="编辑">
                    <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                </button>
                <button class="icon-btn icon-delete" title="删除">
                    <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        `;

        // 1. 点击标题 -> 填入 + 计数
        item.querySelector('.item-title').addEventListener('click', () => {
            handleFill(p);
        });

        // 2. 编辑
        item.querySelector('.icon-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.create({ url: `editor.html?id=${p.id}` });
        });

        // 3. 删除
        item.querySelector('.icon-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`确定要删除 "${p.title}" 吗？`)) {
                deletePrompt(p.id);
            }
        });

        listEl.appendChild(item);
    });
}

// 核心：发送消息给当前页面
async function handleFill(prompt) {
    const content = prompt.content;
    const variableRegex = /{{\s*(.*?)\s*}}/g;
    const matches = [...content.matchAll(variableRegex)];

    if (matches.length > 0) {
        // 发现变量，进入变量填入模式
        showVariableInput(prompt, matches);
    } else {
        // 无变量，直接发送
        sendToContent(content, prompt.id);
    }
}

function showVariableInput(prompt, matches) {
    // 隐藏主列表，显示变量输入页
    document.querySelector('.header').style.display = 'none';
    document.getElementById('tags-bar').style.display = 'none';
    document.getElementById('list').style.display = 'none';
    
    const modal = document.getElementById('variable-modal');
    const inputsContainer = document.getElementById('variable-inputs');
    modal.style.display = 'block';
    inputsContainer.innerHTML = '';

    // 提取不重复的变量名
    const uniqueVars = [...new Set(matches.map(m => m[1]))];

    // 生成输入框
    uniqueVars.forEach((varName, index) => {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '12px';
        
        const label = document.createElement('label');
        label.textContent = varName;
        label.style.display = 'block';
        label.style.fontSize = '12px';
        label.style.marginBottom = '4px';
        label.style.color = '#5f6368';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.varName = varName;
        input.style.width = '100%';
        input.style.padding = '8px';
        input.style.border = '1px solid #dadce0';
        input.style.borderRadius = '4px';
        input.style.boxSizing = 'border-box';
        
        // 自动聚焦第一个输入框
        if (index === 0) {
            setTimeout(() => input.focus(), 10);
        }

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        inputsContainer.appendChild(wrapper);
    });

    // 绑定按钮事件 (先解绑防止多次绑定)
    const btnConfirm = document.getElementById('btn-var-confirm');
    const btnCancel = document.getElementById('btn-var-cancel');
    
    // 使用 cloneNode 清除之前的事件监听器
    const newBtnConfirm = btnConfirm.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    // 为输入框添加回车监听
    const allInputs = inputsContainer.querySelectorAll('input');
    allInputs.forEach((input, index) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (index < allInputs.length - 1) {
                    allInputs[index + 1].focus();
                } else {
                    newBtnConfirm.click();
                }
            }
        });
    });

    newBtnConfirm.addEventListener('click', () => {
        let finalContent = prompt.content;
        const inputs = inputsContainer.querySelectorAll('input');
        
        inputs.forEach(input => {
            const varName = input.dataset.varName;
            const value = input.value;
            // 全局替换
            // 注意：这里简单替换，如果变量名包含特殊正则字符可能会有问题，但在简单场景下够用
            // 更严谨的做法是构造正则时 escape 变量名
            const regex = new RegExp(`{{\\s*${escapeRegExp(varName)}\\s*}}`, 'g');
            finalContent = finalContent.replace(regex, value);
        });

        sendToContent(finalContent, prompt.id);
    });

    newBtnCancel.addEventListener('click', () => {
        // 恢复显示
        document.querySelector('.header').style.display = 'flex';
        document.getElementById('tags-bar').style.display = 'flex';
        document.getElementById('list').style.display = 'block';
        modal.style.display = 'none';
    });
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function sendToContent(text, promptId) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        // 发送消息
        chrome.tabs.sendMessage(tab.id, { 
            action: 'FILL_PROMPT', 
            text: text 
        }, (response) => {
            // 检查是否有错误
            if (chrome.runtime.lastError) {
                alert('请刷新当前页面后再试 (PromptSnap 需要页面重新加载)');
            } else {
                // 成功 -> 增加计数 + 关闭弹窗
                if (promptId) incrementUsage(promptId);
                window.close();
            }
        });
    } catch (err) {
        console.error(err);
    }
}

function incrementUsage(id) {
    chrome.storage.local.get(['prompts'], (result) => {
        let prompts = result.prompts || [];
        const index = prompts.findIndex(p => p.id === id);
        if (index !== -1) {
            prompts[index].usageCount = (prompts[index].usageCount || 0) + 1;
            prompts[index].lastUsedAt = Date.now(); // 更新最后使用时间
            chrome.storage.local.set({ prompts: prompts });
        }
    });
}

function deletePrompt(id) {
    chrome.storage.local.get(['prompts'], (result) => {
        const prompts = (result.prompts || []).filter(p => p.id !== id);
        chrome.storage.local.set({ prompts: prompts }, () => {
            loadPrompts(); // 刷新列表 (这会重新计算分类和 Tag)
        });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;")
               .replace(/</g, "&lt;")
               .replace(/>/g, "&gt;")
               .replace(/"/g, "&quot;")
               .replace(/'/g, "&#039;");
}
