//翻頁速度自訂
const SPEED_LEVELS = [1000, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000]; // 毫秒

// Backblaze B2 配置
const B2_BASE_URL = 'https://f005.backblazeb2.com/file/laserpen-gallery-bucket/';
const USE_B2 = true;

function buildB2Url(...pathSegments) {
    // 過濾掉空值，並移除前後的斜杠
    const cleanSegments = pathSegments
        .filter(segment => segment && segment !== '')
        .map(segment => segment.replace(/^\/+|\/+$/g, ''));
    
    // 確保不會有雙斜杠
    const url = `${B2_BASE_URL}/${cleanSegments.join('/')}`;
    return url.replace(/([^:]\/)\/+/g, '$1'); // 移除多餘的斜杠
}   

const LOCAL_GALLERY_DATA = []

// 全域變數
let galleryDatabase = [];
let activeFilters = { character: [], tags: [] };
let fsAutoPlayInterval = null;
let fsProgressInterval = null;
let autoPlaySpeed = 10000; // 初始10秒
let isFsAutoPlaying = false;
let progressStartTime = 0;

const PLACEHOLDER_COLORS = [
    '#3b82f6', // 藍
    '#8b5cf6', // 紫
    '#10b981', // 綠
    '#f59e0b', // 黃
    '#ef4444', // 紅
    '#ec4899'  // 粉
];

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 隱藏載入動畫
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    
    try {
        console.log('開始初始化...');
        
        // 總是嘗試從 B2 載入數據
        console.log('正在從 B2 載入數據...');
        await loadGalleryData();
        
        // 檢查是否成功載入數據
        if (galleryDatabase.length === 0) {
            console.warn('⚠️ 載入的圖庫數據為空，顯示空狀態');
            renderEmptyState('無法載入圖庫數據，請檢查網絡連接或 B2 設定');
            return;
        }
        
        console.log('成功載入外部 JSON 數據，共', galleryDatabase.length, '個圖庫');
        
        // 為每個圖庫設置封面圖片
        processGalleryCovers();
        console.log('封面圖片處理完成');
        
        // 初始化介面
        updateStats();
        updateTagFilters();
        renderGalleryList(galleryDatabase);
        
        console.log('頁面初始化完成');
        
    } catch (error) {
        console.error('初始化失敗:', error);
        showError('無法載入圖庫數據: ' + error.message);
    }

    // 添加管理按鈕
    const header = document.querySelector('.header');
    if (header) {
        const manageBtn = document.createElement('button');
        manageBtn.className = 'btn-manage';
        manageBtn.innerHTML = '<i class="fas fa-cog"></i> 管理圖庫';
        manageBtn.onclick = openManagementPage;
        
        const headerRight = document.createElement('div');
        headerRight.className = 'header-right';
        headerRight.appendChild(manageBtn);
        
        header.appendChild(headerRight);
    }
    
    // 添加管理面板容器（如果不存在）
    if (!document.getElementById('managementPanel')) {
        const panel = document.createElement('div');
        panel.id = 'managementPanel';
        panel.className = 'management-panel';
        panel.style.display = 'none';
        document.body.appendChild(panel);
    }
});

