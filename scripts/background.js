// PromptSnap Background Service Worker

// 监听来自 Popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'OPEN_AND_FILL') {
        console.log('PromptSnap: Received OPEN_AND_FILL request', request);
        handleOpenAndFill(request.url, request.text, request.promptId);
        // 返回 true 表示将异步发送响应 (虽然后面没用到 sendResponse，但保持规范)
        return true; 
    }
});

async function handleOpenAndFill(url, text, promptId) {
    try {
        console.log('PromptSnap: Creating new tab...', url);
        const tab = await chrome.tabs.create({ url: url, active: true });
        
        // 监听 Tab 更新
        const listener = (tabId, changeInfo, tabInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                console.log('PromptSnap: Tab loaded. Starting inject sequence.');
                chrome.tabs.onUpdated.removeListener(listener);
                
                // 开始尝试填入 (带重试机制)
                attemptFill(tabId, text, promptId, 0);
            }
        };
        
        chrome.tabs.onUpdated.addListener(listener);
        
    } catch (err) {
        console.error('PromptSnap: Error opening tab', err);
    }
}

// 尝试发送消息给 Content Script，如果失败则重试
// 很多 AI 网站 (如 Gemini/ChatGPT) 是 SPA，Loading 状态完成后 DOM 可能还未完全就绪
// 或者 Content Script 加载有延迟
function attemptFill(tabId, text, promptId, attempt) {
    const maxRetries = 10;
    const interval = 1000; // 1秒一次

    if (attempt >= maxRetries) {
        console.warn('PromptSnap: Failed to inject prompt after max retries.');
        return;
    }

    console.log(`PromptSnap: Attempt ${attempt + 1} to fill prompt...`);

    chrome.tabs.sendMessage(tabId, { action: 'FILL_PROMPT', text: text }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('PromptSnap: Content script not ready or error:', chrome.runtime.lastError.message);
            // 失败，重试
            setTimeout(() => {
                attemptFill(tabId, text, promptId, attempt + 1);
            }, interval);
        } else {
            console.log('PromptSnap: Successfully filled prompt.');
            // 成功后更新计数
            if (promptId) incrementUsage(promptId);
        }
    });
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