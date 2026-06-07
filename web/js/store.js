/**
 * PromptSnap Web — Data Store
 * 
 * 数据层：从 JSON 文件或 localStorage 加载 Prompt 数据。
 * 兼容两种格式：
 *   - 插件导出格式（纯数组）: [{id, title, ...}, ...]
 *   - Drive 备份格式（对象）: {version, prompts: [...], aiSites: [...]}
 */

const STORAGE_KEY = 'promptsnap_data';
const DATA_URL = 'data/prompts.json';

const Store = {
    _prompts: [],
    _loaded: false,

    /**
     * 初始化：优先从 localStorage 加载，否则从 JSON 文件拉取
     */
    async init() {
        // 1. 尝试从 localStorage 读取
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
            try {
                this._prompts = JSON.parse(cached);
                this._loaded = true;
                return this._prompts;
            } catch (e) {
                console.warn('PromptSnap: localStorage 数据损坏，重新加载');
                localStorage.removeItem(STORAGE_KEY);
            }
        }

        // 2. 从 JSON 文件加载
        try {
            const response = await fetch(DATA_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this._prompts = this._normalize(data);
            this._save();
            this._loaded = true;
            return this._prompts;
        } catch (e) {
            console.warn('PromptSnap: 无法加载 JSON 文件', e);
            this._prompts = [];
            this._loaded = true;
            return this._prompts;
        }
    },

    /**
     * 标准化数据：兼容纯数组和对象格式
     */
    _normalize(data) {
        let prompts = [];

        if (Array.isArray(data)) {
            // 插件导出格式：纯数组
            prompts = data;
        } else if (data && Array.isArray(data.prompts)) {
            // Drive 备份格式：对象
            prompts = data.prompts;
        }

        // 确保每条 Prompt 都有基础字段
        return prompts.map(p => ({
            id: p.id || Date.now(),
            title: p.title || '未命名',
            category: p.category || '未分类',
            content: p.content || '',
            usageCount: p.usageCount || 0,
            lastUsedAt: p.lastUsedAt || 0,
            createdAt: p.createdAt || p.id || 0,
            updatedAt: p.updatedAt || 0,
        }));
    },

    /**
     * 保存到 localStorage
     */
    _save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this._prompts));
        } catch (e) {
            console.warn('PromptSnap: localStorage 写入失败', e);
        }
    },

    /**
     * 获取所有 Prompt（按最近活跃排序）
     */
    getPrompts() {
        return [...this._prompts].sort((a, b) => {
            const lastActiveA = Math.max(a.updatedAt || 0, a.lastUsedAt || 0, a.id || 0);
            const lastActiveB = Math.max(b.updatedAt || 0, b.lastUsedAt || 0, b.id || 0);
            return lastActiveB - lastActiveA;
        });
    },

    /**
     * 获取所有分类（含计数）
     */
    getCategories() {
        const map = new Map();
        this._prompts.forEach(p => {
            const cat = p.category || '未分类';
            map.set(cat, (map.get(cat) || 0) + 1);
        });
        return map;
    },

    /**
     * 搜索过滤
     */
    filterPrompts(category, query) {
        const q = (query || '').trim().toLowerCase();
        let list = this.getPrompts();

        if (category && category !== 'ALL') {
            list = list.filter(p => p.category === category);
        }

        if (q) {
            list = list.filter(p => {
                const text = [p.title, p.category, p.content].join('\n').toLowerCase();
                return text.includes(q);
            });
        }

        return list;
    },

    /**
     * 从解析好的对象导入（如 Google Drive 下载的数据）
     */
    importFromData(data) {
        return new Promise((resolve, reject) => {
            try {
                const incoming = this._normalize(data);

                if (incoming.length === 0) {
                    reject(new Error('数据源中没有有效的 Prompt'));
                    return;
                }

                const existingIds = new Set(this._prompts.map(p => p.id));
                let added = 0, updated = 0;

                incoming.forEach(p => {
                    if (existingIds.has(p.id)) {
                        const idx = this._prompts.findIndex(ep => ep.id === p.id);
                        this._prompts[idx] = p;
                        updated++;
                    } else {
                        this._prompts.push(p);
                        added++;
                    }
                });

                this._save();
                resolve({ added, updated, total: this._prompts.length });
            } catch (err) {
                reject(new Error('数据合并失败'));
            }
        });
    },

    /**
     * 从文件导入 JSON
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    const result = await this.importFromData(data);
                    resolve(result);
                } catch (err) {
                    reject(new Error('JSON 解析或合并失败'));
                }
            };
            reader.onerror = () => reject(new Error('文件读取失败'));
            reader.readAsText(file);
        });
    },

    /**
     * 清除缓存（重新从 JSON 加载）
     */
    clearCache() {
        localStorage.removeItem(STORAGE_KEY);
        this._prompts = [];
        this._loaded = false;
    },

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            total: this._prompts.length,
            categories: this.getCategories().size,
            totalUsage: this._prompts.reduce((sum, p) => sum + (p.usageCount || 0), 0),
        };
    }
};
