let currentFilter = 'ALL'; // 当前选中的分类
let editingSiteId = null; // 当前正在编辑的站点 ID

document.addEventListener('DOMContentLoaded', () => {
    loadPrompts();
    loadSites(); // 加载配置的站点

    document.getElementById('btn-add').addEventListener('click', () => {
        chrome.tabs.create({ url: 'editor.html' });
    });

    // --- 设置页面逻辑 ---
    
    // 打开设置 (数据管理 + 站点配置)
    document.getElementById('btn-settings').addEventListener('click', () => {
        toggleSettingsView(true);
    });

    // 返回
    document.getElementById('btn-back-settings').addEventListener('click', () => {
        toggleSettingsView(false);
        // 退出可能存在的编辑模式
        editingSiteId = null;
        document.getElementById('site-name').value = '';
        document.getElementById('site-url').value = '';
        document.getElementById('btn-add-site').textContent = '添加网站';
    });

    // 添加/更新站点
    document.getElementById('btn-add-site').addEventListener('click', () => {
        saveSite();
    });

    // 导出
    document.getElementById('btn-export').addEventListener('click', exportPrompts);

    // 导入
    const fileInput = document.getElementById('file-import');
    document.getElementById('btn-import').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', importPrompts);

    // 监听模态框取消/确认 (确认逻辑在 showVariableInput 中动态绑定)
    document.getElementById('btn-var-cancel').addEventListener('click', () => {
        closeVariableModal();
    });
});

function toggleSettingsView(show) {
    const settings = document.getElementById('view-settings');
    const header = document.querySelector('.header');
    const tags = document.getElementById('tags-bar');
    const list = document.getElementById('list');

    if (show) {
        settings.style.display = 'block';
        header.style.display = 'none';
        tags.style.display = 'none';
        list.style.display = 'none';
        loadSites(); // 刷新列表
    } else {
        settings.style.display = 'none';
        header.style.display = 'flex';
        tags.style.display = 'flex';
        list.style.display = 'block';
        loadPrompts(); // 刷新列表
    }
}

// ========================================== 
// 站点管理逻辑
// ========================================== 

function loadSites() {
    chrome.storage.local.get(['aiSites'], (result) => {
        const sites = result.aiSites || [];
        const container = document.getElementById('sites-list');
        container.innerHTML = '';
        
        if (sites.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#999; font-size:12px; padding:10px;">暂无配置的网站</div>';
        } else {
            sites.forEach(site => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.padding = '8px';
                item.style.borderBottom = '1px solid #f1f3f4';
                item.style.fontSize = '12px';
                
                item.innerHTML = `
                    <div style=\"flex: 1; margin-right: 8px;">
                        <div style=\"font-weight:500;">${escapeHtml(site.name)}</div>
                        <div style=\"color:#9aa0a6; font-size:11px;">${escapeHtml(site.url)}</div>
                    </div>
                    <div style=\"display: flex; gap: 4px;">
                        <button class=\"icon-btn icon-edit-site\" style=\"border:none; background:none; cursor:pointer; color:#1a73e8;\" title=\"编辑\">
                            <svg viewBox=\"0 0 24 24\"><path d=\"M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z\"></svg>
                        </button>
                        <button class=\"btn-del-site\" style=\"border:none; background:none; color:#d93025; cursor:pointer;\" title=\"删除\">
                            <svg viewBox=\"0 0 24 24\"><path d=\"M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z\"></svg>
                        </button>
                    </div>
                `;
                
                item.querySelector('.icon-edit-site').addEventListener('click', () => {
                    prepareEditSite(site);
                });

                item.querySelector('.btn-del-site').addEventListener('click', () => {
                    if (confirm(`确定要删除 "${site.name}" 吗？`)) {
                        deleteSite(site.id);
                    }
                });
                
                container.appendChild(item);
            });
        }
    });
}

