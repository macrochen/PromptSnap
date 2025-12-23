console.log('PromptSnap: Content script loaded for Gemini.');

// 初始化 PromptSnap
function initPromptSnap() {
    createFloatingButton();
}

// 创建悬浮球
function createFloatingButton() {
    // 检查是否已存在
    if (document.getElementById('prompt-snap-fab')) return;

    const fab = document.createElement('div');
    fab.id = 'prompt-snap-fab';
    fab.className = 'prompt-snap-fab';
    fab.innerText = 'P'; // 简易 Logo
    fab.title = 'Open PromptSnap';
    
    // 添加点击事件 (修改为处理拖拽)
    let isDragging = false;
    let startY = 0;
    let initialTop = 0;

    fab.addEventListener('mousedown', (e) => {
        isDragging = false;
        startY = e.clientY;
        initialTop = fab.getBoundingClientRect().top;
        
        // 绑定移动和松开事件到 document，防止鼠标移出元素导致失效
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        e.preventDefault(); // 防止选中文本
    });

    function onMouseMove(e) {
        const deltaY = e.clientY - startY;
        if (Math.abs(deltaY) > 5) { // 移动超过5像素视为拖拽
            isDragging = true;
        }
        
        // 更新位置 (限制在屏幕可视区域内)
        let newTop = initialTop + deltaY;
        const maxTop = window.innerHeight - 40;
        if (newTop < 0) newTop = 0;
        if (newTop > maxTop) newTop = maxTop;
        
        fab.style.top = newTop + 'px';
    }

    function onMouseUp(e) {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        
        if (!isDragging) {
            console.log('PromptSnap: FAB clicked, toggle sidebar...');
            toggleSidebar();
        }
    }

    document.body.appendChild(fab);
}

// 切换侧边栏
function toggleSidebar() {
    const sidebar = document.getElementById('prompt-snap-sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    } else {
        createSidebar();
        // 首次打开需要一点延迟才有动画效果
        setTimeout(() => {
            document.getElementById('prompt-snap-sidebar').classList.add('open');
        }, 10);
    }
}

// 创建侧边栏
function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'prompt-snap-sidebar';
    sidebar.className = 'prompt-snap-sidebar';
    
    // 内部结构
    sidebar.innerHTML = `
        <div class="ps-header">
            <span class="ps-title">PromptSnap</span>
            <button class="ps-close-btn">&times;</button>
        </div>
        <div id="ps-list-view" style="display:flex; flex-direction:column; height:100%;">
            <div class="ps-list-container" id="ps-list">
                <!-- 列表项将在这里渲染 -->
            </div>
            <div class="ps-footer">
                <button class="ps-add-btn" id="ps-btn-new">+ 新建 Prompt</button>
            </div>
        </div>
        
        <div id="ps-form-view" class="ps-form">
            <input type="text" id="ps-input-title" class="ps-input" placeholder="标题 (例如: 代码解释)">
            <textarea id="ps-input-content" class="ps-textarea" placeholder="Prompt 内容..."></textarea>
            <div class="ps-form-actions">
                <button class="ps-btn-cancel" id="ps-btn-cancel">取消</button>
                <button class="ps-add-btn" id="ps-btn-save" style="flex:1">保存</button>
            </div>
        </div>
    `;

    document.body.appendChild(sidebar);

    // 绑定基础事件
    sidebar.querySelector('.ps-close-btn').addEventListener('click', () => {
        sidebar.classList.remove('open');
    });
    
    document.getElementById('ps-btn-new').addEventListener('click', () => showForm());
    document.getElementById('ps-btn-cancel').addEventListener('click', () => showList());
    document.getElementById('ps-btn-save').addEventListener('click', saveCurrentPrompt);

    // 加载数据
    loadPrompts();
}

// 视图切换
function showForm(prompt = null) {
    document.getElementById('ps-list-view').style.display = 'none';
    const form = document.getElementById('ps-form-view');
    form.classList.add('active');
    
    // 重置或填充表单
    if (prompt) {
        document.getElementById('ps-input-title').value = prompt.title;
        document.getElementById('ps-input-content').value = prompt.content;
        form.dataset.editingId = prompt.id; // 标记正在编辑 ID
    } else {
        document.getElementById('ps-input-title').value = '';
        document.getElementById('ps-input-content').value = '';
        delete form.dataset.editingId;
    }
}

function showList() {
    document.getElementById('ps-form-view').classList.remove('active');
    document.getElementById('ps-list-view').style.display = 'flex';
    loadPrompts(); // 重新加载列表
}

