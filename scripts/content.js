// ==========================================
// PromptSnap Content Script (v0.3.0 Actuator)
// ==========================================

console.log('PromptSnap: Actuator loaded.');

// 监听来自 Popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'FILL_PROMPT') {
        const text = request.text;
        console.log('PromptSnap: Received fill command');
        fillPrompt(text);
        sendResponse({ status: 'ok' });
    }
});

// ==========================================
// Core: Smart Fill Logic
// ==========================================

function fillPrompt(text) {
    let targetElement = null;

    // 1. 尝试使用配置的选择器 (如果 Popup 传递了或者本地有缓存)
    // 简化版：直接智能探测，因为现在是用户主动点击触发，通常焦点已经在对的地方
    targetElement = findBestInputCandidate();

    if (!targetElement) {
        alert('PromptSnap: 未找到输入框，请先点击一下聊天输入区域。');
        return;
    }

    injectText(targetElement, text);
}

function findBestInputCandidate() {
    // 1. 优先：当前聚焦的元素
    const active = document.activeElement;
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.getAttribute('contenteditable') === 'true')) {
        return active;
    }

    // 2. 备选：查找页面上所有可见的输入框
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

    // 3. 策略：返回面积最大的输入框 (通常是主聊天框)
    return visibleCandidates.reduce((prev, current) => {
        return (current.offsetWidth * current.offsetHeight > prev.offsetWidth * prev.offsetHeight) ? current : prev;
    });
}

function injectText(element, text) {
    element.focus();
    
    // 尝试 execCommand
    const success = document.execCommand('insertText', false, text);
    
    // 备选方案
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
        
        // 触发事件
        ['input', 'change', 'textInput', 'keydown', 'keyup'].forEach(type => {
            element.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
        });
    }
}