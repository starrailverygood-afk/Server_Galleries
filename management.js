// management.js — 圖庫管理（含批次刪除）

const MGMT_CSS = `
.mgmt-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.72);z-index:9998}
.mgmt-dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:92%;max-width:680px;max-height:86vh;background:#1e293b;border-radius:16px;z-index:9999;display:flex;flex-direction:column;box-shadow:0 25px 60px rgba(0,0,0,.55);overflow:hidden}
.mgmt-header{display:flex;justify-content:space-between;align-items:center;padding:16px 22px;border-bottom:1px solid #334155;flex-shrink:0}
.mgmt-header h2{margin:0;color:#f1f5f9;font-size:17px;font-weight:600}
.mgmt-close{background:none;border:none;color:#94a3b8;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px;line-height:1}
.mgmt-close:hover{background:#334155;color:#f1f5f9}
.mgmt-tabs{display:flex;border-bottom:1px solid #334155;flex-shrink:0}
.mgmt-tab{flex:1;padding:11px 16px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;font-weight:500;border-bottom:2px solid transparent;transition:all .2s}
.mgmt-tab:hover{color:#e2e8f0;background:rgba(255,255,255,.03)}
.mgmt-tab.active{color:#3b82f6;border-bottom-color:#3b82f6}
.mgmt-body{flex:1;overflow-y:auto;padding:20px 22px}
.mgmt-item{background:#0f172a;border-radius:10px;padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.mgmt-item-info{flex:1;min-width:0}
.mgmt-item-info h4{margin:0 0 3px;color:#f1f5f9;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mgmt-item-meta{color:#64748b;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mgmt-item-actions{display:flex;gap:5px;flex-shrink:0}
.mgmt-btn{padding:7px 13px;border:none;border-radius:7px;cursor:pointer;font-size:13px;font-weight:500;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
.mgmt-btn:disabled{opacity:.45;cursor:not-allowed}
.mgmt-btn.primary{background:#3b82f6;color:#fff}
.mgmt-btn.primary:hover:not(:disabled){background:#2563eb}
.mgmt-btn.danger{background:#dc2626;color:#fff}
.mgmt-btn.danger:hover:not(:disabled){background:#b91c1c}
.mgmt-btn.ghost{background:#334155;color:#cbd5e1}
.mgmt-btn.ghost:hover:not(:disabled){background:#475569}
.mgmt-btn.sm{padding:5px 9px;font-size:12px}
.mgmt-form{background:#0f172a;border-radius:10px;padding:18px 20px;margin-bottom:14px}
.mgmt-form h3{margin:0 0 14px;color:#e2e8f0;font-size:15px;font-weight:600}
.mgmt-field{margin-bottom:11px}
.mgmt-field label{display:block;color:#94a3b8;font-size:12px;font-weight:500;margin-bottom:5px}
.mgmt-field input,.mgmt-field select{width:100%;padding:9px 12px;background:#1e293b;border:1px solid #334155;border-radius:7px;color:#e2e8f0;font-size:14px;box-sizing:border-box;outline:none;transition:border-color .15s}
.mgmt-field input:focus,.mgmt-field select:focus{border-color:#3b82f6}
.mgmt-form-actions{display:flex;gap:8px;margin-top:14px}
.mgmt-dropzone{border:2px dashed #475569;border-radius:12px;padding:32px 20px;text-align:center;cursor:pointer;transition:all .2s;color:#64748b;margin:14px 0}
.mgmt-dropzone:hover,.mgmt-dropzone.dragover{border-color:#3b82f6;background:rgba(59,130,246,.06);color:#94a3b8}
.mgmt-dropzone-icon{font-size:32px;margin-bottom:6px}
.mgmt-dropzone-text{font-size:14px}
.mgmt-dropzone-hint{font-size:12px;margin-top:4px;color:#475569}
.mgmt-preview{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}
.mgmt-preview-item{width:68px;height:68px;border-radius:7px;overflow:hidden;position:relative;border:1px solid #334155}
.mgmt-preview-item img{width:100%;height:100%;object-fit:cover}
.mgmt-preview-remove{position:absolute;top:2px;right:2px;width:18px;height:18px;background:rgba(0,0,0,.72);border:none;border-radius:50%;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
.mgmt-progress-bar{background:#0f172a;border-radius:99px;overflow:hidden;height:5px;margin:8px 0}
.mgmt-progress-fill{height:100%;background:#3b82f6;border-radius:99px;transition:width .3s;width:0}
.mgmt-status{color:#94a3b8;font-size:12px;margin-top:4px}
.mgmt-empty{text-align:center;color:#475569;padding:44px 20px;font-size:14px}
.mgmt-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 24px;border-radius:10px;color:#fff;font-size:14px;z-index:99999;pointer-events:none;white-space:nowrap;animation:mgmtIn .25s ease,mgmtOut .3s ease 2.5s forwards}
.mgmt-toast.success{background:#059669}
.mgmt-toast.error{background:#dc2626}
.mgmt-toast.info{background:#2563eb}
@keyframes mgmtIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes mgmtOut{to{opacity:0}}
.mgmt-confirm-bg{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.55);z-index:99998;display:flex;align-items:center;justify-content:center}
.mgmt-confirm-box{background:#1e293b;border-radius:14px;padding:26px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,.45)}
.mgmt-confirm-box p{color:#e2e8f0;margin:0 0 18px;line-height:1.6}
.mgmt-confirm-actions{display:flex;gap:10px;justify-content:center}

/* ★ 批次刪除樣式 */
.mgmt-batch-section{margin-top:16px;border-top:1px solid #334155;padding-top:16px}
.mgmt-batch-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px}
.mgmt-batch-header h4{color:#e2e8f0;font-size:14px;margin:0;font-weight:600}
.mgmt-batch-actions{display:flex;gap:6px;flex-wrap:wrap}
.mgmt-batch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px;max-height:320px;overflow-y:auto;padding:4px}
.mgmt-batch-item{position:relative;aspect-ratio:1;border-radius:6px;overflow:hidden;cursor:pointer;border:2px solid #334155;transition:all .15s}
.mgmt-batch-item:hover{border-color:#64748b}
.mgmt-batch-item.selected{border-color:#ef4444;box-shadow:0 0 8px rgba(239,68,68,.35)}
.mgmt-batch-item img{width:100%;height:100%;object-fit:cover;display:block}
.mgmt-batch-check{position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.5);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;color:transparent;font-size:11px;transition:all .15s;pointer-events:none}
.mgmt-batch-item.selected .mgmt-batch-check{background:#ef4444;border-color:#ef4444;color:#fff}
.mgmt-batch-count{color:#94a3b8;font-size:12px;margin-top:8px}

@media(max-width:640px){.mgmt-dialog{width:96%;max-height:92vh;border-radius:12px}.mgmt-body{padding:16px}.mgmt-item{flex-direction:column;align-items:stretch}.mgmt-item-actions{justify-content:flex-end;margin-top:8px}.mgmt-batch-grid{grid-template-columns:repeat(auto-fill,minmax(70px,1fr))}}
`;