// 数据管理：加载 Prompts
function loadPrompts() {
    chrome.storage.local.get(['prompts'], (result) => {
        let prompts = result.prompts;
        
        // 初始化预置数据 (Onboarding)
        if (!prompts) {
            prompts = [
                { id: 1, title: '代码解释', content: '请详细解释这段代码的逻辑，并指出潜在的性能问题：' },
                { id: 2, title: '英文润色', content: '请将以下内容翻译成地道的英文，风格商务专业：' },
                { id: 3, title: '简单总结', content: '请用简练的语言总结上述内容的核心观点。' }
            ];
            chrome.storage.local.set({ prompts: prompts });
        }
        
        renderList(prompts);
    });
}

// 渲染列表
function renderList(prompts) {
    const listEl = document.getElementById('ps-list');
    listEl.innerHTML = '';
    
    if (prompts.length === 0) {
        listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">暂无 Prompt，快去新建吧</div>';
        return;
    }

    prompts.forEach(p => {
        const item = document.createElement('div');
        item.className = 'ps-item';
        item.innerHTML = `
            <div class="ps-item-title">${p.title}</div>
            <div class="ps-item-preview">${p.content}</div>
            <div class="ps-item-actions">
                <button class="ps-action-btn fill btn-fill" data-id="${p.id}">填入</button>
                <button class="ps-action-btn btn-edit" data-id="${p.id}">编辑</button>
                <button class="ps-action-btn delete btn-delete" data-id="${p.id}">删除</button>
            </div>
        `;
        
        // 绑定事件
        item.querySelector('.btn-fill').addEventListener('click', (e) => {
            e.stopPropagation();
            fillPrompt(p.content);
        });
        item.querySelector('.btn-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            showForm(p);
        });
        item.querySelector('.btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            deletePrompt(p.id);
        });
        
        // 点击整个条目默认填入
        item.addEventListener('click', () => fillPrompt(p.content));
        
        listEl.appendChild(item);
    });
}

// 保存 Prompt (新增或更新)
function saveCurrentPrompt() {
    const title = document.getElementById('ps-input-title').value.trim();
    const content = document.getElementById('ps-input-content').value.trim();
    
    if (!title || !content) {
        alert('标题和内容不能为空');
        return;
    }

    const form = document.getElementById('ps-form-view');
    const editingId = form.dataset.editingId ? parseInt(form.dataset.editingId) : null;

    chrome.storage.local.get(['prompts'], (result) => {
        let prompts = result.prompts || [];
        
        if (editingId) {
            // 更新
            const index = prompts.findIndex(p => p.id === editingId);
            if (index !== -1) {
                prompts[index] = { id: editingId, title, content };
            }
        } else {
            // 新增
            const newId = Date.now(); // 简单的 ID 生成
            prompts.push({ id: newId, title, content });
        }
        
        chrome.storage.local.set({ prompts: prompts }, () => {
            showList(); // 保存成功后返回列表
        });
    });
}

// 删除 Prompt
function deletePrompt(id) {
    if (!confirm('确定要删除这条 Prompt 吗？')) return;
    
    chrome.storage.local.get(['prompts'], (result) => {
        let prompts = result.prompts || [];
        prompts = prompts.filter(p => p.id !== id);
        
        chrome.storage.local.set({ prompts: prompts }, () => {
            loadPrompts(); // 重新加载列表
        });
    });
}

// 核心功能：填入 Prompt
function fillPrompt(text) {
    // 1. 查找 Gemini 输入框
    // Gemini 的输入框通常是一个 contenteditable 的 div
    // 选择器可能会变，这里需要尽可能健壮
    const editor = document.querySelector('div[contenteditable="true"]') || 
                   document.querySelector('textarea'); 
    
    if (!editor) {
        alert('未找到输入框，请确保您在 Gemini 聊天界面。');
        return;
    }

    // 2. 聚焦
    editor.focus();

    // 3. 填入内容 (模拟用户粘贴或输入)
    // 简单赋值 innerText 在 React/Angular 中通常无效，需要 execCommand 或模拟事件
    // document.execCommand('insertText') 已废弃但最有效
    const success = document.execCommand('insertText', false, text);
    
    // 如果 execCommand 失败 (有些现代浏览器限制)，尝试备选方案
    if (!success) {
        editor.textContent = text; 
        
        // 分发 Input 事件，通知框架数据变了
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 4. 反馈
    // 可选：收起侧边栏
    // document.getElementById('prompt-snap-sidebar').classList.remove('open');
}

// 页面加载完成后执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPromptSnap);
} else {
    initPromptSnap();
}

