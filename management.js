// management.js
class GalleryManager {
    constructor() {
        this.uploadedFiles = [];
        this.currentGalleries = [];
        this.b2 = b2Manager;
        this.currentTab = 'upload';
    }
    
    // 初始化管理界面
    async init() {
        // 載入現有圖庫
        await this.loadExistingGalleries();
        
        // 渲染界面
        this.renderManagementPanel();
        
        // 設置事件監聽器
        this.setupEventListeners();
    }
    
    // 載入現有圖庫
    async loadExistingGalleries() {
        try {
            this.currentGalleries = await this.b2.readGalleries();
            console.log('載入現有圖庫:', this.currentGalleries.length);
        } catch (error) {
            console.error('載入圖庫失敗:', error);
            this.currentGalleries = [];
        }
    }
    
    // 渲染管理面板
    renderManagementPanel() {
        const panel = document.getElementById('managementPanel');
        
        panel.innerHTML = `
            <div class="management-overlay" onclick="closeManagementPanel()"></div>
            <div class="management-content">
                <div class="management-tabs">
                    <button class="tab-btn ${this.currentTab === 'upload' ? 'active' : ''}" 
                            data-tab="upload" onclick="galleryManager.switchTab('upload')">
                        <i class="fas fa-upload"></i> 上傳新圖庫
                    </button>
                    <button class="tab-btn ${this.currentTab === 'manage' ? 'active' : ''}" 
                            data-tab="manage" onclick="galleryManager.switchTab('manage')">
                        <i class="fas fa-list"></i> 管理現有圖庫
                    </button>
                    <button class="tab-btn ${this.currentTab === 'delete' ? 'active' : ''}" 
                            data-tab="delete" onclick="galleryManager.switchTab('delete')">
                        <i class="fas fa-trash"></i> 刪除圖庫
                    </button>
                </div>
                
                <div class="management-body" id="managementBody">
                    ${this.renderCurrentTab()}
                </div>
            </div>
        `;
    }
    
    // 渲染當前標籤頁
    renderCurrentTab() {
        switch (this.currentTab) {
            case 'upload':
                return this.renderUploadTab();
            case 'manage':
                return this.renderManageTab();
            case 'delete':
                return this.renderDeleteTab();
            default:
                return this.renderUploadTab();
        }
    }
    
    // 上傳標籤頁
    renderUploadTab() {
        return `
            <div class="upload-tab">
                <div class="upload-area" id="uploadArea" onclick="document.getElementById('folderInput').click()">
                    <div class="upload-icon">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <h3>拖放文件夾或點擊選擇</h3>
                    <p>支援 JPG、PNG 格式，會自動建立圖庫</p>
                    <input type="file" id="folderInput" webkitdirectory multiple style="display: none;">
                </div>
                
                ${this.uploadedFiles.length > 0 ? this.renderUploadPreview() : ''}
                
                ${this.uploadedFiles.length > 0 ? this.renderUploadForm() : ''}
                
                <div class="upload-progress" id="uploadProgress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">準備上傳...</div>
                </div>
            </div>
        `;
    }
    
