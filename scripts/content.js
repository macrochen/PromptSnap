// ==========================================
// PromptSnap Content Script (v0.2.0 Cleaned)
// ==========================================

console.log('PromptSnap: Content script loaded.');

// 1. 默认白名单配置
const DEFAULT_WHITELIST = {
    'gemini.google.com': { selector: 'div[contenteditable="true"].rich-textarea, div[contenteditable="true"]' },
    'aistudio.google.com': { selector: 'textarea[aria-label="Prompt"], textarea' }
};

// 2. 初始化检查入口
checkAndInit();

function checkAndInit() {
    const hostname = window.location.hostname;

    chrome.storage.local.get(['siteSettings'], (result) => {
        const settings = result.siteSettings || {};
        const siteConfig = settings[hostname];
        const defaultConfig = DEFAULT_WHITELIST[hostname];

        // 判定逻辑：以用户配置优先，其次是默认白名单
        let shouldRun = false;
        let activeSelector = null;

        if (siteConfig) {
            shouldRun = siteConfig.enabled;
            activeSelector = siteConfig.selector;
        } else if (defaultConfig) {
            shouldRun = true;
            activeSelector = defaultConfig.selector;
        }

        if (shouldRun) {
            console.log(`PromptSnap: Enabled on ${hostname}`);
            window.PS_ACTIVE_SELECTOR = activeSelector; // 全局缓存选择器
            
            // 确保 DOM 就绪后插入
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initPromptSnap);
            } else {
                initPromptSnap();
            }
        } else {
            console.log(`PromptSnap: Disabled on ${hostname}`);
            removeUI();
        }
    });
}

// 3. 监听 Popup 配置更新
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'UPDATE_SETTINGS') {
        console.log('PromptSnap: Settings updated, reloading state...');
        // 重新检查并刷新状态
        checkAndInit();
        sendResponse({ status: 'ok' });
    }
});

function removeUI() {
    const fab = document.getElementById('prompt-snap-fab');
    if (fab) fab.remove();
    const sidebar = document.getElementById('prompt-snap-sidebar');
    if (sidebar) sidebar.remove();
}

function initPromptSnap() {
    createFloatingButton();
}

// ==========================================
// UI Components: Floating Button
// ==========================================

function createFloatingButton() {
    if (document.getElementById('prompt-snap-fab')) return;

    const fab = document.createElement('div');
    fab.id = 'prompt-snap-fab';
    fab.className = 'prompt-snap-fab';
    fab.innerText = 'P';
    fab.title = 'Open PromptSnap';
    
    // 拖拽逻辑
    let isDragging = false;
    let startY = 0;
    let initialTop = 0;

    fab.addEventListener('mousedown', (e) => {
        isDragging = false;
        startY = e.clientY;
        initialTop = fab.getBoundingClientRect().top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
    });

    function onMouseMove(e) {
        const deltaY = e.clientY - startY;
        if (Math.abs(deltaY) > 5) isDragging = true;
        let newTop = initialTop + deltaY;
        const maxTop = window.innerHeight - 40;
        if (newTop < 0) newTop = 0;
        if (newTop > maxTop) newTop = maxTop;
        fab.style.top = newTop + 'px';
    }

    function onMouseUp(e) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (!isDragging) toggleSidebar();
    }

    document.body.appendChild(fab);
}

// ==========================================
// UI Components: Sidebar
// ==========================================

function toggleSidebar() {
    const sidebar = document.getElementById('prompt-snap-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    } else {
        createSidebar();
        // 延迟触发 CSS transition
        requestAnimationFrame(() => {
            document.getElementById('prompt-snap-sidebar').classList.add('open');
        });
    }
}

function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'prompt-snap-sidebar';
    sidebar.className = 'prompt-snap-sidebar';
    sidebar.innerHTML = `
        <div class="ps-header">
            <span class="ps-title">PromptSnap</span>
            <button class="ps-close-btn">&times;</button>
        </div>
        <div id="ps-list-view" style="display:flex; flex-direction:column; height:100%;">
            <div class="ps-list-container" id="ps-list"></div>
            <div class="ps-footer">
                <button class="ps-add-btn" id="ps-btn-new">+ 新建 Prompt</button>
            </div>
        </div>
        <div id="ps-form-view" class="ps-form">
            <input type="text" id="ps-input-title" class="ps-input" placeholder="标题">
            <textarea id="ps-input-content" class="ps-textarea" placeholder="内容..."></textarea>
            <div class="ps-form-actions">
                <button class="ps-btn-cancel" id="ps-btn-cancel">取消</button>
                <button class="ps-add-btn" id="ps-btn-save" style="flex:1">保存</button>
            </div>
        </div>
    `;

    document.body.appendChild(sidebar);

    // Sidebar Events
    sidebar.querySelector('.ps-close-btn').addEventListener('click', () => sidebar.classList.remove('open'));
    document.getElementById('ps-btn-new').addEventListener('click', () => showForm());
    document.getElementById('ps-btn-cancel').addEventListener('click', () => showList());
    document.getElementById('ps-btn-save').addEventListener('click', saveCurrentPrompt);

    loadPrompts();
}

function showForm(prompt = null) {
    document.getElementById('ps-list-view').style.display = 'none';
    const form = document.getElementById('ps-form-view');
    form.classList.add('active');
    
    if (prompt) {
        document.getElementById('ps-input-title').value = prompt.title;
        document.getElementById('ps-input-content').value = prompt.content;
        form.dataset.editingId = prompt.id;
    } else {
        document.getElementById('ps-input-title').value = '';
        document.getElementById('ps-input-content').value = '';
        delete form.dataset.editingId;
    }
}

