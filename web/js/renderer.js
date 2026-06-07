/**
 * PromptSnap Web — UI Renderer
 * 
 * 负责所有 UI 渲染：卡片列表、分类标签、模态框、Toast。
 */

const Renderer = {
    _expandedId: null,

    /**
     * 渲染分类标签栏
     */
    renderTags(categories, activeCategory, onClick) {
        const bar = document.getElementById('tags-bar');
        bar.innerHTML = '';

        // "全部" 标签
        const total = Array.from(categories.values()).reduce((s, c) => s + c, 0);
        this._createTag(bar, '全部', total, activeCategory === 'ALL', () => onClick('ALL'));

        // 各分类标签（按计数降序）
        const sorted = [...categories.entries()].sort((a, b) => b[1] - a[1]);
        sorted.forEach(([cat, count]) => {
            this._createTag(bar, cat, count, activeCategory === cat, () => onClick(cat));
        });
    },

    _createTag(container, label, count, isActive, onClick) {
        const tag = document.createElement('button');
        tag.className = `tag ${isActive ? 'active' : ''}`;
        tag.innerHTML = `${this._escapeHtml(label)} <span class="tag-count">${count}</span>`;
        tag.addEventListener('click', onClick);
        container.appendChild(tag);
    },

    /**
     * 渲染 Prompt 卡片列表
     */
    renderCards(prompts, onCopy, onExpand) {
        const grid = document.getElementById('card-grid');
        grid.innerHTML = '';

        if (prompts.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-title">没有找到匹配的 Prompt</div>
                    <div class="empty-desc">试试其他关键词或分类</div>
                </div>
            `;
            return;
        }

        prompts.forEach(p => {
            const card = document.createElement('div');
            card.className = 'card';
            card.dataset.id = p.id;

            const hasVars = Variables.hasVariables(p.content);
            const preview = this._getPreview(p.content, 120);
            const isExpanded = this._expandedId === p.id;

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-title">${this._escapeHtml(p.title)}</div>
                    ${p.category ? `<span class="card-category">${this._escapeHtml(p.category)}</span>` : ''}
                </div>
                <div class="card-preview ${isExpanded ? 'expanded' : ''}">${this._escapeHtml(isExpanded ? p.content : preview)}</div>
                ${isExpanded ? '' : `<div class="card-expand-hint">点击展开完整内容</div>`}
                <div class="card-footer">
                    <div class="card-meta">
                        ${p.usageCount ? `<span class="meta-item" title="使用次数">🔥 ${p.usageCount}</span>` : ''}
                        ${hasVars ? `<span class="meta-item var-badge" title="包含变量">⚡ 变量</span>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="btn-copy" title="${hasVars ? '填写变量后复制' : '复制到剪贴板'}">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                            </svg>
                            <span>复制</span>
                        </button>
                    </div>
                </div>
            `;

            // 点击卡片展开/折叠
            const previewEl = card.querySelector('.card-preview');
            const expandHint = card.querySelector('.card-expand-hint');
            const headerEl = card.querySelector('.card-header');

            const toggleExpand = (e) => {
                // 不要拦截按钮的点击
                if (e.target.closest('.btn-copy')) return;
                
                if (this._expandedId === p.id) {
                    this._expandedId = null;
                    previewEl.textContent = preview;
                    previewEl.classList.remove('expanded');
                    if (!expandHint) {
                        const hint = document.createElement('div');
                        hint.className = 'card-expand-hint';
                        hint.textContent = '点击展开完整内容';
                        card.querySelector('.card-footer').before(hint);
                    }
                } else {
                    // 先折叠之前展开的
                    const prevExpanded = document.querySelector('.card-preview.expanded');
                    if (prevExpanded) {
                        const prevCard = prevExpanded.closest('.card');
                        const prevId = Number(prevCard.dataset.id);
                        prevExpanded.textContent = this._getPreview(
                            Store.getPrompts().find(pp => pp.id === prevId)?.content || '', 120
                        );
                        prevExpanded.classList.remove('expanded');
                    }

                    this._expandedId = p.id;
                    previewEl.textContent = p.content;
                    previewEl.classList.add('expanded');
                    if (expandHint) expandHint.remove();
                }
            };

            headerEl.addEventListener('click', toggleExpand);
            if (previewEl) previewEl.addEventListener('click', toggleExpand);
            if (expandHint) expandHint.addEventListener('click', toggleExpand);

            // 复制按钮
            card.querySelector('.btn-copy').addEventListener('click', (e) => {
                e.stopPropagation();
                onCopy(p);
            });

            grid.appendChild(card);
        });
    },

    /**
     * 显示变量输入模态框
     */
    showVariableModal(prompt, onConfirm, onCancel) {
        const modal = document.getElementById('modal-overlay');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');
        const btnConfirm = document.getElementById('modal-confirm');
        const btnCancel = document.getElementById('modal-cancel');

        title.textContent = prompt.title;

        // 解析变量并渲染表单
        const vars = Variables.parse(prompt.content);
        Variables.renderForm(vars, body);

        // 绑定按钮
        const newConfirm = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newConfirm, btnConfirm);

        const newCancel = btnCancel.cloneNode(true);
        btnCancel.parentNode.replaceChild(newCancel, btnCancel);

        newConfirm.addEventListener('click', () => {
            const finalContent = Variables.resolve(prompt.content, body);
            onConfirm(finalContent);
            this.hideModal();
        });

        newCancel.addEventListener('click', () => {
            this.hideModal();
            if (onCancel) onCancel();
        });

        // 键盘快捷键
        const keyHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideModal();
                document.removeEventListener('keydown', keyHandler);
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                newConfirm.click();
                document.removeEventListener('keydown', keyHandler);
            }
        };
        document.addEventListener('keydown', keyHandler);

        // 点击遮罩关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideModal();
            }
        }, { once: true });

        modal.classList.add('visible');
        document.body.style.overflow = 'hidden';
    },

    hideModal() {
        const modal = document.getElementById('modal-overlay');
        modal.classList.remove('visible');
        document.body.style.overflow = '';
    },

    /**
     * Toast 通知
     */
    showToast(message, type = 'success') {
        // 移除已有 toast
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 触发动画
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    },

    /**
     * 渲染统计信息
     */
    renderStats(stats) {
        const el = document.getElementById('stats-bar');
        if (!el) return;
        el.innerHTML = `
            <span class="stat-item">${stats.total} 个 Prompt</span>
            <span class="stat-divider">·</span>
            <span class="stat-item">${stats.categories} 个分类</span>
            <span class="stat-divider">·</span>
            <span class="stat-item">累计使用 ${stats.totalUsage} 次</span>
        `;
    },

    /**
     * 内容预览截取
     */
    _getPreview(content, maxLen) {
        if (!content) return '';
        // 移除多余空行，压缩空白
        const clean = content.replace(/\n{3,}/g, '\n\n').trim();
        if (clean.length <= maxLen) return clean;
        return clean.slice(0, maxLen) + '…';
    },

    /**
     * HTML 转义
     */
    _escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};
