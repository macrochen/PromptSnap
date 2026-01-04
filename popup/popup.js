document.addEventListener('DOMContentLoaded', () => {
    loadPrompts();

    document.getElementById('btn-add').addEventListener('click', () => {
        chrome.tabs.create({ url: 'editor.html' });
    });
});

function loadPrompts() {
    chrome.storage.local.get(['prompts'], (result) => {
        let prompts = result.prompts || [];
        
        // 排序：使用次数高 -> 低
        prompts.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
        
        const listEl = document.getElementById('list');
        listEl.innerHTML = '';

        if (prompts.length === 0) {
            listEl.innerHTML = '<div class="empty">暂无 Prompt，点击 New 添加</div>';
            return;
        }

        prompts.forEach(p => {
            const item = document.createElement('div');
            item.className = 'item';
            
            // 列表项 HTML
            item.innerHTML = `
                <div class="item-title" title="${escapeHtml(p.content)}">${escapeHtml(p.title)}</div>
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
    });
}

// 核心：发送消息给当前页面
async function handleFill(prompt) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        // 发送消息
        chrome.tabs.sendMessage(tab.id, { 
            action: 'FILL_PROMPT', 
            text: prompt.content 
        }, (response) => {
            // 检查是否有错误 (例如页面没加载完 content script)
            if (chrome.runtime.lastError) {
                alert('请刷新当前页面后再试 (PromptSnap 需要页面重新加载)');
            } else {
                // 成功 -> 增加计数 + 关闭弹窗
                incrementUsage(prompt.id);
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
            chrome.storage.local.set({ prompts: prompts });
        }
    });
}

function deletePrompt(id) {
    chrome.storage.local.get(['prompts'], (result) => {
        const prompts = (result.prompts || []).filter(p => p.id !== id);
        chrome.storage.local.set({ prompts: prompts }, () => {
            loadPrompts(); // 刷新列表
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