    // 上傳預覽
    renderUploadPreview() {
        return `
            <div class="upload-preview" id="uploadPreview">
                ${this.uploadedFiles.map((file, index) => `
                    <div class="preview-item">
                        <img src="${URL.createObjectURL(file)}" alt="${file.name}" class="preview-img">
                        <button class="preview-remove" onclick="galleryManager.removeFile(${index})">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // 上傳表單
    renderUploadForm() {
        return `
            <div class="upload-form">
                <div class="form-group">
                    <label for="galleryName">圖庫名稱 *</label>
                    <input type="text" id="galleryName" placeholder="例如: 甘雨-7-新圖庫" required>
                </div>
                
                <div class="form-group">
                    <label for="galleryCharacter">角色標籤 (可多個，用逗號分隔)</label>
                    <input type="text" id="galleryCharacter" placeholder="例如: 甘雨, 刻晴">
                </div>
                
                <div class="form-group">
                    <label for="galleryTags">其他標籤 (可多個，用逗號分隔)</label>
                    <input type="text" id="galleryTags" placeholder="例如: 正常, 口交, 後入">
                </div>
                
                <div style="margin-top: 30px; display: flex; gap: 10px;">
                    <button class="viewer-btn" onclick="galleryManager.startUpload()" style="flex: 1;">
                        <i class="fas fa-upload"></i> 開始上傳
                    </button>
                    <button class="viewer-btn" onclick="galleryManager.clearUpload()" style="background-color: #475569;">
                        <i class="fas fa-times"></i> 清除選擇
                    </button>
                </div>
            </div>
        `;
    }
    
    // 管理標籤頁
    renderManageTab() {
        if (this.currentGalleries.length === 0) {
            return '<div class="empty-state"><p>還沒有任何圖庫</p></div>';
        }
        
        return `
            <div class="gallery-list-manage">
                ${this.currentGalleries.map((gallery, index) => `
                    <div class="gallery-item-manage">
                        <div class="gallery-item-header">
                            <h4>${gallery.name}</h4>
                            <div class="gallery-item-actions">
                                <button class="action-btn" onclick="galleryManager.editGallery(${index})">
                                    <i class="fas fa-edit"></i> 編輯
                                </button>
                                <button class="action-btn delete" onclick="galleryManager.deleteGallery(${index})">
                                    <i class="fas fa-trash"></i> 刪除
                                </button>
                            </div>
                        </div>
                        <div style="padding: 15px;">
                            <p><strong>ID:</strong> ${gallery.id}</p>
                            <p><strong>圖片數量:</strong> ${gallery.fileCount}</p>
                            <p><strong>角色:</strong> ${Array.isArray(gallery.character) ? gallery.character.join(', ') : gallery.character}</p>
                            <p><strong>標籤:</strong> ${Array.isArray(gallery.tags) ? gallery.tags.join(', ') : gallery.tags || '無'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // 刪除標籤頁
    renderDeleteTab() {
        return `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f59e0b; margin-bottom: 20px;"></i>
                <h3>危險區域</h3>
                <p>在這裡可以批量刪除圖庫。刪除後無法恢復，請謹慎操作。</p>
                
                <div style="margin-top: 30px;">
                    <button class="viewer-btn" onclick="galleryManager.batchDeleteGalleries()" style="background-color: #ef4444;">
                        <i class="fas fa-trash"></i> 批量刪除選中的圖庫
                    </button>
                </div>
                
                <div class="gallery-list-manage" style="margin-top: 30px;">
                    ${this.currentGalleries.map((gallery, index) => `
                        <div class="gallery-item-manage">
                            <div style="padding: 15px; display: flex; align-items: center;">
                                <input type="checkbox" id="delete-${index}" style="margin-right: 10px;">
                                <label for="delete-${index}" style="flex: 1; cursor: pointer;">
                                    <strong>${gallery.name}</strong> (${gallery.fileCount} 張圖片)
                                </label>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // 切換標籤頁
    switchTab(tabName) {
        this.currentTab = tabName;
        this.renderManagementPanel();
    }
    
    // 設置事件監聽器
    setupEventListeners() {
        // 拖放上傳
        const uploadArea = document.getElementById('uploadArea');
        const folderInput = document.getElementById('folderInput');
        
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', async (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                
                const items = e.dataTransfer.items;
                const files = [];
                
                // 處理文件夾
                for (let i = 0; i < items.length; i++) {
                    const entry = items[i].webkitGetAsEntry();
                    if (entry) {
                        await this.traverseFileTree(entry, files);
                    }
                }
                
                this.handleFiles(files);
            });
        }
        
        if (folderInput) {
            folderInput.addEventListener('change', (e) => {
                this.handleFiles(Array.from(e.target.files));
            });
        }
    }
    
    // 遍歷文件樹 (處理文件夾)
    async traverseFileTree(entry, files) {
        if (entry.isFile) {
            return new Promise((resolve) => {
                entry.file((file) => {
                    if (this.isImageFile(file)) {
                        files.push(file);
                    }
                    resolve();
                });
            });
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const entries = await new Promise((resolve) => {
                dirReader.readEntries(resolve);
            });
            
            for (const childEntry of entries) {
                await this.traverseFileTree(childEntry, files);
            }
        }
    }
    
    // 檢查是否為圖片文件
    isImageFile(file) {
        // 1. 檢查 MIME 類型
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        
        // 2. 檢查副檔名（如果 MIME 類型為空）
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
        
        // 如果 MIME 類型符合
        if (imageTypes.includes(file.type)) {
            return true;
        }
        
        // 如果 MIME 類型為空，檢查副檔名
        if (!file.type) {
            const fileName = file.name.toLowerCase();
            return imageExtensions.some(ext => fileName.endsWith(ext));
        }
        
        return false;
    }
    
    // 處理選擇的文件
    handleFiles(files) {
        const imageFiles = files.filter(file => this.isImageFile(file));
        
        if (imageFiles.length === 0) {
            alert('請選擇圖片文件！');
            return;
        }
        
        this.uploadedFiles = imageFiles;
        this.renderManagementPanel();
        
        // 自動生成圖庫名稱
        const nameInput = document.getElementById('galleryName');
        if (nameInput && !nameInput.value) {
            const timestamp = new Date().getTime();
            nameInput.value = `新圖庫-${timestamp}`;
        }
    }
    
    // 移除單個文件
    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        this.renderManagementPanel();
    }
    