function prepareEditSite(site) {
    document.getElementById('site-name').value = site.name;
    document.getElementById('site-url').value = site.url;
    editingSiteId = site.id;
    document.getElementById('btn-add-site').textContent = '更新网站';
}

function saveSite() {
    const nameInput = document.getElementById('site-name');
    const urlInput = document.getElementById('site-url');
    
    const name = nameInput.value.trim();
    let url = urlInput.value.trim();
    
    if (!name || !url) {
        alert('请输入名称和网址');
        return;
    }
    
    // 简单补全协议
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    chrome.storage.local.get(['aiSites'], (result) => {
        let sites = result.aiSites || [];
        
        if (editingSiteId) {
            // 更新模式
            const index = sites.findIndex(s => s.id === editingSiteId);
            if (index !== -1) {
                sites[index].name = name;
                sites[index].url = url;
            }
            editingSiteId = null;
            document.getElementById('btn-add-site').textContent = '添加网站';
        } else {
            // 新增模式
            sites.push({ id: Date.now(), name, url });
        }
        
        chrome.storage.local.set({ aiSites: sites }, () => {
            nameInput.value = '';
            urlInput.value = '';
            loadSites();
        });
    });
}

function deleteSite(id) {
    chrome.storage.local.get(['aiSites'], (result) => {
        const sites = (result.aiSites || []).filter(s => s.id !== id);
        chrome.storage.local.set({ aiSites: sites }, () => {
            loadSites();
        });
    });
}

function updateSiteSelect() {
    chrome.storage.local.get(['aiSites'], (result) => {
        const sites = result.aiSites || [];
        const select = document.getElementById('select-target-site');
        
        // 保留第一个 "当前页面"
        select.innerHTML = '<option value="">当前页面</option>';
        
        sites.forEach(site => {
            const option = document.createElement('option');
            option.value = site.url;
            option.textContent = site.name;
            select.appendChild(option);
        });
    });
}

// ========================================== 
// 核心逻辑：填入 Prompt
// ========================================== 

async function handleFill(prompt, options = {}) {
    const content = prompt.content;
    const variableRegex = /{{\s*(.*?)\s*}}/g;
    const matches = [...content.matchAll(variableRegex)];

    // 如果有变量，或者强制显示模态框 (例如点击了 Launch 图标)
    if (matches.length > 0 || options.forceModal) {
        showVariableInput(prompt, matches);
    } else {
        // 直接填入当前页面
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

    // 1. 解析变量 (处理 {{name:default}})
    const varsMap = new Map(); // name -> defaultVal
    
    matches.forEach(m => {
        const inner = m[1];
        let name = inner;
        let def = '';
        
        // 检查是否有默认值
        if (inner.includes(':')) {
            const parts = inner.split(':');
            name = parts[0].trim();
            def = parts.slice(1).join(':').trim(); // 处理值中包含冒号的情况
        } else {
            name = name.trim();
        }
        
        // 如果未存过，或者当前有值且之前没存默认值，则更新
        if (!varsMap.has(name) || (def && !varsMap.get(name))) {
            varsMap.set(name, def);
        }
    });

    const uniqueVars = Array.from(varsMap.keys());

    if (uniqueVars.length === 0) {
        // 如果没有变量 (是从 Launch 进来的)，显示提示
        const msg = document.createElement('div');
        msg.textContent = '此 Prompt 无需变量，请选择目标网站执行。';
        msg.style.color = '#5f6368';
        msg.style.fontSize = '13px';
        msg.style.marginBottom = '12px';
        inputsContainer.appendChild(msg);
    } else {
        // 生成输入框
        uniqueVars.forEach((varName, index) => {
            const defaultVal = varsMap.get(varName);
            
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
            input.value = defaultVal; // 设置默认值
            input.style.width = '100%';
            input.style.padding = '8px';
            input.style.border = '1px solid #dadce0';
            input.style.borderRadius = '4px';
            input.style.boxSizing = 'border-box';
            
            // 聚焦时全选文本
            input.addEventListener('focus', function() {
                this.select();
            });
            
            // 自动聚焦第一个
            if (index === 0) {
                setTimeout(() => input.focus(), 10);
            }

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            inputsContainer.appendChild(wrapper);
        });
    }

    // 2. 填充站点选择下拉框
    updateSiteSelect();

    // 3. 绑定确认按钮逻辑
    const btnConfirm = document.getElementById('btn-var-confirm');
    
    // 清除旧监听器
    const newBtnConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);

    // 输入框回车导航
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
        
        // 替换逻辑升级：支持匹配带默认值的写法
        inputs.forEach(input => {
            const varName = input.dataset.varName;
            const value = input.value;
            // 匹配 {{ varName }} 或 {{ varName:default }}
            // 解释: {{\s* 匹配开头; escape(varName) 匹配变量名; \s*(?::.*?)? 匹配可选的冒号和默认值; \s*}} 匹配结尾
            const regex = new RegExp(`{{\s*${escapeRegExp(varName)}\s*(?::.*?)?\s*}}`, 'g');
            finalContent = finalContent.replace(regex, value);
        });

        // 检查目标站点
        const targetUrl = document.getElementById('select-target-site').value;
        if (targetUrl) {
            // 在新标签页打开
            chrome.runtime.sendMessage({
                action: 'OPEN_AND_FILL',
                url: targetUrl,
                text: finalContent,
                promptId: prompt.id
            }, () => {
                window.close(); // 确保消息发送成功后再关闭
            });
        } else {
            // 在当前页面填入
            sendToContent(finalContent, prompt.id);
        }
    });
}

