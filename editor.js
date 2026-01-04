document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    
    // 加载数据
    chrome.storage.local.get(['prompts'], (result) => {
        const prompts = result.prompts || [];

        // 1. 提取所有分类并去重，填充 datalist
        const categories = new Set();
        prompts.forEach(p => {
            if (p.category) categories.add(p.category);
        });
        
        const datalist = document.getElementById('category-list');
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            datalist.appendChild(option);
        });

        // 2. 如果是编辑模式，回显数据
        if (editId) {
            document.getElementById('page-title').textContent = '编辑 Prompt';
            const prompt = prompts.find(p => p.id == editId);
            if (prompt) {
                document.getElementById('input-title').value = prompt.title;
                document.getElementById('input-category').value = prompt.category || '';
                document.getElementById('input-content').value = prompt.content;
            }
        }
    });

    // 保存逻辑
    document.getElementById('btn-save').addEventListener('click', () => {
        const title = document.getElementById('input-title').value.trim();
        const category = document.getElementById('input-category').value.trim() || '未分类';
        const content = document.getElementById('input-content').value; // 移除了 .trim()
        
        if (!title || !content.trim()) { // 校验时依然用 trim 确保内容不仅仅是空格
            alert('标题和内容不能为空');
            return;
        }

        chrome.storage.local.get(['prompts'], (result) => {
            let prompts = result.prompts || [];
            
            if (editId) {
                // 更新
                const index = prompts.findIndex(p => p.id == editId);
                if (index !== -1) {
                    prompts[index].title = title;
                    prompts[index].category = category;
                    prompts[index].content = content;
                }
            } else {
                // 新增
                prompts.push({
                    id: Date.now(),
                    title: title,
                    category: category,
                    content: content,
                    usageCount: 0,
                    lastUsedAt: Date.now() // 新增：最后操作时间
                });
            }
            
            chrome.storage.local.set({ prompts: prompts }, () => {
                window.close();
            });
        });
    });

    // 取消
    document.getElementById('btn-cancel').addEventListener('click', () => {
        window.close();
    });
});