// 動態載入圖庫數據
async function loadGalleryData() {
    try {
        console.log('正在嘗試從 B2 載入圖庫數據...');
        
        // 總是使用 B2 URL
        const jsonUrl = buildB2Url('galleries.json');
        
        console.log('載入 URL:', jsonUrl);
        const response = await fetch(jsonUrl, {
            cache: 'no-store' // 防止緩存
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('成功獲取 JSON 數據，共', data.length, '個圖庫');
        
        // 處理數據格式
        if (Array.isArray(data)) {
            galleryDatabase = data;
        } else if (typeof data === 'object' && data !== null) {
            // 如果是對象，轉換為數組
            galleryDatabase = Object.values(data);
        } else {
            throw new Error('數據格式不正確');
        }
        
        console.log(`成功載入 ${galleryDatabase.length} 個圖庫`);
        
        // 確保每個圖庫都有必要的欄位
        galleryDatabase.forEach((gallery, index) => {
            if (!gallery.id) gallery.id = `gallery-${index + 1}`;
            if (!gallery.folderPath && gallery.name) {
                gallery.folderPath = `galleries/${gallery.name}`;
            }
            if (!gallery.imageFiles || !Array.isArray(gallery.imageFiles)) {
                gallery.imageFiles = [];
            }
            if (!gallery.fileCount && gallery.imageFiles) {
                gallery.fileCount = gallery.imageFiles.length;
            }
        });
        
    } catch (error) {
        console.error('載入 JSON 失敗:', error);
        // 不再使用本地備份，直接拋出錯誤
        throw error;
    }
}

// 為每個圖庫設置封面圖片 - 使用實際的圖片檔案
function processGalleryCovers() {
    for (const gallery of galleryDatabase) {
        // 設置顏色和縮寫
        gallery.color = getGalleryColor(gallery.id);
        gallery.initials = getGalleryInitials(gallery.name);
        
        // 如果有 imageFiles，使用第一張圖片作為封面
        if (gallery.imageFiles && gallery.imageFiles.length > 0) {
            const firstImage = gallery.imageFiles[0];
            
            // 修正：使用 buildB2Url 函數
            if (gallery.folderPath) {
                const basePath = gallery.folderPath.replace(/^\/+|\/+$/g, '');
                
                if (USE_B2) {
                    gallery.coverImage = buildB2Url(basePath, firstImage);
                    gallery.fullImagePaths = gallery.imageFiles.map(file => 
                        buildB2Url(basePath, file)
                    );
                } else {
                    gallery.coverImage = `${basePath}/${firstImage}`;
                    gallery.fullImagePaths = gallery.imageFiles.map(file => 
                        `${basePath}/${file}`
                    );
                }
                
                console.log(`圖庫 ${gallery.name}: 封面圖片 = ${gallery.coverImage}`);
            }
        }
    }
}

// 根據 ID 獲取顏色
function getGalleryColor(galleryId) {
    const idNum = parseInt(galleryId.replace('gallery-', '')) || 0;
    return PLACEHOLDER_COLORS[idNum % PLACEHOLDER_COLORS.length];
}

// 獲取圖庫名稱的縮寫（用於佔位圖）
function getGalleryInitials(name) {
    if (!name) return '?';
    
    // 取前2-3個字符
    if (name.length <= 3) return name;
    
    // 如果是中文，取前2個字符
    const isChinese = /[\u4e00-\u9fff]/.test(name);
    if (isChinese) {
        return name.substring(0, 2);
    }
    
    // 如果是英文或混合，取單詞首字母
    const words = name.split(/[-_\s]+/);
    if (words.length >= 2) {
        return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    
    return name.substring(0, 2).toUpperCase();
}

// 修改 createPlaceholderSVG 函數
function createPlaceholderSVG(gallery, index = 1) {
    const svgContent = `<svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="150" fill="${gallery.color || '#3b82f6'}"/>
        <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em">
            ${gallery.initials || '圖'}
        </text>
    </svg>`;
    
    // 使用 encodeURIComponent 處理非拉丁字符
    const encodedSVG = encodeURIComponent(svgContent);
    return `data:image/svg+xml;charset=utf-8,${encodedSVG}`;
}

// 渲染空狀態
function renderEmptyState(message = '無法載入圖庫數據') {
    const container = document.getElementById('galleryView');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>
            <h3>錯誤</h3>
            <p>${message}</p>
            <div style="margin-top: 20px;">
                <p>請確認：</p>
                <ol style="text-align: left; margin: 10px auto; max-width: 300px;">
                    <li>galleries.json 檔案是否存在</li>
                    <li>JSON 格式是否正確</li>
                    <li>圖片檔案是否在正確位置</li>
                </ol>
            </div>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px;">
                <i class="fas fa-redo"></i> 重新載入
            </button>
        </div>
    `;
}

// 更新統計資訊
function updateStats() {
    const totalGalleries = document.getElementById('totalGalleries');
    const totalImages = document.getElementById('totalImages');
    
    if (totalGalleries) {
        totalGalleries.textContent = galleryDatabase.length;
    }
    
    if (totalImages) {
        const total = galleryDatabase.reduce((sum, gallery) => sum + (gallery.fileCount || 0), 0);
        totalImages.textContent = total;
    }
}

// 更新標籤篩選器
function updateTagFilters() {
    // 收集所有角色標籤
    const allCharacters = new Set();
    galleryDatabase.forEach(gallery => {
        if (Array.isArray(gallery.character)) {
            gallery.character.forEach(char => allCharacters.add(char));
        } else if (gallery.character) {
            allCharacters.add(gallery.character);
        }
    });
    
    // 收集所有標籤
    const allTags = new Set();
    galleryDatabase.forEach(gallery => {
        if (Array.isArray(gallery.tags)) {
            gallery.tags.forEach(tag => allTags.add(tag));
        }
    });
    
    // 更新角色標籤
    updateTagFilterSection('character-tags', allCharacters, 'character');
    
    // 更新其他標籤
    updateTagFilterSection('custom-tags', allTags, 'tags');
}

// 更新標籤篩選器部分
function updateTagFilterSection(containerId, tagSet, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    // 按字母順序排序
    const sortedTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-TW'));
    
    sortedTags.forEach(tagText => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag';
        if (activeFilters[type]?.includes(tagText)) {
            tagElement.classList.add('selected');
        }
        tagElement.textContent = tagText;
        tagElement.dataset.type = type;
        tagElement.dataset.value = tagText;
        
        tagElement.addEventListener('click', function() {
            this.classList.toggle('selected');
            updateActiveFilters();
            filterGalleries();
        });
        
        container.appendChild(tagElement);
    });
}

// 更新活動篩選器
function updateActiveFilters() {
    activeFilters = { character: [], tags: [] };
    
    document.querySelectorAll('.tag.selected').forEach(tag => {
        const type = tag.dataset.type;
        const value = tag.dataset.value;
        if (type && value && activeFilters[type]) {
            activeFilters[type].push(value);
        }
    });
}

// 篩選圖庫
function filterGalleries() {
    if (!galleryDatabase.length) {
        renderEmptyState('沒有可顯示的圖庫');
        return;
    }
    
    let filtered = [...galleryDatabase];
    
    // 應用角色篩選
    if (activeFilters.character.length > 0) {
        filtered = filtered.filter(gallery => {
            const galleryChars = Array.isArray(gallery.character) ? gallery.character : [gallery.character];
            return activeFilters.character.some(filterChar => 
                galleryChars.includes(filterChar)
            );
        });
    }
    
    // 應用標籤篩選
    if (activeFilters.tags.length > 0) {
        filtered = filtered.filter(gallery => {
            const galleryTags = Array.isArray(gallery.tags) ? gallery.tags : [];
            return activeFilters.tags.some(filterTag => 
                galleryTags.includes(filterTag)
            );
        });
    }
    
    renderGalleryList(filtered);
}

// 渲染圖庫列表
function renderGalleryList(galleries) {
    const container = document.getElementById('galleryView');
    if (!container) return;
    
    if (galleries.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-images"></i>
                <h3>沒有找到圖庫</h3>
                <p>請嘗試選擇其他標籤或清除篩選條件</p>
                <button class="btn-clear" onclick="clearAllFilters()" style="margin-top: 20px;">
                    <i class="fas fa-times"></i> 清除篩選
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = galleries.map(gallery => `
        <div class="gallery-card" data-id="${gallery.id}" onclick="openGalleryViewer('${gallery.id}')">
            <div class="gallery-cover-container">
                <!-- 真實圖片，加載失敗時顯示佔位圖 -->
                <img src="${gallery.coverImage}" alt="${gallery.name}" class="gallery-cover" 
                     onerror="handleCoverImageError(this, '${gallery.id}')"
                     loading="lazy">
                
                <!-- CSS 佔位圖（默認隱藏） -->
                <div class="placeholder-cover" style="background-color: ${gallery.color}; display: none;">
                    <div class="placeholder-text">${gallery.initials}</div>
                </div>
            </div>
            
            <div class="gallery-info">
                <div class="gallery-title">
                    <span>${gallery.name}</span>
                    <span class="file-count">${gallery.fileCount || 0} 張</span>
                </div>
                
                <div class="gallery-tags">
                    ${(Array.isArray(gallery.character) ? gallery.character : [gallery.character])
                        .filter(char => char)
                        .map(char => `
                            <span class="tag" data-type="character">${char}</span>
                        `).join('')}
                    ${(Array.isArray(gallery.tags) ? gallery.tags : [])
                        .filter(tag => tag)
                        .map(tag => `
                            <span class="tag">${tag}</span>
                        `).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

// 處理封面圖片加載錯誤
window.handleCoverImageError = function(imgElement, galleryId) {
    console.error(`圖片加載失敗: ${imgElement.src}`);
    
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;
    
    // 如果圖片加載失敗，直接顯示佔位圖
    imgElement.style.display = 'none';
    const placeholder = imgElement.nextElementSibling;
    if (placeholder) {
        placeholder.style.display = 'flex';
    }
    
    // 註釋掉自動重試的邏輯，避免循環
    // 因為中文編碼問題可能需要伺服器端配置
};

// 錯誤處理
function showError(message) {
    const container = document.getElementById('galleryView');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>
            <h3>無法載入圖庫數據</h3>
            <p>${message}</p>
            <div style="margin-top: 20px;">
                <p>可能的原因：</p>
                <ol style="text-align: left; margin: 10px auto; max-width: 400px;">
                    <li>Backblaze B2 連接問題</li>
                    <li>galleries.json 檔案不存在或格式錯誤</li>
                    <li>網絡連接問題</li>
                </ol>
            </div>
            <div style="margin-top: 20px;">
                <button onclick="location.reload()" style="margin: 5px; padding: 10px 20px;">
                    <i class="fas fa-redo"></i> 重新載入
                </button>
                <button onclick="testB2Connection()" style="margin: 5px; padding: 10px 20px;">
                    <i class="fas fa-wifi"></i> 測試 B2 連接
                </button>
            </div>
        </div>
    `;
}

window.testB2Connection = function() {
    const testUrl = buildB2Url('galleries.json');
    alert(`正在測試連接：\n${testUrl}\n\n請查看瀏覽器控制台結果。`);
    
    fetch(testUrl)
        .then(response => {
            if (response.ok) {
                console.log('✅ B2 連接正常！');
                alert('✅ B2 連接正常！請重新載入頁面。');
                location.reload();
            } else {
                console.log(`❌ B2 連接失敗：HTTP ${response.status}`);
                alert(`❌ B2 連接失敗：HTTP ${response.status}`);
            }
        })
        .catch(error => {
            console.error('❌ B2 連接錯誤：', error);
            alert(`❌ B2 連接錯誤：${error.message}`);
        });
};

// 清除所有篩選
window.clearAllFilters = function() {
    activeFilters = { character: [], tags: [] };
    document.querySelectorAll('.tag.selected').forEach(tag => {
        tag.classList.remove('selected');
    });
    renderGalleryList(galleryDatabase);
};

window.openGalleryViewer = function(galleryId) {
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;
    
    // 創建瀏覽器彈窗
    const viewer = document.createElement('div');
    viewer.className = 'gallery-viewer';
    viewer.innerHTML = `
    <div class="viewer-overlay" onclick="closeGalleryViewer()"></div>
    <div class="viewer-content">
        <div class="viewer-header">
            <h2>${gallery.name}</h2>
            <button class="viewer-close" onclick="closeGalleryViewer()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        
        <div class="viewer-info">
            <div class="info-stats">
                <span><i class="fas fa-image"></i> ${gallery.fileCount} 張圖片</span>
                <span><i class="fas fa-user"></i> ${Array.isArray(gallery.character) ? gallery.character.join(', ') : gallery.character}</span>
            </div>
            <div class="info-tags">
                ${(Array.isArray(gallery.tags) ? gallery.tags : [])
                    .map(tag => `<span class="viewer-tag">${tag}</span>`)
                    .join('')}
            </div>
        </div>
        
        <div class="image-grid" id="imageGrid-${gallery.id}">
            <div class="loading-images">
                <i class="fas fa-spinner fa-spin"></i> 載入圖片中...
            </div>
        </div>
        
        <div class="viewer-controls">
        <div class="control-group">
            <button class="viewer-btn" onclick="prevImage()">
                <i class="fas fa-chevron-left"></i> 上一張
            </button>
            <span class="image-counter">
                <span id="currentImage">1</span> / <span id="totalImages">${gallery.fileCount}</span>
            </span>
            <button class="viewer-btn" onclick="nextImage()">
                下一張 <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    </div>
    </div>
    
    <!-- 全屏圖片查看器 -->
    <div class="fullscreen-viewer" id="fullscreenViewer" style="display: none;">
        <div class="fs-header">
            <span id="fsImageTitle">圖片標題</span>
            <div class="fs-auto-controls">
                <button class="fs-auto-btn" onclick="fsChangeSpeed(-1)" title="減速">
                    <i class="fas fa-minus"></i>
                </button>
                <button class="fs-auto-btn" id="fsToggleAutoPlay" onclick="fsToggleAutoPlay()" title="暫停/開始">
                    <i class="fas fa-play" id="fsAutoPlayIcon"></i>
                </button>
                <button class="fs-auto-btn" onclick="fsChangeSpeed(1)" title="加速">
                    <i class="fas fa-plus"></i>
                </button>
                <span class="fs-speed-indicator" id="fsSpeedIndicator">3秒</span>
            </div>
            <button class="fs-close" onclick="closeFullscreen()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="fs-image-container">
            <img id="fsImage" src="" alt="">
            <button class="fs-nav fs-prev" onclick="fsPrevImage()">
                <i class="fas fa-chevron-left"></i>
            </button>
            <button class="fs-nav fs-next" onclick="fsNextImage()">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        <div class="fs-info">
            <span id="fsImageIndex">1 / ${gallery.fileCount}</span>
        </div>
    </div>
`;
    
    document.body.appendChild(viewer);
    
    // 載入圖片
    loadGalleryImages(gallery);
    
    // 設置當前圖庫
    window.currentGallery = gallery;
    window.currentImageIndex = 0;
    window.galleryImages = gallery.fullImagePaths || [];
};

// 載入圖庫中的圖片 - 使用實際的圖片檔案
async function loadGalleryImages(gallery) {
    const imageGrid = document.getElementById(`imageGrid-${gallery.id}`);
    if (!imageGrid) return;
    
    // 清空載入動畫
    imageGrid.innerHTML = '';
    
    try {
        // 使用實際的圖片檔案
        const imageFiles = gallery.fullImagePaths || [];
        
        if (imageFiles.length === 0) {
            // 如果沒有圖片，顯示佔位圖
            for (let i = 1; i <= gallery.fileCount; i++) {
                const placeholder = document.createElement('div');
                placeholder.className = 'grid-image-item placeholder';
                placeholder.innerHTML = `
                    <div class="placeholder-box" style="background-color: ${gallery.color}">
                        <div class="placeholder-text-small">${i}</div>
                    </div>
                `;
                imageGrid.appendChild(placeholder);
            }
            return;
        }
        
        // 顯示所有圖片
        imageFiles.forEach((imagePath, index) => {
            const imgItem = document.createElement('div');
            imgItem.className = 'grid-image-item';
            imgItem.innerHTML = `
                <img src="${imagePath}" 
                     alt="${gallery.name} - ${index + 1}" 
                     onclick="openImageFullscreen('${gallery.id}', ${index})"
                     loading="lazy"
                     onerror="handleGridImageError(this, '${gallery.id}', ${index})">
            `;
            imageGrid.appendChild(imgItem);
        });
        
    } catch (error) {
        console.error('載入圖片失敗:', error);
        imageGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <i class="fas fa-exclamation-circle"></i>
                <p>無法載入圖片</p>
            </div>
        `;
    }
}

// 處理網格圖片加載錯誤
window.handleGridImageError = function(imgElement, galleryId, index) {
    console.error(`網格圖片加載失敗: ${imgElement.src}`);
    
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;
    
    // 如果是 B2 圖片失敗，嘗試重新構建 URL
    if (USE_B2 && imgElement.src.includes(B2_BASE_URL)) {
        const filename = imgElement.src.split('/').pop();
        const correctPath = `${B2_BASE_URL}/${gallery.folderPath}/${filename}`;
        console.log(`嘗試重新加載網格圖片: ${correctPath}`);
        imgElement.src = correctPath;
        return;
    }
    
    // 如果還是失敗，創建佔位圖
    const placeholder = createPlaceholderSVG(gallery, index + 1);
    imgElement.src = placeholder;
    imgElement.onerror = null; // 防止無限循環
};

// 打開圖片全屏瀏覽
window.openImageFullscreen = function(galleryId, imageIndex) {
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;
    
    // 使用實際的圖片路徑
    const images = gallery.fullImagePaths || [];
    
    window.fullscreenImages = images;
    window.currentFsIndex = imageIndex;
    window.currentGalleryId = galleryId;
    
    // 顯示全屏瀏覽器
    const fsViewer = document.getElementById('fullscreenViewer');
    if (fsViewer) {
        // 更新 HTML 結構，添加進度條
        fsViewer.innerHTML = `
        <div class="fs-progress-container">
            ${images.map((_, idx) => `
                <div class="fs-progress-bar" id="progressBar-${idx}">
                    <div class="fs-progress-fill" id="progressFill-${idx}"></div>
                </div>
            `).join('')}
        </div>
        <div class="fs-header">
            <button class="fs-close" onclick="closeFullscreen()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="fs-image-container">
            <img id="fsImage" src="" alt="">
            <div class="fs-controls-overlay">
                <button class="fs-control-btn fs-prev-btn" onclick="fsPrevImage()" title="上一張">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <button class="fs-control-btn fs-next-btn" onclick="fsNextImage()" title="下一張">
                    <i class="fas fa-chevron-right"></i>
                </button>
                <div class="fs-auto-controls">
                    <!-- 減號按鈕：減速 -->
                    <button class="fs-auto-btn" onclick="fsChangeSpeed(-1)" title="減慢速度">
                        <i class="fas fa-minus"></i>
                    </button>
                    <!-- 播放按鈕：預設顯示播放圖標（▶️） -->
                    <button class="fs-auto-btn" id="fsToggleAutoPlay" onclick="fsToggleAutoPlay()" title="開始自動播放">
                        <i class="fas fa-play" id="fsAutoPlayIcon"></i>
                    </button>
                    <!-- 加號按鈕：加速 -->
                    <button class="fs-auto-btn" onclick="fsChangeSpeed(1)" title="加快速度">
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
            </div>
        </div>
        <div class="fs-info">
            <span id="fsImageIndex">${imageIndex + 1} / ${images.length}</span>
            <span class="fs-speed-info" id="fsSpeedInfo">3秒/張</span>
        </div>
    `;
        
        fsViewer.style.display = 'block';
        updateFullscreenImage();
        
        // 初始化自動播放
        setTimeout(() => {
            console.log('調用 initSpeedControls');
            initSpeedControls();
            updateFsSpeedDisplay();
        }, 100);
        
        console.log('自動播放預設關閉');
        updateFsSpeedDisplay();
        
        // 初始化進度條
        updateProgressBars();
    }
};

// 更新全屏圖片
function updateFullscreenImage() {
    if (!window.fullscreenImages || window.currentFsIndex === undefined) return;
    
    const fsImage = document.getElementById('fsImage');
    const fsImageTitle = document.getElementById('fsImageTitle');
    const fsImageIndex = document.getElementById('fsImageIndex');
    const gallery = galleryDatabase.find(g => g.id === window.currentGalleryId);
    
    if (fsImage && window.fullscreenImages[window.currentFsIndex]) {
        fsImage.src = window.fullscreenImages[window.currentFsIndex];
        fsImageTitle.textContent = `${gallery?.name || ''} - 圖片 ${window.currentFsIndex + 1}`;
        fsImageIndex.textContent = `${window.currentFsIndex + 1} / ${window.fullscreenImages.length}`;
        
        // 如果圖片加載失敗，使用佔位圖
        fsImage.onerror = function() {
            const placeholder = createPlaceholderSVG(gallery || {}, window.currentFsIndex + 1);
            this.src = placeholder;
            this.onerror = null;
        };
    }
}

// 全屏瀏覽器控制
window.fsPrevImage = function() {
    if (window.currentFsIndex > 0) {
        window.currentFsIndex--;
        updateFullscreenImage();
    }
};

window.fsNextImage = function() {
    if (window.fullscreenImages && window.currentFsIndex < window.fullscreenImages.length - 1) {
        window.currentFsIndex++;
        updateFullscreenImage();
    }
};

window.closeFullscreen = function() {
    const fsViewer = document.getElementById('fullscreenViewer');
    if (fsViewer) {
        fsViewer.style.display = 'none';
    }
};

// 關閉圖庫瀏覽器
window.closeGalleryViewer = function() {
    const viewer = document.querySelector('.gallery-viewer');
    if (viewer) {
        viewer.remove();
    }
    
    // 也關閉全屏瀏覽器
    closeFullscreen();
};

// 圖片導航
window.prevImage = function() {
    if (window.currentImageIndex > 0) {
        window.currentImageIndex--;
        updateImageCounter();
    }
};

window.nextImage = function() {
    if (window.currentGallery && window.currentImageIndex < window.currentGallery.fileCount - 1) {
        window.currentImageIndex++;
        updateImageCounter();
    }
};

function updateImageCounter() {
    const currentImage = document.getElementById('currentImage');
    if (currentImage) {
        currentImage.textContent = window.currentImageIndex + 1;
    }
}

// 點擊圖庫卡片
document.addEventListener('click', function(e) {
    const galleryCard = e.target.closest('.gallery-card');
    if (galleryCard) {
        const galleryId = galleryCard.dataset.id;
        const gallery = galleryDatabase.find(g => g.id === galleryId);
        if (gallery) {
            console.log('點擊圖庫:', gallery.name);
        }
    }
});

// 自動播放相關函數

// 切換自動播放狀態（圖庫瀏覽器）
window.toggleAutoPlay = function() {
    isAutoPlaying = !isAutoPlaying;
    const toggleBtn = document.getElementById('toggleAutoPlay');
    const icon = document.getElementById('autoPlayIcon');
    const text = document.getElementById('autoPlayText');
    
    if (isAutoPlaying) {
        icon.className = 'fas fa-pause';
        text.textContent = '暫停';
        startAutoPlay();
    } else {
        icon.className = 'fas fa-play';
        text.textContent = '開始';
        stopAutoPlay();
    }
};

// 開始自動播放
function startAutoPlay() {
    stopAutoPlay(); // 確保先停止之前的計時器
    
    autoPlayInterval = setInterval(() => {
        nextImage();
    }, autoPlaySpeed);
}

// 停止自動播放
function stopAutoPlay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
}

// 改變播放速度
window.changeAutoPlaySpeed = function(direction) {
    // 速度級別（毫秒）
    const speedLevels = [5000, 4000, 3000, 2000, 1000, 500];
    let currentIndex = speedLevels.indexOf(autoPlaySpeed);
    
    if (currentIndex === -1) {
        // 如果當前速度不在列表中，找到最接近的
        currentIndex = speedLevels.findIndex(speed => speed <= autoPlaySpeed);
        if (currentIndex === -1) currentIndex = speedLevels.length - 1;
    }
    
    // 調整速度
    if (direction === 1 && currentIndex > 0) {
        // 加速（減少間隔時間）
        currentIndex--;
    } else if (direction === -1 && currentIndex < speedLevels.length - 1) {
        // 減速（增加間隔時間）
        currentIndex++;
    }
    
    autoPlaySpeed = speedLevels[currentIndex];
    
    // 更新顯示
    updateSpeedDisplay();
    
    // 如果正在播放，重啟計時器
    if (isAutoPlaying) {
        startAutoPlay();
    }
};

// 更新速度顯示
function updateSpeedDisplay() {
    const indicator = document.getElementById('speedIndicator');
    const fsIndicator = document.getElementById('fsSpeedIndicator');
    
    // 轉換為秒
    const seconds = autoPlaySpeed / 1000;
    const displayText = `${seconds}秒`;
    
    if (indicator) indicator.textContent = displayText;
    if (fsIndicator) fsIndicator.textContent = displayText;
}

// 全屏模式的自動播放函數

// 切換全屏自動播放
window.fsToggleAutoPlay = function() {
    isFsAutoPlaying = !isFsAutoPlaying;
    const toggleBtn = document.getElementById('fsToggleAutoPlay');
    const icon = document.getElementById('fsAutoPlayIcon');
    
    if (isFsAutoPlaying) {
        icon.className = 'fas fa-pause';
        startFsAutoPlay();
    } else {
        icon.className = 'fas fa-play';
        stopFsAutoPlay();
    }
};

// 開始全屏自動播放
function startFsAutoPlay() {
    stopFsAutoPlay(); // 確保先停止之前的計時器
    
    autoPlayInterval = setInterval(() => {
        fsNextImage();
    }, autoPlaySpeed);
}

// 停止全屏自動播放
function stopFsAutoPlay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
}


// 修改圖片導航函數，確保在自動播放時循環
window.nextImage = function() {
    if (window.currentGallery) {
        if (window.currentImageIndex < window.currentGallery.fileCount - 1) {
            window.currentImageIndex++;
        } else {
            // 如果是最後一張，回到第一張
            window.currentImageIndex = 0;
        }
        updateImageCounter();
    }
};

window.fsNextImage = function() {
    if (window.fullscreenImages && window.currentFsIndex < window.fullscreenImages.length - 1) {
        window.currentFsIndex++;
    } else {
        // 如果是最後一張，回到第一張
        window.currentFsIndex = 0;
    }
    updateFullscreenImage();
};

// 修改關閉函數，確保停止計時器
window.closeGalleryViewer = function() {
    const viewer = document.querySelector('.gallery-viewer');
    if (viewer) {
        viewer.remove();
    }
    
    // 停止自動播放
    stopAutoPlay();
    stopFsAutoPlay();
    isAutoPlaying = false;
    isFsAutoPlaying = false;
    
    // 也關閉全屏瀏覽器
    closeFullscreen();
};

window.closeFullscreen = function() {
    const fsViewer = document.getElementById('fullscreenViewer');
    if (fsViewer) {
        fsViewer.style.display = 'none';
    }
    
    // 停止自動播放
    stopFsAutoPlay();
    isFsAutoPlaying = false;
};

// 在頁面卸載時停止計時器
window.addEventListener('beforeunload', function() {
    stopAutoPlay();
    stopFsAutoPlay();
});

// 開始全屏自動播放（帶進度條）
function startFsAutoPlay() {
    stopFsAutoPlay(); // 確保先停止之前的計時器
    stopProgressAnimation(); // 停止進度條動畫
    
    // 更新按鈕狀態
    const icon = document.getElementById('fsAutoPlayIcon');
    if (icon) icon.className = 'fas fa-pause';
    
    isFsAutoPlaying = true;
    
    // 啟動進度條動畫
    startProgressAnimation();
    
    // 設置切換到下一張圖片的計時器
    fsAutoPlayInterval = setTimeout(() => {
        fsNextImage();
    }, autoPlaySpeed);
}

// 停止全屏自動播放
function stopFsAutoPlay() {
    if (fsAutoPlayInterval) {
        clearTimeout(fsAutoPlayInterval);
        fsAutoPlayInterval = null;
    }
    stopProgressAnimation();
    
    const icon = document.getElementById('fsAutoPlayIcon');
    if (icon) icon.className = 'fas fa-play';
    
    isFsAutoPlaying = false;
}

// 切換全屏自動播放
window.fsToggleAutoPlay = function() {
    if (isFsAutoPlaying) {
        stopFsAutoPlay();
    } else {
        startFsAutoPlay();
    }
};

// 開始進度條動畫
function startProgressAnimation() {
    stopProgressAnimation(); // 確保先停止之前的動畫
    
    progressStartTime = Date.now();
    
    fsProgressInterval = requestAnimationFrame(animateProgressBar);
}

// 停止進度條動畫
function stopProgressAnimation() {
    if (fsProgressInterval) {
        cancelAnimationFrame(fsProgressInterval);
        fsProgressInterval = null;
    }
}

// 動畫進度條
function animateProgressBar() {
    if (!isFsAutoPlaying) return;
    
    const elapsed = Date.now() - progressStartTime;
    const progress = Math.min(elapsed / autoPlaySpeed, 1);
    
    const progressFill = document.getElementById(`progressFill-${window.currentFsIndex}`);
    if (progressFill) {
        progressFill.style.width = `${progress * 100}%`;
    }
    
    if (progress < 1) {
        fsProgressInterval = requestAnimationFrame(animateProgressBar);
    }
}

// 更新所有進度條狀態
function updateProgressBars() {
    const totalBars = window.fullscreenImages ? window.fullscreenImages.length : 0;
    
    for (let i = 0; i < totalBars; i++) {
        const progressFill = document.getElementById(`progressFill-${i}`);
        if (progressFill) {
            if (i < window.currentFsIndex) {
                // 已播放過的：完全填滿
                progressFill.style.width = '100%';
                progressFill.style.backgroundColor = '#ffffff';
            } else if (i === window.currentFsIndex) {
                // 當前播放的：開始動畫
                progressFill.style.width = '0%';
                progressFill.style.backgroundColor = '#ffffff';
            } else {
                // 尚未播放的：空白
                progressFill.style.width = '0%';
                progressFill.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }
        }
    }
}

// 改變播放速度
// 修改 fsChangeSpeed 函數
window.fsChangeSpeed = function(direction) {
    console.log('fsChangeSpeed 被調用, direction:', direction);
    
    // 修正：速度數組應該從快到慢排列，這樣索引越小速度越快
    const speedLevels = SPEED_LEVELS;
    console.log('當前速度:', autoPlaySpeed, 'ms');
    
    // 找到當前速度在列表中的位置
    let currentIndex = speedLevels.indexOf(autoPlaySpeed);
    
    if (currentIndex === -1) {
        // 如果當前速度不在列表中，找到最接近的
        for (let i = 0; i < speedLevels.length; i++) {
            if (speedLevels[i] <= autoPlaySpeed) {
                currentIndex = i;
                break;
            }
        }
        if (currentIndex === -1) currentIndex = speedLevels.length - 1;
    }
    
    console.log('當前速度索引:', currentIndex, '對應速度:', speedLevels[currentIndex]);
    
    // 方向邏輯（修正後）：
    // 數組現在是從快到慢：索引0最快(500ms)，索引5最慢(5000ms)
    // direction = 1（加號）應該加速 -> 索引變小（更快）
    // direction = -1（減號）應該減速 -> 索引變大（更慢）
    if (direction === 1) { // 點擊加號，要加速
        if (currentIndex > 0) {
            currentIndex--; // 移到更小的索引（更快）
            console.log('加速: 索引從', currentIndex + 1, '->', currentIndex);
        } else {
            console.log('已經是最快速度');
        }
    } else if (direction === -1) { // 點擊減號，要減速
        if (currentIndex < speedLevels.length - 1) {
            currentIndex++; // 移到更大的索引（更慢）
            console.log('減速: 索引從', currentIndex - 1, '->', currentIndex);
        } else {
            console.log('已經是最慢速度');
        }
    }
    
    // 更新速度
    const oldSpeed = autoPlaySpeed;
    autoPlaySpeed = speedLevels[currentIndex];
    
    const isAccelerating = direction === 1;
    console.log(`速度變更: ${oldSpeed}ms -> ${autoPlaySpeed}ms (${isAccelerating ? '加速' : '減速'})`);
    console.log('新的速度:', (autoPlaySpeed / 1000) + '秒/張');
    
    // 更新顯示
    updateFsSpeedDisplay();
    
    // 如果正在自動播放，重新開始
    if (isFsAutoPlaying) {
        console.log('重新啟動自動播放');
        startFsAutoPlay();
    }
};

// 確保 updateFsSpeedDisplay 函數正確更新顯示
function updateFsSpeedDisplay() {
    const speedInfo = document.getElementById('fsSpeedInfo');
    if (speedInfo) {
        const seconds = autoPlaySpeed / 1000;
        speedInfo.textContent = `${seconds}秒/張`;
        console.log('更新速度顯示:', speedInfo.textContent);
    }
    
    // 同時更新可能存在的其他速度指示器
    const fsSpeedIndicator = document.getElementById('fsSpeedIndicator');
    if (fsSpeedIndicator) {
        const seconds = autoPlaySpeed / 1000;
        fsSpeedIndicator.textContent = `${seconds}秒`;
    }
}

// 修改 initSpeedControls 函數，確保按鈕正確綁定
function initSpeedControls() {
    console.log('初始化速度控制');
    
    // 初始化速度顯示
    updateFsSpeedDisplay();
    
    // 移除舊的事件監聽器
    document.querySelectorAll('.fs-auto-btn').forEach(btn => {
        btn.onclick = null;
    });
    
    // 重新綁定按鈕事件
    document.querySelectorAll('.fs-auto-btn').forEach(btn => {
        if (btn.querySelector('.fa-plus')) {
            btn.onclick = function(e) {
                console.log('加號按鈕被點擊');
                fsChangeSpeed(1);
                e.stopPropagation();
            };
        } else if (btn.querySelector('.fa-minus')) {
            btn.onclick = function(e) {
                console.log('減號按鈕被點擊');
                fsChangeSpeed(-1);
                e.stopPropagation();
            };
        }
    });
    
    // 綁定自動播放切換按鈕
    const toggleBtn = document.getElementById('fsToggleAutoPlay');
    if (toggleBtn) {
        console.log('找到自動播放切換按鈕');
        toggleBtn.onclick = function(e) {
            console.log('自動播放切換按鈕被點擊');
            fsToggleAutoPlay();
            e.stopPropagation();
        };
    }
    
    console.log('速度控制初始化完成');
}

// 更新速度顯示（改進版本）
function updateFsSpeedDisplay() {
    const speedInfo = document.getElementById('fsSpeedInfo');
    if (speedInfo) {
        const seconds = autoPlaySpeed / 1000;
        speedInfo.textContent = `${seconds}秒/張`;
        speedInfo.title = `切換圖片間隔: ${seconds}秒`;
    }
    
    // 同時更新可能存在的其他速度指示器
    const fsSpeedIndicator = document.getElementById('fsSpeedIndicator');
    if (fsSpeedIndicator) {
        const seconds = autoPlaySpeed / 1000;
        fsSpeedIndicator.textContent = `${seconds}秒`;
    }
};

// 為了更好地調試，添加一個初始化函數
function initSpeedControls() {
    // 初始化速度顯示
    updateFsSpeedDisplay();
    
    // 綁定按鈕事件（確保正確綁定）
    document.querySelectorAll('.fs-auto-btn').forEach(btn => {
        btn.onclick = function(e) {
            const direction = this.querySelector('.fa-plus') ? 1 : -1;
            fsChangeSpeed(direction);
            e.stopPropagation();
        };
    });
    
    // 綁定自動播放切換按鈕
    const toggleBtn = document.getElementById('fsToggleAutoPlay');
    if (toggleBtn) {
        toggleBtn.onclick = fsToggleAutoPlay;
    }
}


// 修改 fsNextImage 和 fsPrevImage 函數
window.fsNextImage = function() {
    if (!window.fullscreenImages || window.fullscreenImages.length === 0) return;
    
    if (window.currentFsIndex < window.fullscreenImages.length - 1) {
        window.currentFsIndex++;
    } else {
        // 如果是最後一張，回到第一張
        window.currentFsIndex = 0;
    }
    
    updateFullscreenImage();
    
    // 更新進度條
    updateProgressBars();
    
    // 如果正在自動播放，重新開始計時器
    if (isFsAutoPlaying) {
        startFsAutoPlay();
    }
};

window.fsPrevImage = function() {
    if (!window.fullscreenImages || window.fullscreenImages.length === 0) return;
    
    if (window.currentFsIndex > 0) {
        window.currentFsIndex--;
    } else {
        // 如果是第一張，跳到最後一張
        window.currentFsIndex = window.fullscreenImages.length - 1;
    }
    
    updateFullscreenImage();
    
    // 更新進度條
    updateProgressBars();
    
    // 如果正在自動播放，重新開始計時器
    if (isFsAutoPlaying) {
        startFsAutoPlay();
    }
};

// 修改 updateFullscreenImage 函數
function updateFullscreenImage() {
    if (!window.fullscreenImages || window.currentFsIndex === undefined || window.currentFsIndex < 0) return;
    
    const fsImage = document.getElementById('fsImage');
    const fsImageIndex = document.getElementById('fsImageIndex');
    const gallery = galleryDatabase.find(g => g.id === window.currentGalleryId);
    
    if (fsImage && window.fullscreenImages[window.currentFsIndex]) {
        fsImage.src = window.fullscreenImages[window.currentFsIndex];
        fsImageIndex.textContent = `${window.currentFsIndex + 1} / ${window.fullscreenImages.length}`;
        
        // 更新速度顯示
        updateFsSpeedDisplay();
        
        // 如果圖片加載失敗，使用佔位圖
        fsImage.onerror = function() {
            const placeholder = createPlaceholderSVG(gallery || {}, window.currentFsIndex + 1);
            this.src = placeholder;
            this.onerror = null;
        };
    }
}

// 修改 closeFullscreen 函數
window.closeFullscreen = function() {
    const fsViewer = document.getElementById('fullscreenViewer');
    if (fsViewer) {
        fsViewer.style.display = 'none';
    }
    
    // 停止所有計時器和動畫
    stopFsAutoPlay();
    stopProgressAnimation();
    isFsAutoPlaying = false;
    
    // 清空進度條相關數據
    if (fsAutoPlayInterval) {
        clearTimeout(fsAutoPlayInterval);
        fsAutoPlayInterval = null;
    }
};

// 初始化完成
console.log('圖庫瀏覽器已載入 - 使用實際圖片檔案名稱');