document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    
    // 如果是编辑模式，加载数据
    if (editId) {
        document.getElementById('page-title').textContent = '编辑 Prompt';
        chrome.storage.local.get(['prompts'], (result) => {
            const prompts = result.prompts || [];
            // 宽松比较 ID
            const prompt = prompts.find(p => p.id == editId);
            if (prompt) {
                document.getElementById('input-title').value = prompt.title;
                document.getElementById('input-content').value = prompt.content;
            }
        });
    }

    // 保存逻辑
    document.getElementById('btn-save').addEventListener('click', () => {
        const title = document.getElementById('input-title').value.trim();
        const content = document.getElementById('input-content').value.trim();
        
        if (!title || !content) {
            alert('请填写完整信息');
            return;
        }

        chrome.storage.local.get(['prompts'], (result) => {
            let prompts = result.prompts || [];
            
            if (editId) {
                // 更新
                const index = prompts.findIndex(p => p.id == editId);
                if (index !== -1) {
                    prompts[index].title = title;
                    prompts[index].content = content;
                }
            } else {
                // 新增
                prompts.push({
                    id: Date.now(),
                    title: title,
                    content: content,
                    usageCount: 0
                });
            }
            
            chrome.storage.local.set({ prompts: prompts }, () => {
                window.close(); // 保存后关闭页面
            });
        });
    });

    // 取消
    document.getElementById('btn-cancel').addEventListener('click', () => {
        window.close();
    });
});