function closeVariableModal() {
    document.querySelector('.header').style.display = 'flex';
    document.getElementById('tags-bar').style.display = 'flex';
    document.getElementById('list').style.display = 'block';
    document.getElementById('variable-modal').style.display = 'none';
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function sendToContent(text, promptId) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        chrome.tabs.sendMessage(tab.id, { 
            action: 'FILL_PROMPT', 
            text: text 
        }, (response) => {
            if (chrome.runtime.lastError) {
                alert('请刷新当前页面后再试 (PromptSnap 需要页面重新加载)');
            } else {
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
            prompts[index].lastUsedAt = Date.now();
            chrome.storage.local.set({ prompts: prompts });
        }
    });
}

// ========================================== 
// 列表渲染
// ========================================== 

function loadPrompts() {
    chrome.storage.local.get(['prompts'], (result) => {
        let prompts = result.prompts || [];
        
        prompts.forEach(p => { if (!p.category) p.category = '未分类'; });

        const categories = new Set(['ALL']);
        prompts.forEach(p => categories.add(p.category));
        
        renderTags(Array.from(categories), prompts);

        const filtered = currentFilter === 'ALL' 
            ? prompts 
            : prompts.filter(p => p.category === currentFilter);
            
        renderList(filtered);
    });
}

function renderTags(categories, allPrompts) {
    const bar = document.getElementById('tags-bar');
    bar.innerHTML = '';

    categories.forEach(cat => {
        const tag = document.createElement('div');
        tag.className = `tag ${cat === currentFilter ? 'active' : ''}`;
        tag.textContent = cat === 'ALL' ? '全部' : cat;
        
        tag.addEventListener('click', () => {
            currentFilter = cat;
            document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            
            const filtered = cat === 'ALL' ? allPrompts : allPrompts.filter(p => p.category === cat);
            renderList(filtered);
        });
        
        bar.appendChild(tag);
    });
}

