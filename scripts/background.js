// PromptSnap Background Service Worker

const DRIVE_FILE_NAME = 'promptsnap-backup.json';
const DRIVE_META_KEY = 'driveSyncMeta';
const DRIVE_BACKUP_VERSION = 1;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) {
        return false;
    }

    if (request.action === 'OPEN_AND_FILL') {
        handleOpenAndFill(request.url, request.text, request.promptId);
        return true;
    }

    if (request.action === 'DRIVE_GET_STATUS') {
        handleAsync(sendResponse, getDriveStatus());
        return true;
    }

    if (request.action === 'DRIVE_CONNECT') {
        handleAsync(sendResponse, connectDrive());
        return true;
    }

    if (request.action === 'DRIVE_DISCONNECT') {
        handleAsync(sendResponse, disconnectDrive());
        return true;
    }

    if (request.action === 'DRIVE_BACKUP_NOW') {
        handleAsync(sendResponse, backupToDrive(request.reason || 'manual'));
        return true;
    }

    if (request.action === 'DRIVE_RESTORE') {
        handleAsync(sendResponse, restoreFromDrive());
        return true;
    }

    if (request.action === 'DRIVE_GET_BACKUP_JSON') {
        handleAsync(sendResponse, getBackupJson());
        return true;
    }

    if (request.action === 'DRIVE_DATA_CHANGED') {
        handleAsync(sendResponse, backupToDriveIfReady(request.reason || 'auto'));
        return true;
    }

    return false;
});

async function handleOpenAndFill(url, text, promptId) {
    try {
        const tab = await chrome.tabs.create({ url: url, active: true });

        if (tab.status === 'complete') {
            attemptFill(tab.id, text, promptId, 0);
            return;
        }

        const listener = (tabId, changeInfo) => {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                attemptFill(tabId, text, promptId, 0);
            }
        };

        chrome.tabs.onUpdated.addListener(listener);
    } catch (err) {
        console.error('PromptSnap: Error opening tab', err);
    }
}

function attemptFill(tabId, text, promptId, attempt) {
    const maxRetries = 10;
    const interval = 1000;

    if (attempt >= maxRetries) {
        console.warn('PromptSnap: Failed to inject prompt after max retries.');
        return;
    }

    chrome.tabs.sendMessage(tabId, { action: 'FILL_PROMPT', text: text }, () => {
        if (chrome.runtime.lastError) {
            setTimeout(() => {
                attemptFill(tabId, text, promptId, attempt + 1);
            }, interval);
        } else if (promptId) {
            incrementUsage(promptId);
        }
    });
}

function incrementUsage(id) {
    chrome.storage.local.get(['prompts'], (result) => {
        const prompts = result.prompts || [];
        const index = prompts.findIndex(p => p.id === id);
        if (index !== -1) {
            prompts[index].usageCount = (prompts[index].usageCount || 0) + 1;
            prompts[index].lastUsedAt = Date.now();
            chrome.storage.local.set({ prompts: prompts });
        }
    });
}

function handleAsync(sendResponse, promise) {
    promise.then(
        (payload) => sendResponse({ ok: true, ...payload }),
        (error) => sendResponse({ ok: false, error: error.message || 'Unknown error' })
    );
}

function getLocal(keys) {
    return chrome.storage.local.get(keys);
}

function setLocal(items) {
    return chrome.storage.local.set(items);
}

async function getDriveStatus() {
    const result = await getLocal([DRIVE_META_KEY]);
    const meta = result[DRIVE_META_KEY] || {};

    return {
        status: {
            configured: hasOAuthClientConfigured(),
            connected: Boolean(meta.connected),
            lastBackupAt: meta.lastBackupAt || null,
            lastRestoreAt: meta.lastRestoreAt || null,
            lastError: meta.lastError || '',
            fileId: meta.fileId || ''
        }
    };
}

async function connectDrive() {
    const accessToken = await ensureDriveAccessToken(true);
    if (!accessToken) {
        throw new Error('未能获取 Google 授权令牌');
    }

    const current = await getLocal([DRIVE_META_KEY]);
    await setLocal({
        [DRIVE_META_KEY]: {
            ...(current[DRIVE_META_KEY] || {}),
            connected: true,
            lastError: ''
        }
    });

    return getDriveStatus();
}

async function disconnectDrive() {
    const token = await getCachedAuthToken(false).catch(() => '');
    if (token) {
        await removeCachedToken(token);
    }

    const current = await getLocal([DRIVE_META_KEY]);
    await setLocal({
        [DRIVE_META_KEY]: {
            ...(current[DRIVE_META_KEY] || {}),
            connected: false,
            lastError: ''
        }
    });

    return getDriveStatus();
}

async function backupToDrive(reason) {
    const accessToken = await ensureDriveAccessToken(false);
    const backupData = await buildBackupPayload();
    const file = await findOrCreateBackupFile(accessToken);
    const uploadResult = await uploadBackupFile(accessToken, file.id, backupData);
    const now = Date.now();
    const current = await getLocal([DRIVE_META_KEY]);

    await setLocal({
        [DRIVE_META_KEY]: {
            ...(current[DRIVE_META_KEY] || {}),
            connected: true,
            fileId: file.id,
            lastBackupAt: now,
            lastError: '',
            lastReason: reason,
            remoteModifiedTime: uploadResult.modifiedTime || ''
        }
    });

    return {
        status: {
            lastBackupAt: now,
            fileId: file.id
        }
    };
}

