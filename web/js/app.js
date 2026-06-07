/**
 * PromptSnap Web — Main Application
 * 
 * 初始化、事件绑定、核心交互流程。
 */

const App = {
    _currentCategory: 'ALL',
    _currentQuery: '',
    _debounceTimer: null,

    async init() {
        // 1. 加载数据
        await Store.init();

        // 2. 渲染 UI
        this._renderAll();

        // 3. 绑定事件
        this._bindEvents();

        // 4. 检查是否为空数据
        if (Store.getPrompts().length === 0) {
            this._showWelcome();
        }
    },

    _renderAll() {
        const categories = Store.getCategories();
        Renderer.renderTags(categories, this._currentCategory, (cat) => {
            this._currentCategory = cat;
            this._renderAll();
        });

        const prompts = Store.filterPrompts(this._currentCategory, this._currentQuery);
        Renderer.renderCards(prompts, (p) => this._handleCopy(p));
        Renderer.renderStats(Store.getStats());
    },

    _bindEvents() {
        // 搜索
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => {
                this._currentQuery = e.target.value;
                this._renderFilteredCards();
            }, 150);
        });

        // Cmd+K / Ctrl+K 聚焦搜索
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
                searchInput.select();
            }
            // Escape 清空搜索
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.value = '';
                this._currentQuery = '';
                this._renderFilteredCards();
                searchInput.blur();
            }
        });

        // 导入按钮
        const importBtn = document.getElementById('btn-import');
        const fileInput = document.getElementById('file-input');
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this._handleImport(e));
        }

        // 从 Drive 同步按钮
        const syncBtn = document.getElementById('btn-sync-drive');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                try {
                    Renderer.showToast('准备授权...', 'success');
                    const data = await GDrive.fetchBackupData();
                    const result = await Store.importFromData(data);
                    
                    this._currentCategory = 'ALL';
                    this._currentQuery = '';
                    document.getElementById('search-input').value = '';
                    this._renderAll();
                    Renderer.showToast(`同步成功！新增 ${result.added} 条，更新 ${result.updated} 条`);
                } catch (err) {
                    Renderer.showToast(err.message, 'error');
                }
            });
        }

        // 清除缓存按钮
        const clearBtn = document.getElementById('btn-clear-cache');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (confirm('确定要清除本地缓存并重新加载数据吗？')) {
                    Store.clearCache();
                    await Store.init();
                    this._currentCategory = 'ALL';
                    this._currentQuery = '';
                    document.getElementById('search-input').value = '';
                    this._renderAll();
                    Renderer.showToast('缓存已清除，数据已重新加载');
                }
            });
        }

        // 拖拽导入
        this._setupDragDrop();
    },

    _renderFilteredCards() {
        const prompts = Store.filterPrompts(this._currentCategory, this._currentQuery);
        Renderer.renderCards(prompts, (p) => this._handleCopy(p));
    },

    /**
     * 复制流程：有变量 → 弹窗填写 → 复制；无变量 → 直接复制
     */
    _handleCopy(prompt) {
        const hasVars = Variables.hasVariables(prompt.content);

        if (hasVars) {
            Renderer.showVariableModal(prompt, async (finalContent) => {
                await this._copyToClipboard(finalContent);
                Renderer.showToast('已复制到剪贴板 ✓');
            });
        } else {
            this._copyToClipboard(prompt.content).then(() => {
                Renderer.showToast('已复制到剪贴板 ✓');
            });
        }
    },

    async _copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            // Fallback: textarea 方式
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
    },

    /**
     * 文件导入
     */
    async _handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const result = await Store.importFromFile(file);
            this._currentCategory = 'ALL';
            this._currentQuery = '';
            document.getElementById('search-input').value = '';
            this._renderAll();
            Renderer.showToast(`导入成功！新增 ${result.added} 条，更新 ${result.updated} 条`);
        } catch (err) {
            Renderer.showToast(err.message, 'error');
        }

        // 重置 file input
        event.target.value = '';
    },

    /**
     * 拖拽导入
     */
    _setupDragDrop() {
        const overlay = document.getElementById('drop-overlay');
        let dragCounter = 0;

        document.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragCounter++;
            if (dragCounter === 1) {
                overlay.classList.add('visible');
            }
        });

        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragCounter--;
            if (dragCounter === 0) {
                overlay.classList.remove('visible');
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', async (e) => {
            e.preventDefault();
            dragCounter = 0;
            overlay.classList.remove('visible');

            const file = e.dataTransfer.files[0];
            if (!file || !file.name.endsWith('.json')) {
                Renderer.showToast('请拖拽 JSON 文件', 'error');
                return;
            }

            try {
                const result = await Store.importFromFile(file);
                this._currentCategory = 'ALL';
                this._currentQuery = '';
                document.getElementById('search-input').value = '';
                this._renderAll();
                Renderer.showToast(`导入成功！新增 ${result.added} 条，更新 ${result.updated} 条`);
            } catch (err) {
                Renderer.showToast(err.message, 'error');
            }
        });
    },

    _showWelcome() {
        const grid = document.getElementById('card-grid');
        grid.innerHTML = `
            <div class="empty-state welcome">
                <div class="empty-icon">🚀</div>
                <div class="empty-title">欢迎使用 PromptSnap Web</div>
                <div class="empty-desc">
                    拖拽你的 PromptSnap 备份 JSON 文件到此页面，<br>
                    或点击右上角的"导入"按钮加载数据。
                </div>
            </div>
        `;
    }
};

// 启动
document.addEventListener('DOMContentLoaded', () => App.init());