    // 清除上傳
    clearUpload() {
        this.uploadedFiles = [];
        this.renderManagementPanel();
    }
    
    // 開始上傳
    async startUpload() {
        const galleryName = document.getElementById('galleryName').value.trim();
        const characterInput = document.getElementById('galleryCharacter').value.trim();
        const tagsInput = document.getElementById('galleryTags').value.trim();
        
        if (!galleryName) {
            alert('請輸入圖庫名稱！');
            return;
        }
        
        if (this.uploadedFiles.length === 0) {
            alert('請選擇圖片文件！');
            return;
        }
        
        // 解析標籤
        const characters = characterInput ? characterInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        
        // 生成唯一 ID
        const newId = `gallery-${Date.now()}`;
        const folderPath = `galleries/${galleryName}`;
        
        // 顯示進度條
        const progressBar = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        if (progressBar) progressBar.style.display = 'block';
        
        try {
            // 1. 授權
            progressText.textContent = '正在連接 Backblaze B2...';
            await this.b2.authorize();
            
            // 2. 上傳所有圖片
            const imageFiles = [];
            let uploadedCount = 0;
            
            for (let i = 0; i < this.uploadedFiles.length; i++) {
                const file = this.uploadedFiles[i];
                const fileName = file.name;
                const b2Path = `${folderPath}/${fileName}`;
                
                // 更新進度
                progressText.textContent = `上傳圖片 (${uploadedCount + 1}/${this.uploadedFiles.length}): ${fileName}`;
                progressFill.style.width = `${((uploadedCount + 1) / this.uploadedFiles.length) * 100}%`;
                
                try {
                    // 上傳到 B2
                    await this.b2.uploadFile(file, b2Path);
                    imageFiles.push(fileName);
                    uploadedCount++;
                    
                } catch (uploadError) {
                    console.error(`上傳失敗 ${fileName}:`, uploadError);
                    // 繼續上傳其他文件
                }
            }
            
            // 3. 讀取現有 galleries.json
            progressText.textContent = '正在更新圖庫數據...';
            let galleries = [];
            try {
                galleries = await this.b2.readGalleries();
            } catch (readError) {
                console.log('創建新的 galleries.json');
                galleries = [];
            }
            
            // 4. 添加新圖庫
            const newGallery = {
                id: newId,
                name: galleryName,
                folderPath: folderPath,
                character: characters,
                tags: tags,
                fileCount: imageFiles.length,
                imageFiles: imageFiles.sort() // 按名稱排序
            };
            
            galleries.push(newGallery);
            
            // 5. 更新 galleries.json
            await this.b2.updateGalleries(galleries);
            
            // 6. 完成
            progressText.textContent = '✅ 上傳完成！';
            progressFill.style.width = '100%';
            
            // 更新本地數據
            this.currentGalleries = galleries;
            
            // 顯示成功訊息
            setTimeout(() => {
                alert(`圖庫 "${galleryName}" 上傳成功！\n共上傳 ${uploadedCount} 張圖片。`);
                
                // 重置
                this.uploadedFiles = [];
                this.switchTab('manage');
                
            }, 1000);
            
        } catch (error) {
            console.error('上傳過程錯誤:', error);
            progressText.textContent = `❌ 上傳失敗: ${error.message}`;
            progressFill.style.backgroundColor = '#ef4444';
            
            alert(`上傳失敗: ${error.message}`);
        }
    }
    