function showList() {
    document.getElementById('ps-form-view').classList.remove('active');
    document.getElementById('ps-list-view').style.display = 'flex';
    loadPrompts();
}

// ==========================================
// Data Management
// ==========================================

function loadPrompts() {
    chrome.storage.local.get(['prompts'], (result) => {
        let prompts = result.prompts;
        if (!prompts) {
            prompts = [
                { id: 1, title: '代码解释', content: '请详细解释这段代码的逻辑：' },
                { id: 2, title: '英文润色', content: '请将以下内容翻译成地道的商务英文：' },
                { id: 3, title: '简单总结', content: '请用一句话总结上述内容。' }
            ];
            chrome.storage.local.set({ prompts: prompts });
        }
        renderList(prompts);
    });
}

function renderList(prompts) {
    const listEl = document.getElementById('ps-list');
    listEl.innerHTML = '';
    
    if (prompts.length === 0) {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">暂无 Prompt</div>';
        return;
    }

    prompts.forEach(p => {
        const item = document.createElement('div');
        item.className = 'ps-item';
        item.innerHTML = `
            <div class="ps-item-title">${p.title}</div>
            <div class="ps-item-preview">${p.content}</div>
            <div class="ps-item-actions">
                <button class="ps-action-btn fill btn-fill">填入</button>
                <button class="ps-action-btn btn-clear">清空</button>
                <button class="ps-action-btn btn-edit">编辑</button>
                <button class="ps-action-btn delete btn-delete">删除</button>
            </div>
        `;
        
        item.querySelector('.btn-fill').addEventListener('click', (e) => { e.stopPropagation(); fillPrompt(p.content); });
        item.querySelector('.btn-clear').addEventListener('click', (e) => { e.stopPropagation(); clearInput(); });
        item.querySelector('.btn-edit').addEventListener('click', (e) => { e.stopPropagation(); showForm(p); });
        item.querySelector('.btn-delete').addEventListener('click', (e) => { e.stopPropagation(); deletePrompt(p.id); });
        item.addEventListener('click', () => fillPrompt(p.content));
        
        listEl.appendChild(item);
    });
}

function saveCurrentPrompt() {
    const title = document.getElementById('ps-input-title').value.trim();
    const content = document.getElementById('ps-input-content').value.trim();
    if (!title || !content) return alert('不能为空');

    const form = document.getElementById('ps-form-view');
    const editingId = form.dataset.editingId ? parseInt(form.dataset.editingId) : null;

    chrome.storage.local.get(['prompts'], (result) => {
        let prompts = result.prompts || [];
        if (editingId) {
            const index = prompts.findIndex(p => p.id === editingId);
            if (index !== -1) prompts[index] = { id: editingId, title, content };
        } else {
            prompts.push({ id: Date.now(), title, content });
        }
        chrome.storage.local.set({ prompts: prompts }, showList);
    });
}

function deletePrompt(id) {
    if (!confirm('删除?')) return;
    chrome.storage.local.get(['prompts'], (result) => {
        const prompts = (result.prompts || []).filter(p => p.id !== id);
        chrome.storage.local.set({ prompts: prompts }, loadPrompts);
    });
}

// ==========================================
// Core: Smart Fill Logic
// ==========================================

function fillPrompt(text) {
    let targetElement = null;

    // 1. 尝试使用配置的选择器
    if (window.PS_ACTIVE_SELECTOR) {
        targetElement = document.querySelector(window.PS_ACTIVE_SELECTOR);
    }

    // 2. 智能探测
    if (!targetElement) {
        targetElement = findBestInputCandidate();
    }

    if (!targetElement) {
        alert('未找到输入框，请手动点击一下输入区域再试。');
        return;
    }

    injectText(targetElement, text);
}

// 清空输入框逻辑
function clearInput() {
    let targetElement = null;
    if (window.PS_ACTIVE_SELECTOR) {
        targetElement = document.querySelector(window.PS_ACTIVE_SELECTOR);
    }
    if (!targetElement) {
        targetElement = findBestInputCandidate();
    }

    if (targetElement) {
        targetElement.focus();
        if (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') {
            targetElement.value = '';
        } else {
            targetElement.innerHTML = '';
            targetElement.textContent = '';
        }
        // 触发事件通知框架
        ['input', 'change'].forEach(type => {
            targetElement.dispatchEvent(new Event(type, { bubbles: true }));
        });
        console.log('PromptSnap: Input cleared');
    }
}

function findBestInputCandidate() {
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.getAttribute('contenteditable') === 'true')) {
        return active;
    }

    const candidates = [
        ...document.querySelectorAll('textarea'),
        ...document.querySelectorAll('div[contenteditable="true"]'),
        ...document.querySelectorAll('input[type="text"]')
    ];

    const visibleCandidates = candidates.filter(el => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });

    if (visibleCandidates.length === 0) return null;

    // 返回面积最大的输入框
    return visibleCandidates.reduce((prev, current) => {
        return (current.offsetWidth * current.offsetHeight > prev.offsetWidth * prev.offsetHeight) ? current : prev;
    });
}

function injectText(element, text) {
    element.focus();
    const success = document.execCommand('insertText', false, text);
    
    if (!success) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const val = element.value;
            element.value = val.slice(0, start) + text + val.slice(end);
            element.selectionStart = element.selectionEnd = start + text.length;
        } else {
            element.textContent += text; 
        }
        
        ['input', 'change', 'textInput', 'keydown', 'keyup'].forEach(type => {
            element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
        });
    }
}