class GalleryManager {
    constructor() {
        this.galleries = [];
        this.b2 = b2Manager;
        this.files = [];
        this.tab = 'galleries';
        this.editIdx = -1;
        this.creating = false;
        this.targetId = '';
        this.uploading = false;
        this.selectedImages = new Set(); // ★ 批次刪除選取
    }

    // ─── 初始化 ───

    injectStyles() {
        if (document.getElementById('mgmt-css')) return;
        const el = document.createElement('style');
        el.id = 'mgmt-css';
        el.textContent = MGMT_CSS;
        document.head.appendChild(el);
    }

    async init() {
        this.injectStyles();
        try {
            this.galleries = await this.b2.readGalleries();
        } catch (e) {
            console.error('載入圖庫失敗:', e);
            this.galleries = [];
        }
        this.render();
    }

    // ─── 渲染 ───

    render() {
        const panel = document.getElementById('managementPanel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="mgmt-overlay" onclick="closeManagementPanel()"></div>
            <div class="mgmt-dialog">
                <div class="mgmt-header">
                    <h2><i class="fas fa-folder-open"></i> 圖庫管理</h2>
                    <button class="mgmt-close" onclick="closeManagementPanel()">✕</button>
                </div>
                <div class="mgmt-tabs">
                    <button class="mgmt-tab ${this.tab === 'galleries' ? 'active' : ''}"
                            onclick="galleryManager.switchTab('galleries')">
                        <i class="fas fa-th-list"></i> 圖庫總覽
                    </button>
                    <button class="mgmt-tab ${this.tab === 'upload' ? 'active' : ''}"
                            onclick="galleryManager.switchTab('upload')">
                        <i class="fas fa-upload"></i> 上傳圖片
                    </button>
                </div>
                <div class="mgmt-body">
                    ${this.tab === 'galleries' ? this.renderGalleries() : this.renderUpload()}
                </div>
            </div>
        `;

        if (this.tab === 'upload') this.bindDropzone();
    }

    switchTab(tab) {
        this.tab = tab;
        this.render();
    }

    // ─── 圖庫總覽 Tab ───

    renderGalleries() {
        let html = '';

        if (this.creating) {
            html += this.renderForm();
        } else {
            html += `
                <button class="mgmt-btn primary" style="width:100%;padding:11px;margin-bottom:14px"
                        onclick="galleryManager.creating=true;galleryManager.render()">
                    <i class="fas fa-plus"></i> 新增空白圖庫
                </button>`;
        }

        if (this.galleries.length === 0 && !this.creating) {
            html += '<div class="mgmt-empty">還沒有任何圖庫，點擊上方按鈕建立</div>';
        }

        this.galleries.forEach((g, i) => {
            if (this.editIdx === i) {
                html += this.renderForm(g, i);
            } else {
                const chars = (g.character || []).join(', ');
                const tags = (g.tags || []).join(', ');
                html += `
                    <div class="mgmt-item">
                        <div class="mgmt-item-info">
                            <h4>${this.esc(g.name)}</h4>
                            <div class="mgmt-item-meta">
                                ${g.fileCount || 0} 張${chars ? ' · ' + this.esc(chars) : ''}${tags ? ' · ' + this.esc(tags) : ''}
                            </div>
                        </div>
                        <div class="mgmt-item-actions">
                            <button class="mgmt-btn primary sm" onclick="galleryManager.goUpload('${g.id}')" title="上傳圖片">
                                <i class="fas fa-upload"></i>
                            </button>
                            <button class="mgmt-btn ghost sm" onclick="galleryManager.startEdit(${i})" title="編輯">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="mgmt-btn danger sm" onclick="galleryManager.confirmDel(${i})" title="刪除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>`;
            }
        });

        return html;
    }

    // ★ 新增：進入編輯模式（重置選取）
    startEdit(index) {
        this.editIdx = index;
        this.selectedImages = new Set();
        this.render();
    }

    // 共用表單（新增 / 編輯）— ★ 編輯時多了批次刪除區塊
    renderForm(gallery = null, index = -1) {
        const isEdit = gallery !== null;
        const name = isEdit ? gallery.name : '';
        const chars = isEdit ? (gallery.character || []).join(', ') : '';
        const tags = isEdit ? (gallery.tags || []).join(', ') : '';

        let html = `
            <div class="mgmt-form">
                <h3>${isEdit ? '編輯圖庫' : '新增圖庫'}</h3>
                <div class="mgmt-field">
                    <label>圖庫名稱 *</label>
                    <input type="text" id="mgmtName" value="${this.esc(name)}" placeholder="例如: 甘雨-7-新圖庫">
                </div>
                <div class="mgmt-field">
                    <label>角色標籤（逗號分隔）</label>
                    <input type="text" id="mgmtChars" value="${this.esc(chars)}" placeholder="例如: 甘雨, 刻晴">
                </div>
                <div class="mgmt-field">
                    <label>其他標籤（逗號分隔）</label>
                    <input type="text" id="mgmtTags" value="${this.esc(tags)}" placeholder="例如: 正常, 日常">
                </div>
                <div class="mgmt-form-actions">
                    <button class="mgmt-btn primary" onclick="galleryManager.saveForm(${index})">
                        ${isEdit ? '儲存變更' : '建立圖庫'}
                    </button>
                    <button class="mgmt-btn ghost" onclick="galleryManager.cancelForm()">取消</button>
                </div>`;

        // ★ 編輯模式 + 有圖片時，顯示批次刪除區塊
        if (isEdit && gallery.imageFiles && gallery.imageFiles.length > 0) {
            html += `
                <div class="mgmt-batch-section">
                    <div class="mgmt-batch-header">
                        <h4><i class="fas fa-images"></i> 批次刪除圖片（${gallery.imageFiles.length} 張）</h4>
                        <div class="mgmt-batch-actions">
                            <button class="mgmt-btn ghost sm" onclick="galleryManager.selectAllImages()">
                                <i class="fas fa-check-double"></i> 全選
                            </button>
                            <button class="mgmt-btn ghost sm" onclick="galleryManager.deselectAllImages()">
                                <i class="fas fa-times"></i> 取消全選
                            </button>
                            <button class="mgmt-btn danger sm" id="mgmtBatchDeleteBtn" disabled
                                    onclick="galleryManager.confirmBatchDelete()">
                                <i class="fas fa-trash"></i> <span id="mgmtBatchDeleteText">刪除選中</span>
                            </button>
                        </div>
                    </div>
                    <div class="mgmt-batch-grid">
                        ${gallery.imageFiles.map((file, idx) => {
                            const url = this.getImageUrl(gallery, file);
                            const selected = this.selectedImages.has(idx) ? ' selected' : '';
                            return `<div class="mgmt-batch-item${selected}" data-idx="${idx}"
                                         onclick="galleryManager.toggleSelect(${idx})">
                                <img src="${url}" alt="${this.esc(file)}" loading="lazy"
                                     onerror="this.style.display='none'">
                                <div class="mgmt-batch-check"><i class="fas fa-check"></i></div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div class="mgmt-batch-count" id="mgmtBatchCount">
                        已選擇 ${this.selectedImages.size} 張
                    </div>
                </div>`;
        }

        html += `</div>`;
        return html;
    }

    // ★ 新增：取得圖片 URL
    getImageUrl(gallery, fileName) {
        const basePath = (gallery.folderPath || '').replace(/^\/+|\/+$/g, '');
        return `https://f005.backblazeb2.com/file/laserpen-gallery-bucket/${basePath}/${fileName}`;
    }

    // ★ 新增：切換單張選取（不重新渲染，直接操作 DOM）
    toggleSelect(idx) {
        if (this.selectedImages.has(idx)) {
            this.selectedImages.delete(idx);
        } else {
            this.selectedImages.add(idx);
        }
        const item = document.querySelector(`.mgmt-batch-item[data-idx="${idx}"]`);
        if (item) item.classList.toggle('selected', this.selectedImages.has(idx));
        this.updateBatchCount();
    }

    // ★ 新增：全選
    selectAllImages() {
        const gallery = this.galleries[this.editIdx];
        if (!gallery) return;
        for (let i = 0; i < gallery.imageFiles.length; i++) {
            this.selectedImages.add(i);
        }
        document.querySelectorAll('.mgmt-batch-item').forEach(el => el.classList.add('selected'));
        this.updateBatchCount();
    }

    // ★ 新增：取消全選
    deselectAllImages() {
        this.selectedImages.clear();
        document.querySelectorAll('.mgmt-batch-item').forEach(el => el.classList.remove('selected'));
        this.updateBatchCount();
    }

    // ★ 新增：更新選取數量顯示
    updateBatchCount() {
        const count = this.selectedImages.size;
        const countEl = document.getElementById('mgmtBatchCount');
        if (countEl) countEl.textContent = `已選擇 ${count} 張`;

        const btn = document.getElementById('mgmtBatchDeleteBtn');
        if (btn) btn.disabled = count === 0;

        const text = document.getElementById('mgmtBatchDeleteText');
        if (text) text.textContent = count > 0 ? `刪除選中 (${count})` : '刪除選中';
    }

    // ★ 新增：批次刪除確認
    confirmBatchDelete() {
        const count = this.selectedImages.size;
        if (count === 0) return;

        const bg = document.createElement('div');
        bg.className = 'mgmt-confirm-bg';
        bg.innerHTML = `
            <div class="mgmt-confirm-box">
                <p>確定要刪除選中的<br><strong style="color:#f87171">${count} 張圖片</strong>？<br>
                <span style="color:#94a3b8;font-size:13px">刪除後無法恢復</span></p>
                <div class="mgmt-confirm-actions">
                    <button class="mgmt-btn danger" id="mgmtBatchYes">確定刪除</button>
                    <button class="mgmt-btn ghost" id="mgmtBatchNo">取消</button>
                </div>
            </div>`;
        document.body.appendChild(bg);
        document.getElementById('mgmtBatchYes').onclick = () => { bg.remove(); this.doBatchDelete(); };
        document.getElementById('mgmtBatchNo').onclick = () => bg.remove();
        bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
    }

    // ★ 新增：執行批次刪除
    async doBatchDelete() {
        if (this.selectedImages.size === 0) return;

        const gallery = this.galleries[this.editIdx];
        if (!gallery) return;

        this.toast('正在刪除圖片...', 'info');

        // 按降序排列索引（這樣 splice 不會影響前面的索引）
        const indicesToDelete = Array.from(this.selectedImages).sort((a, b) => b - a);
        const filesToDelete = indicesToDelete.map(idx => gallery.imageFiles[idx]);

        let successCount = 0;
        for (const file of filesToDelete) {
            try {
                await this.b2.deleteFile(gallery.folderPath + '/' + file);
                successCount++;
            } catch (e) {
                console.warn('刪除文件失敗:', file, e);
            }
        }

        // 從 imageFiles 移除（降序 splice）
        for (const idx of indicesToDelete) {
            gallery.imageFiles.splice(idx, 1);
        }
        gallery.fileCount = gallery.imageFiles.length;

        try {
            await this.b2.updateGalleries(this.galleries);
            this.toast(`成功刪除 ${successCount} 張圖片`, 'success');
        } catch (e) {
            this.toast('更新數據失敗: ' + e.message, 'error');
        }

        this.selectedImages = new Set();
        this.render();
    }

    async saveForm(index) {
        const name = document.getElementById('mgmtName')?.value?.trim();
        if (!name) { this.toast('請輸入圖庫名稱', 'error'); return; }

        const chars = this.splitInput('mgmtChars');
        const tags = this.splitInput('mgmtTags');

        try {
            if (index === -1) {
                this.galleries.push({
                    id: 'gallery-' + Date.now(),
                    name: name,
                    folderPath: 'galleries/' + name,
                    character: chars,
                    tags: tags,
                    fileCount: 0,
                    imageFiles: []
                });
            } else {
                const g = this.galleries[index];
                g.name = name;
                g.character = chars;
                g.tags = tags;
            }

            await this.b2.updateGalleries(this.galleries);
            this.creating = false;
            this.editIdx = -1;
            this.selectedImages = new Set(); // ★ 重置選取
            this.toast(index === -1 ? '圖庫「' + name + '」已建立' : '更新成功', 'success');
            this.render();
        } catch (e) {
            if (index === -1) this.galleries.pop();
            this.toast('操作失敗: ' + e.message, 'error');
        }
    }

    cancelForm() {
        this.creating = false;
        this.editIdx = -1;
        this.selectedImages = new Set(); // ★ 重置選取
        this.render();
    }

    confirmDel(index) {
        const g = this.galleries[index];
        const bg = document.createElement('div');
        bg.className = 'mgmt-confirm-bg';
        bg.innerHTML = `
            <div class="mgmt-confirm-box">
                <p>確定要刪除圖庫<br><strong style="color:#f87171">「${this.esc(g.name)}」</strong>？<br>
                <span style="color:#94a3b8;font-size:13px">包含 ${g.fileCount} 張圖片，刪除後無法恢復</span></p>
                <div class="mgmt-confirm-actions">
                    <button class="mgmt-btn danger" id="mgmtYes">確定刪除</button>
                    <button class="mgmt-btn ghost" id="mgmtNo">取消</button>
                </div>
            </div>`;
        document.body.appendChild(bg);
        document.getElementById('mgmtYes').onclick = () => { bg.remove(); this.doDelete(index); };
        document.getElementById('mgmtNo').onclick = () => bg.remove();
        bg.onclick = (e) => { if (e.target === bg) bg.remove(); };
    }

    async doDelete(index) {
        const g = this.galleries[index];
        this.toast('正在刪除...', 'info');
        try {
            for (const f of (g.imageFiles || [])) {
                try { await this.b2.deleteFile(g.folderPath + '/' + f); }
                catch (e) { console.warn('刪除文件失敗:', f, e); }
            }
            this.galleries.splice(index, 1);
            await this.b2.updateGalleries(this.galleries);
            this.toast('圖庫「' + g.name + '」已刪除', 'success');
            this.render();
        } catch (e) {
            this.toast('刪除失敗: ' + e.message, 'error');
        }
    }

    // ─── 上傳圖片 Tab ───

    goUpload(galleryId) {
        this.targetId = galleryId;
        this.switchTab('upload');
    }

    renderUpload() {
        let html = `
            <div class="mgmt-field">
                <label>目標圖庫 *</label>
                <select id="mgmtTarget" onchange="galleryManager.targetId=this.value">
                    <option value="">── 請選擇圖庫 ──</option>
                    ${this.galleries.map(g =>
                        '<option value="' + g.id + '"' + (g.id === this.targetId ? ' selected' : '') + '>' +
                        this.esc(g.name) + ' (' + (g.fileCount || 0) + ' 張)</option>'
                    ).join('')}
                </select>
            </div>
            <div class="mgmt-dropzone" id="mgmtDrop">
                <div class="mgmt-dropzone-icon"><i class="fas fa-cloud-upload-alt"></i></div>
                <div class="mgmt-dropzone-text">拖放圖片到這裡，或點擊選擇</div>
                <div class="mgmt-dropzone-hint">支援 JPG、PNG、GIF、WebP，可多選</div>
                <input type="file" id="mgmtFileIn" multiple accept="image/*" style="display:none">
            </div>`;

        if (this.files.length > 0) {
            html += `
                <div style="color:#94a3b8;font-size:13px;margin-bottom:6px">已選擇 ${this.files.length} 個文件</div>
                <div class="mgmt-preview">
                    ${this.files.map((f, i) =>
                        '<div class="mgmt-preview-item">' +
                        '<img src="' + URL.createObjectURL(f) + '" alt="">' +
                        '<button class="mgmt-preview-remove" onclick="event.stopPropagation();galleryManager.removeFile(' + i + ')">✕</button>' +
                        '</div>'
                    ).join('')}
                </div>
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button class="mgmt-btn primary" style="flex:1"
                            onclick="galleryManager.startUpload()" ${this.uploading ? 'disabled' : ''}>
                        <i class="fas fa-upload"></i> ${this.uploading ? '上傳中...' : '開始上傳'}
                    </button>
                    <button class="mgmt-btn ghost" onclick="galleryManager.clearFiles()"
                            ${this.uploading ? 'disabled' : ''}>清除</button>
                </div>`;
        }

        html += `
            <div id="mgmtProg" style="display:none;margin-top:12px">
                <div class="mgmt-progress-bar"><div class="mgmt-progress-fill" id="mgmtFill"></div></div>
                <div class="mgmt-status" id="mgmtStatTxt"></div>
            </div>`;

        return html;
    }

    bindDropzone() {
        const drop = document.getElementById('mgmtDrop');
        const input = document.getElementById('mgmtFileIn');
        if (!drop || !input) return;

        drop.onclick = () => input.click();
        drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('dragover'); };
        drop.ondragleave = () => drop.classList.remove('dragover');
        drop.ondrop = (e) => {
            e.preventDefault(); drop.classList.remove('dragover');
            this.addFiles(Array.from(e.dataTransfer.files));
        };
        input.onchange = (e) => { this.addFiles(Array.from(e.target.files)); e.target.value = ''; };
    }

    addFiles(incoming) {
        const imgs = incoming.filter(f => f.type.startsWith('image/'));
        if (imgs.length === 0) { this.toast('請選擇圖片文件', 'error'); return; }
        this.files = [...this.files, ...imgs];
        this.render();
    }

    removeFile(i) { this.files.splice(i, 1); this.render(); }
    clearFiles() { this.files = []; this.render(); }

    async startUpload() {
        const targetId = document.getElementById('mgmtTarget')?.value;
        if (!targetId) { this.toast('請選擇目標圖庫', 'error'); return; }
        if (this.files.length === 0) { this.toast('請選擇圖片', 'error'); return; }

        const gallery = this.galleries.find(g => g.id === targetId);
        if (!gallery) { this.toast('找不到圖庫', 'error'); return; }

        this.uploading = true;
        this.render();

        const progEl = document.getElementById('mgmtProg');
        const fillEl = document.getElementById('mgmtFill');
        const textEl = document.getElementById('mgmtStatTxt');
        if (progEl) progEl.style.display = 'block';

        let successCount = 0;
        const newFileNames = [];

        for (let i = 0; i < this.files.length; i++) {
            const file = this.files[i];
            const filePath = gallery.folderPath + '/' + file.name;
            if (textEl) textEl.textContent = '上傳 (' + (i + 1) + '/' + this.files.length + '): ' + file.name;
            if (fillEl) fillEl.style.width = ((i + 1) / this.files.length * 100) + '%';

            try {
                await this.b2.uploadFile(file, filePath);
                if (!gallery.imageFiles.includes(file.name)) newFileNames.push(file.name);
                successCount++;
            } catch (e) {
                console.error('上傳失敗 ' + file.name + ':', e);
                this.toast('上傳失敗: ' + file.name, 'error');
            }
        }

        if (newFileNames.length > 0) {
            gallery.imageFiles = [...gallery.imageFiles, ...newFileNames];
            gallery.fileCount = gallery.imageFiles.length;
            try {
                if (textEl) textEl.textContent = '更新圖庫數據...';
                await this.b2.updateGalleries(this.galleries);
            } catch (e) {
                this.toast('更新數據失敗: ' + e.message, 'error');
            }
        }

        if (successCount > 0) {
            this.toast('成功上傳 ' + successCount + ' 張圖片到「' + gallery.name + '」', 'success');
        }

        this.uploading = false;
        this.files = [];
        this.render();
    }

    // ─── 工具方法 ───

    splitInput(id) {
        const v = document.getElementById(id)?.value?.trim() || '';
        return v ? v.split(',').map(s => s.trim()).filter(s => s) : [];
    }

    esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    toast(msg, type = 'info') {
        document.querySelectorAll('.mgmt-toast').forEach(el => el.remove());
        const el = document.createElement('div');
        el.className = 'mgmt-toast ' + type;
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
}

// ─── 全局實例與函數 ───

const galleryManager = new GalleryManager();

function openManagementPage() {
    document.getElementById('managementPanel').style.display = 'block';
    galleryManager.init();
}

function closeManagementPanel() {
    document.getElementById('managementPanel').style.display = 'none';

    if (typeof loadGalleryData === 'function') {
        loadGalleryData().then(() => {
            if (typeof processGalleryCovers === 'function') processGalleryCovers();
            if (typeof updateStats === 'function') updateStats();
            if (typeof updateTagFilters === 'function') updateTagFilters();
            if (typeof renderGalleryList === 'function' && typeof galleryDatabase !== 'undefined') {
                renderGalleryList(galleryDatabase);
            }
        }).catch(e => console.error('刷新圖庫失敗:', e));
    }
}