function renderList(prompts) {
    prompts.sort((a, b) => {
        const timeA = a.lastUsedAt || a.id || 0;
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
        
        item.innerHTML = `
            <div class=\"item-title\" title=\"${escapeHtml(p.content)}\">
                ${escapeHtml(p.title)}
            </div>
            <div class=\"item-actions\">
                <button class=\"icon-btn icon-launch\" title=\"选择网站执行\">
                    <svg viewBox=\"0 0 24 24\"><path d=\"M13 2.03v2.02c4.39.54 7.5 4.53 6.96 8.92-.46 3.64-3.32 6.53-6.96 6.96v2c5.5-.55 9.5-5.43 8.95-10.93-.45-4.75-4.22-8.5-8.95-8.97zm-2 0c-4.75.47-8.5 4.22-8.95 8.97-.55 5.5 3.45 10.38 8.95 10.93v-2C7.32 19.48 4.46 16.59 4 12.95c-.54-4.39 2.57-8.38 6.96-8.92V2.03zM11 6v6h2V6h-2z\"></svg>
                </button>
                <button class=\"icon-btn icon-copy\" title=\"复制内容\">
                    <svg viewBox=\"0 0 24 24\"><path d=\"M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z\"></svg>
                </button>
                <button class=\"icon-btn icon-edit\" title=\"编辑\">
                    <svg viewBox=\"0 0 24 24\"><path d=\"M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z\"></svg>
                </button>
                <button class=\"icon-btn icon-delete\" title=\"删除\">
                    <svg viewBox=\"0 0 24 24\"><path d=\"M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z\"></svg>
                </button>
            </div>
        `;

        // 1. 点击标题 -> 智能填入 (有变量则弹窗，无变量直接填)
        item.querySelector('.item-title').addEventListener('click', () => {
            handleFill(p);
        });
        
        // 2. Launch 按钮 -> 强制弹窗 (选择站点)
        item.querySelector('.icon-launch').addEventListener('click', (e) => {
            e.stopPropagation();
            handleFill(p, { forceModal: true });
        });

        // 3. 复制按钮
        item.querySelector('.icon-copy').addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            navigator.clipboard.writeText(p.content).then(() => {
                showToast('已复制');
                // 视觉反馈：图标变化
                const originalHtml = btn.innerHTML;
                btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#188038;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                }, 1000);
            });
        });

        // 4. 编辑
        item.querySelector('.icon-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            chrome.tabs.create({ url: `editor.html?id=${p.id}` });
        });

        // 5. 删除
        item.querySelector('.icon-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`确定要删除 "${p.title}" 吗？`)) {
                deletePrompt(p.id);
            }
        });

        listEl.appendChild(item);
    });
}

function deletePrompt(id) {
    chrome.storage.local.get(['prompts'], (result) => {
        const prompts = (result.prompts || []).filter(p => p.id !== id);
        chrome.storage.local.set({ prompts: prompts }, () => loadPrompts());
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

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 1500);
}

function exportPrompts() {
    chrome.storage.local.get(['prompts'], (result) => {
        const prompts = result.prompts || [];
        const blob = new Blob([JSON.stringify(prompts, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().slice(0, 10);
        a.download = `promptsnap_backup_${date}.json`;
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

function importPrompts(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!Array.isArray(imported)) {
                alert('文件格式错误：必须是 Prompt 数组');
                return;
            }

            chrome.storage.local.get(['prompts'], (result) => {
                let currentPrompts = result.prompts || [];
                const currentIds = new Set(currentPrompts.map(p => p.id));
                let addedCount = 0;
                let updatedCount = 0;

                imported.forEach(p => {
                    if (!p.id || !p.title || !p.content) return;
                    
                    if (currentIds.has(p.id)) {
                        const index = currentPrompts.findIndex(cp => cp.id === p.id);
                        currentPrompts[index] = p;
                        updatedCount++;
                    } else {
                        currentPrompts.push(p);
                        addedCount++;
                    }
                });

                chrome.storage.local.set({ prompts: currentPrompts }, () => {
                    alert(`导入成功！\n新增: ${addedCount} 条\n更新: ${updatedCount} 条`);
                    document.getElementById('file-import').value = ''; 
                    loadPrompts(); // 重新加载列表
                });
            });
        } catch (err) {
            alert('导入失败：JSON 解析错误');
            console.error(err);
        }
    };
    reader.readAsText(file);
}
