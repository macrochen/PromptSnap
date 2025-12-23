document.addEventListener('DOMContentLoaded', async () => {
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const url = new URL(tab.url);
    const hostname = url.hostname;
    document.getElementById('domain').textContent = hostname;

    // 读取配置
    chrome.storage.local.get(['siteSettings'], (result) => {
        const settings = result.siteSettings || {};
        const siteConfig = settings[hostname] || { enabled: false, selector: '' };

        document.getElementById('toggle-enable').checked = siteConfig.enabled;
        document.getElementById('selector').value = siteConfig.selector || '';
    });

    // 保存配置
    document.getElementById('save-btn').addEventListener('click', () => {
        const enabled = document.getElementById('toggle-enable').checked;
        const selector = document.getElementById('selector').value.trim();

        chrome.storage.local.get(['siteSettings'], (result) => {
            const settings = result.siteSettings || {};
            
            // 更新当前网站配置
            settings[hostname] = {
                enabled: enabled,
                selector: selector
            };

            chrome.storage.local.set({ siteSettings: settings }, () => {
                // 通知当前页面刷新或重新初始化
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'UPDATE_SETTINGS', 
                    settings: settings[hostname] 
                }, () => {
                    // 如果发送失败（例如脚本未运行），则重载页面
                    if (chrome.runtime.lastError) {
                        chrome.tabs.reload(tab.id);
                    } else {
                        window.close(); // 成功则关闭弹窗
                    }
                });
            });
        });
    });
});
