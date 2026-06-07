/**
 * PromptSnap Web — Google Drive Integration
 * 
 * 使用 Google Identity Services (GIS) 实现 OAuth2 授权，
 * 并通过 Drive API v3 读取 appDataFolder 中的备份数据。
 */

const CLIENT_ID = '336433447993-pk30uqpa88srbmr8u1tvpb4vm9vqrf0j.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';

const GDrive = {
    _tokenClient: null,
    _accessToken: null,

    /**
     * 初始化 Token Client
     */
    init() {
        if (!window.google?.accounts?.oauth2) {
            console.error('Google Identity Services SDK not loaded.');
            return;
        }

        this._tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    this._accessToken = tokenResponse.access_token;
                    // Trigger the stored resolve function
                    if (this._resolveAuth) {
                        this._resolveAuth(this._accessToken);
                        this._resolveAuth = null;
                        this._rejectAuth = null;
                    }
                } else {
                    if (this._rejectAuth) {
                        this._rejectAuth(new Error('授权失败或被取消'));
                        this._resolveAuth = null;
                        this._rejectAuth = null;
                    }
                }
            },
        });
    },

    /**
     * 触发授权流程并返回 Access Token
     * 如果已有 token 会静默请求，否则弹出窗口
     */
    async authorize() {
        if (!this._tokenClient) {
            this.init();
        }

        return new Promise((resolve, reject) => {
            this._resolveAuth = resolve;
            this._rejectAuth = reject;

            // 调用 requestAccessToken，如果没有授权会弹出窗口
            this._tokenClient.requestAccessToken({ prompt: 'consent' });
        });
    },

    /**
     * 核心流程：授权 -> 查找文件 -> 下载数据
     */
    async fetchBackupData() {
        try {
            const token = await this.authorize();
            
            // 1. 查找 promptsnap-backup.json 文件
            Renderer.showToast('正在连接 Google Drive...', 'success');
            const searchUrl = new URL('https://www.googleapis.com/drive/v3/files');
            searchUrl.searchParams.append('spaces', 'appDataFolder');
            searchUrl.searchParams.append('q', "name='promptsnap-backup.json'");
            searchUrl.searchParams.append('fields', 'files(id, name, modifiedTime)');

            const searchRes = await fetch(searchUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!searchRes.ok) throw new Error('查找备份文件失败');

            const searchData = await searchRes.json();
            if (!searchData.files || searchData.files.length === 0) {
                throw new Error('在 Google Drive 中未找到备份文件');
            }

            const fileId = searchData.files[0].id;

            // 2. 下载文件内容
            Renderer.showToast('正在拉取备份数据...', 'success');
            const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
            const downloadRes = await fetch(downloadUrl, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!downloadRes.ok) throw new Error('下载备份文件失败');

            const backupData = await downloadRes.json();
            return backupData;

        } catch (error) {
            console.error('Google Drive Sync Error:', error);
            throw error;
        }
    }
};
