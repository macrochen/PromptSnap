// PromptSnap Background Service Worker

// 监听来自 Popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'OPEN_AND_FILL') {
        handleOpenAndFill(request.url, request.text, request.promptId);
        sendResponse({ status: 'processing' });
    }
});

async function handleOpenAndFill(url, text, promptId) {
    try {
        const tab = await chrome.tabs.create({ url: url, active: true });
        
        // 监听 Tab 更新
        const listener = (tabId, changeInfo, tabInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                
                // 稍微延迟，确保页面 JS 初始化完毕
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, { action: 'FILL_PROMPT', text: text }, (response) => {
                        // 忽略错误 (例如页面不支持)
                        if (chrome.runtime.lastError) {
                            console.log('PromptSnap: Content script not ready or error:', chrome.runtime.lastError.message);
                        } else {
                            // 成功后更新计数
                            if (promptId) incrementUsage(promptId);
                        }
                    });
                }, 1500); // 1.5秒延迟
            }
        };
        
        chrome.tabs.onUpdated.addListener(listener);
        
    } catch (err) {
        console.error('PromptSnap: Error opening tab', err);
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