    // 編輯圖庫
    async editGallery(index) {
        const gallery = this.currentGalleries[index];
        
        const newName = prompt('請輸入新的圖庫名稱:', gallery.name);
        if (!newName || newName === gallery.name) return;
        
        const newCharacters = prompt('請輸入角色標籤 (用逗號分隔):', 
            Array.isArray(gallery.character) ? gallery.character.join(', ') : gallery.character || '');
        
        const newTags = prompt('請輸入其他標籤 (用逗號分隔):',
            Array.isArray(gallery.tags) ? gallery.tags.join(', ') : gallery.tags || '');
        
        try {
            // 更新圖庫數據
            gallery.name = newName;
            gallery.folderPath = `galleries/${newName}`;
            
            if (newCharacters !== null) {
                gallery.character = newCharacters ? newCharacters.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            }
            
            if (newTags !== null) {
                gallery.tags = newTags ? newTags.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
            }
            
            // 更新 B2 上的 galleries.json
            await this.b2.updateGalleries(this.currentGalleries);
            
            alert('圖庫更新成功！');
            this.renderManagementPanel();
            
        } catch (error) {
            console.error('更新失敗:', error);
            alert(`更新失敗: ${error.message}`);
        }
    }
    
    // 刪除單個圖庫
    async deleteGallery(index) {
        const gallery = this.currentGalleries[index];
        
        if (!confirm(`確定要刪除圖庫 "${gallery.name}" 嗎？\n這將刪除 ${gallery.fileCount} 張圖片，此操作無法恢復！`)) {
            return;
        }
        
        try {
            // 1. 刪除所有圖片文件
            for (const fileName of gallery.imageFiles) {
                const filePath = `${gallery.folderPath}/${fileName}`;
                try {
                    await this.b2.deleteFile(filePath);
                    console.log(`已刪除: ${filePath}`);
                } catch (deleteError) {
                    console.warn(`刪除失敗 ${filePath}:`, deleteError);
                    // 繼續刪除其他文件
                }
            }
            
            // 2. 從數據中移除
            this.currentGalleries.splice(index, 1);
            
            // 3. 更新 galleries.json
            await this.b2.updateGalleries(this.currentGalleries);
            
            // 4. 刷新界面
            alert('圖庫刪除成功！');
            this.renderManagementPanel();
            
        } catch (error) {
            console.error('刪除失敗:', error);
            alert(`刪除失敗: ${error.message}`);
        }
    }
    
    // 批量刪除圖庫
    async batchDeleteGalleries() {
        const selectedIndices = [];
        const checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            const id = checkbox.id.replace('delete-', '');
            selectedIndices.push(parseInt(id));
        });
        
        if (selectedIndices.length === 0) {
            alert('請選擇要刪除的圖庫！');
            return;
        }
        
        const galleryNames = selectedIndices.map(i => this.currentGalleries[i].name).join('\n');
        
        if (!confirm(`確定要批量刪除以下 ${selectedIndices.length} 個圖庫嗎？\n\n${galleryNames}\n\n此操作無法恢復！`)) {
            return;
        }
        
        try {
            // 按倒序刪除，避免索引問題
            const sortedIndices = selectedIndices.sort((a, b) => b - a);
            
            for (const index of sortedIndices) {
                const gallery = this.currentGalleries[index];
                
                // 刪除圖片文件
                for (const fileName of gallery.imageFiles) {
                    const filePath = `${gallery.folderPath}/${fileName}`;
                    try {
                        await this.b2.deleteFile(filePath);
                    } catch (deleteError) {
                        console.warn(`刪除失敗 ${filePath}:`, deleteError);
                    }
                }
                
                // 從數組中移除
                this.currentGalleries.splice(index, 1);
            }
            
            // 更新 galleries.json
            await this.b2.updateGalleries(this.currentGalleries);
            
            alert(`批量刪除完成！共刪除 ${selectedIndices.length} 個圖庫。`);
            this.renderManagementPanel();
            
        } catch (error) {
            console.error('批量刪除失敗:', error);
            alert(`批量刪除失敗: ${error.message}`);
        }
    }
}

// 創建全局實例
const galleryManager = new GalleryManager();

// 全局函數
function openManagementPage() {
    document.getElementById('managementPanel').style.display = 'block';
    galleryManager.init();
}

function closeManagementPanel() {
    document.getElementById('managementPanel').style.display = 'none';
}