async function backupToDriveIfReady(reason) {
    const status = await getDriveStatus();
    if (!status.status.configured || !status.status.connected) {
        return {
            skipped: true,
            reason: 'drive_not_ready'
        };
    }

    return backupToDrive(reason);
}

async function restoreFromDrive() {
    const accessToken = await ensureDriveAccessToken(false);
    const file = await findBackupFile(accessToken);

    if (!file) {
        throw new Error('Google Drive 中尚未找到 PromptSnap 备份文件');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const backup = await parseJsonResponse(response, '下载 Drive 备份失败');
    if (!backup || !Array.isArray(backup.prompts) || !Array.isArray(backup.aiSites)) {
        throw new Error('云端备份文件格式无效');
    }

    const now = Date.now();
    const current = await getLocal([DRIVE_META_KEY]);
    await setLocal({
        prompts: backup.prompts,
        aiSites: backup.aiSites,
        [DRIVE_META_KEY]: {
            ...(current[DRIVE_META_KEY] || {}),
            connected: true,
            fileId: file.id,
            lastRestoreAt: now,
            lastError: '',
            remoteModifiedTime: file.modifiedTime || ''
        }
    });

    return {
        restored: {
            prompts: backup.prompts.length,
            aiSites: backup.aiSites.length,
            restoredAt: now
        }
    };
}

async function getBackupJson() {
    const accessToken = await ensureDriveAccessToken(false);
    const file = await findBackupFile(accessToken);

    if (!file) {
        throw new Error('Google Drive 中尚未找到 PromptSnap 备份文件');
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const backup = await parseJsonResponse(response, '读取 Drive 备份失败');
    return { backup };
}

function hasOAuthClientConfigured() {
    const oauth2 = chrome.runtime.getManifest().oauth2 || {};
    const clientId = (oauth2.client_id || '').trim();
    return Boolean(clientId) && !clientId.startsWith('YOUR_');
}

async function ensureDriveAccessToken(interactive) {
    if (!hasOAuthClientConfigured()) {
        throw new Error('请先在 manifest.json 的 oauth2.client_id 中配置 Google OAuth Client ID');
    }

    try {
        return await getCachedAuthToken(interactive);
    } catch (error) {
        await setDriveLastError(error.message || 'Google 授权失败');
        throw error;
    }
}

function getCachedAuthToken(interactive) {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            const token = typeof result === 'string' ? result : result && result.token;
            if (!token) {
                reject(new Error('未获取到 Google 授权令牌'));
                return;
            }

            resolve(token);
        });
    });
}

function removeCachedToken(token) {
    return new Promise((resolve, reject) => {
        chrome.identity.removeCachedAuthToken({ token }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            resolve();
        });
    });
}

async function buildBackupPayload() {
    const result = await getLocal(['prompts', 'aiSites']);
    return {
        version: DRIVE_BACKUP_VERSION,
        updatedAt: Date.now(),
        prompts: result.prompts || [],
        aiSites: result.aiSites || []
    };
}

async function findBackupFile(accessToken) {
    const query = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and 'appDataFolder' in parents and trashed=false`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name,modifiedTime)&pageSize=1`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    const data = await parseJsonResponse(response, '查询 Drive 备份文件失败');
    return (data.files && data.files[0]) || null;
}

async function findOrCreateBackupFile(accessToken) {
    const existing = await findBackupFile(accessToken);
    if (existing) {
        return existing;
    }

    const metadata = {
        name: DRIVE_FILE_NAME,
        parents: ['appDataFolder']
    };
    const boundary = `promptsnap-${Date.now()}`;
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: buildMultipartBody(boundary, metadata, {
            version: DRIVE_BACKUP_VERSION,
            updatedAt: Date.now(),
            prompts: [],
            aiSites: []
        })
    });

    return parseJsonResponse(response, '创建 Drive 备份文件失败');
}

async function uploadBackupFile(accessToken, fileId, backupData) {
    const boundary = `promptsnap-${Date.now()}`;
    const metadata = { name: DRIVE_FILE_NAME };
    const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,modifiedTime`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: buildMultipartBody(boundary, metadata, backupData)
    });

    return parseJsonResponse(response, '上传 Drive 备份失败');
}

function buildMultipartBody(boundary, metadata, data) {
    return [
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(metadata),
        `--${boundary}`,
        'Content-Type: application/json; charset=UTF-8',
        '',
        JSON.stringify(data),
        `--${boundary}--`
    ].join('\r\n');
}

async function parseJsonResponse(response, fallbackMessage) {
    const text = await response.text();
    let data = {};

    try {
        data = text ? JSON.parse(text) : {};
    } catch (err) {
        if (!response.ok) {
            throw new Error(fallbackMessage);
        }
        throw err;
    }

    if (!response.ok) {
        const errorMessage = data.error_description
            || (data.error && data.error.message)
            || data.error
            || fallbackMessage;
        await setDriveLastError(errorMessage);
        throw new Error(errorMessage);
    }

    return data;
}

async function setDriveLastError(message) {
    const current = await getLocal([DRIVE_META_KEY]);
    await setLocal({
        [DRIVE_META_KEY]: {
            ...(current[DRIVE_META_KEY] || {}),
            lastError: message || ''
        }
    });
}
