// ★ 新增：反轉模式（從 localStorage 讀取）
let reverseMode = localStorage.getItem('reverseMode') === 'true';

//翻頁速度自訂
const SPEED_LEVELS = [1000, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000];

// Backblaze B2 配置
const B2_BASE_URL = 'https://f005.backblazeb2.com/file/laserpen-gallery-bucket/';
const USE_B2 = true;

function buildB2Url(...pathSegments) {
    const cleanSegments = pathSegments
        .filter(segment => segment && segment !== '')
        .map(segment => segment.replace(/^\/+|\/+$/g, ''));
    const url = `${B2_BASE_URL}/${cleanSegments.join('/')}`;
    return url.replace(/([^:]\/)\/+/g, '$1');
}

const LOCAL_GALLERY_DATA = [];

// 全域變數
let galleryDatabase = [];
let activeFilters = { character: [], tags: [] };
let fsAutoPlayInterval = null;
let fsProgressInterval = null;
let autoPlaySpeed = 10000;
let isFsAutoPlaying = false;
let progressStartTime = 0;

const PLACEHOLDER_COLORS = [
    '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'
];

// DOM 載入完成後初始化
document.addEventListener('DOMContentLoaded', async function () {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    try {
        console.log('開始初始化...');
        await loadGalleryData();

        if (galleryDatabase.length === 0) {
            console.warn('⚠️ 載入的圖庫數據為空');
            renderEmptyState('無法載入圖庫數據，請檢查網絡連接或 B2 設定');
            return;
        }

        console.log('成功載入外部 JSON 數據，共', galleryDatabase.length, '個圖庫');
        processGalleryCovers();
        updateStats();
        updateTagFilters();
        renderGalleryList(galleryDatabase);
        console.log('頁面初始化完成');
    } catch (error) {
        console.error('初始化失敗:', error);
        showError('無法載入圖庫數據: ' + error.message);
    }

    // ★ 修改：加入設定按鈕
    const header = document.querySelector('.header');
    if (header) {
        const headerRight = document.createElement('div');
        headerRight.className = 'header-right';
        headerRight.style.display = 'flex';
        headerRight.style.gap = '10px';
        headerRight.style.alignItems = 'flex-start';

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'btn-settings';
        settingsBtn.innerHTML = '<i class="fas fa-sliders-h"></i>';
        settingsBtn.title = '設定';
        settingsBtn.onclick = openSettings;

        const manageBtn = document.createElement('button');
        manageBtn.className = 'btn-manage';
        manageBtn.innerHTML = '<i class="fas fa-cog"></i> 管理圖庫';
        manageBtn.onclick = openManagementPage;

        headerRight.appendChild(settingsBtn);
        headerRight.appendChild(manageBtn);
        header.appendChild(headerRight);
    }

    if (!document.getElementById('managementPanel')) {
        const panel = document.createElement('div');
        panel.id = 'managementPanel';
        panel.className = 'management-panel';
        panel.style.display = 'none';
        document.body.appendChild(panel);
    }

    // ★ 新增：設定面板容器
    if (!document.getElementById('settingsPanel')) {
        const panel = document.createElement('div');
        panel.id = 'settingsPanel';
        panel.style.display = 'none';
        document.body.appendChild(panel);
    }
});

// ★ 新增：設定相關函數
window.openSettings = function () {
    const panel = document.getElementById('settingsPanel');
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML = `
        <div class="settings-overlay" onclick="closeSettings()"></div>
        <div class="settings-dialog">
            <div class="settings-header">
                <h2><i class="fas fa-sliders-h"></i> 設定</h2>
                <button class="settings-close" onclick="closeSettings()">✕</button>
            </div>
            <div class="settings-body">
                <div class="settings-item">
                    <div class="settings-item-info">
                        <h4>反轉模式</h4>
                        <p>開啟後，點左半熒幕翻到<strong>下一頁</strong>，點右半熒幕翻到<strong>上一頁</strong></p>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="reverseModeToggle"
                               ${reverseMode ? 'checked' : ''}
                               onchange="toggleReverseMode()">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        </div>
    `;
};

window.closeSettings = function () {
    const panel = document.getElementById('settingsPanel');
    if (panel) panel.style.display = 'none';
};

window.toggleReverseMode = function () {
    reverseMode = document.getElementById('reverseModeToggle').checked;
    localStorage.setItem('reverseMode', reverseMode.toString());
    console.log('反轉模式:', reverseMode ? '開啟' : '關閉');
};

// ★ 新增：點擊區域翻頁（根據反轉模式決定方向）
window.fsLeftClick = function () {
    if (reverseMode) {
        fsNextImage();
    } else {
        fsPrevImage();
    }
};

window.fsRightClick = function () {
    if (reverseMode) {
        fsPrevImage();
    } else {
        fsNextImage();
    }
};

// 動態載入圖庫數據
async function loadGalleryData() {
    try {
        console.log('正在透過 Worker 載入圖庫數據...');
        const data = await b2Manager.readGalleries();
        console.log('成功獲取數據，共', data.length, '個圖庫');

        if (Array.isArray(data)) {
            galleryDatabase = data;
        } else if (typeof data === 'object' && data !== null) {
            galleryDatabase = Object.values(data);
        } else {
            throw new Error('數據格式不正確');
        }

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
        console.error('載入圖庫失敗:', error);
        throw error;
    }
}

function processGalleryCovers() {
    for (const gallery of galleryDatabase) {
        gallery.color = getGalleryColor(gallery.id);
        gallery.initials = getGalleryInitials(gallery.name);

        if (gallery.imageFiles && gallery.imageFiles.length > 0) {
            const firstImage = gallery.imageFiles[0];
            if (gallery.folderPath) {
                const basePath = gallery.folderPath.replace(/^\/+|\/+$/g, '');
                if (USE_B2) {
                    gallery.coverImage = buildB2Url(basePath, firstImage);
                    gallery.fullImagePaths = gallery.imageFiles.map(file => buildB2Url(basePath, file));
                } else {
                    gallery.coverImage = `${basePath}/${firstImage}`;
                    gallery.fullImagePaths = gallery.imageFiles.map(file => `${basePath}/${file}`);
                }
            }
        }
    }
}

function getGalleryColor(galleryId) {
    const idNum = parseInt(galleryId.replace('gallery-', '')) || 0;
    return PLACEHOLDER_COLORS[idNum % PLACEHOLDER_COLORS.length];
}

function getGalleryInitials(name) {
    if (!name) return '?';
    if (name.length <= 3) return name;
    const isChinese = /[\u4e00-\u9fff]/.test(name);
    if (isChinese) return name.substring(0, 2);
    const words = name.split(/[-_\s]+/);
    if (words.length >= 2) return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

function createPlaceholderSVG(gallery, index = 1) {
    const svgContent = `<svg width="200" height="150" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="150" fill="${gallery.color || '#3b82f6'}"/>
        <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em">
            ${gallery.initials || '圖'}
        </text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
}

function renderEmptyState(message = '無法載入圖庫數據') {
    const container = document.getElementById('galleryView');
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>
            <h3>錯誤</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px;">
                <i class="fas fa-redo"></i> 重新載入
            </button>
        </div>
    `;
}

function updateStats() {
    const totalGalleries = document.getElementById('totalGalleries');
    const totalImages = document.getElementById('totalImages');
    if (totalGalleries) totalGalleries.textContent = galleryDatabase.length;
    if (totalImages) {
        totalImages.textContent = galleryDatabase.reduce((sum, g) => sum + (g.fileCount || 0), 0);
    }
}

function updateTagFilters() {
    const allCharacters = new Set();
    galleryDatabase.forEach(g => {
        if (Array.isArray(g.character)) g.character.forEach(c => allCharacters.add(c));
        else if (g.character) allCharacters.add(g.character);
    });

    const allTags = new Set();
    galleryDatabase.forEach(g => {
        if (Array.isArray(g.tags)) g.tags.forEach(t => allTags.add(t));
    });

    updateTagFilterSection('character-tags', allCharacters, 'character');
    updateTagFilterSection('custom-tags', allTags, 'tags');
}

function updateTagFilterSection(containerId, tagSet, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-TW')).forEach(tagText => {
        const tagElement = document.createElement('span');
        tagElement.className = 'tag';
        if (activeFilters[type]?.includes(tagText)) tagElement.classList.add('selected');
        tagElement.textContent = tagText;
        tagElement.dataset.type = type;
        tagElement.dataset.value = tagText;
        tagElement.addEventListener('click', function () {
            this.classList.toggle('selected');
            updateActiveFilters();
            filterGalleries();
        });
        container.appendChild(tagElement);
    });
}

function updateActiveFilters() {
    activeFilters = { character: [], tags: [] };
    document.querySelectorAll('.tag.selected').forEach(tag => {
        const type = tag.dataset.type;
        const value = tag.dataset.value;
        if (type && value && activeFilters[type]) activeFilters[type].push(value);
    });
}

function filterGalleries() {
    if (!galleryDatabase.length) { renderEmptyState('沒有可顯示的圖庫'); return; }
    let filtered = [...galleryDatabase];

    if (activeFilters.character.length > 0) {
        filtered = filtered.filter(g => {
            const chars = Array.isArray(g.character) ? g.character : [g.character];
            return activeFilters.character.some(f => chars.includes(f));
        });
    }
    if (activeFilters.tags.length > 0) {
        filtered = filtered.filter(g => {
            const tags = Array.isArray(g.tags) ? g.tags : [];
            return activeFilters.tags.some(f => tags.includes(f));
        });
    }
    renderGalleryList(filtered);
}

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
                <img src="${gallery.coverImage}" alt="${gallery.name}" class="gallery-cover"
                     onerror="handleCoverImageError(this, '${gallery.id}')" loading="lazy">
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
                        .filter(c => c).map(c => `<span class="tag" data-type="character">${c}</span>`).join('')}
                    ${(Array.isArray(gallery.tags) ? gallery.tags : [])
                        .filter(t => t).map(t => `<span class="tag">${t}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

window.handleCoverImageError = function (imgElement, galleryId) {
    imgElement.style.display = 'none';
    const placeholder = imgElement.nextElementSibling;
    if (placeholder) placeholder.style.display = 'flex';
};

function showError(message) {
    const container = document.getElementById('galleryView');
    if (!container) return;
    container.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle" style="color: #ef4444;"></i>
            <h3>無法載入圖庫數據</h3>
            <p>${message}</p>
            <button onclick="location.reload()" style="margin: 5px; padding: 10px 20px;">
                <i class="fas fa-redo"></i> 重新載入
            </button>
        </div>
    `;
}

window.clearAllFilters = function () {
    activeFilters = { character: [], tags: [] };
    document.querySelectorAll('.tag.selected').forEach(tag => tag.classList.remove('selected'));
    renderGalleryList(galleryDatabase);
};

window.openGalleryViewer = function (galleryId) {
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;

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
                    .map(tag => `<span class="viewer-tag">${tag}</span>`).join('')}
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
    <div class="fullscreen-viewer" id="fullscreenViewer" style="display: none;"></div>
    `;

    document.body.appendChild(viewer);
    loadGalleryImages(gallery);

    window.currentGallery = gallery;
    window.currentImageIndex = 0;
    window.galleryImages = gallery.fullImagePaths || [];
};

async function loadGalleryImages(gallery) {
    const imageGrid = document.getElementById(`imageGrid-${gallery.id}`);
    if (!imageGrid) return;
    imageGrid.innerHTML = '';

    try {
        const imageFiles = gallery.fullImagePaths || [];
        if (imageFiles.length === 0) {
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
        imageGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
            <i class="fas fa-exclamation-circle"></i><p>無法載入圖片</p></div>`;
    }
}

window.handleGridImageError = function (imgElement, galleryId, index) {
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;
    if (USE_B2 && imgElement.src.includes(B2_BASE_URL)) {
        const filename = imgElement.src.split('/').pop();
        const correctPath = `${B2_BASE_URL}/${gallery.folderPath}/${filename}`;
        imgElement.src = correctPath;
        return;
    }
    imgElement.src = createPlaceholderSVG(gallery, index + 1);
    imgElement.onerror = null;
};

// ★ 修改：全屏瀏覽器 — 使用 fsLeftClick / fsRightClick
window.openImageFullscreen = function (galleryId, imageIndex) {
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;

    const images = gallery.fullImagePaths || [];
    window.fullscreenImages = images;
    window.currentFsIndex = imageIndex;
    window.currentGalleryId = galleryId;

    const fsViewer = document.getElementById('fullscreenViewer');
    if (fsViewer) {
        // ★ 根據反轉模式加 class
        if (reverseMode) {
            fsViewer.classList.add('reversed');
        } else {
            fsViewer.classList.remove('reversed');
        }

        fsViewer.innerHTML = `
        <div class="fs-progress-container">
            ${images.map((_, idx) => `
                <div class="fs-progress-bar" id="progressBar-${idx}">
                    <div class="fs-progress-fill" id="progressFill-${idx}"></div>
                </div>
            `).join('')}
        </div>

        <button class="fs-close-btn" onclick="closeFullscreen()">
            <i class="fas fa-times"></i>
        </button>

        <div class="fs-image-container">
            <img id="fsImage" src="" alt="">

            <!-- ★ 改用 fsLeftClick / fsRightClick -->
            <div class="fs-click-zone fs-click-left" onclick="fsLeftClick()"></div>
            <div class="fs-click-zone fs-click-right" onclick="fsRightClick()"></div>

            <div class="fs-auto-controls">
                <button class="fs-auto-btn" onclick="fsChangeSpeed(-1)" title="減慢速度">
                    <i class="fas fa-minus"></i>
                </button>
                <button class="fs-auto-btn" id="fsToggleAutoPlay" onclick="fsToggleAutoPlay()" title="開始自動播放">
                    <i class="fas fa-play" id="fsAutoPlayIcon"></i>
                </button>
                <button class="fs-auto-btn" onclick="fsChangeSpeed(1)" title="加快速度">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
        </div>

        <div class="fs-info">
            <span id="fsImageIndex">${imageIndex + 1} / ${images.length}</span>
            <span class="fs-speed-info" id="fsSpeedInfo">${autoPlaySpeed / 1000}秒/張</span>
        </div>
        `;

        fsViewer.style.display = 'block';
        updateFullscreenImage();

        setTimeout(() => {
            initSpeedControls();
            updateFsSpeedDisplay();
        }, 100);

        updateFsSpeedDisplay();
        updateProgressBars();
    }
};

function updateFullscreenImage() {
    if (!window.fullscreenImages || window.currentFsIndex === undefined || window.currentFsIndex < 0) return;

    const fsImage = document.getElementById('fsImage');
    const fsImageIndex = document.getElementById('fsImageIndex');
    const gallery = galleryDatabase.find(g => g.id === window.currentGalleryId);

    if (fsImage && window.fullscreenImages[window.currentFsIndex]) {
        fsImage.src = window.fullscreenImages[window.currentFsIndex];
        if (fsImageIndex) {
            fsImageIndex.textContent = `${window.currentFsIndex + 1} / ${window.fullscreenImages.length}`;
        }
        updateFsSpeedDisplay();
        fsImage.onerror = function () {
            this.src = createPlaceholderSVG(gallery || {}, window.currentFsIndex + 1);
            this.onerror = null;
        };
    }
}

window.fsPrevImage = function () {
    if (!window.fullscreenImages || window.fullscreenImages.length === 0) return;
    window.currentFsIndex = window.currentFsIndex > 0
        ? window.currentFsIndex - 1
        : window.fullscreenImages.length - 1;
    updateFullscreenImage();
    updateProgressBars();
    if (isFsAutoPlaying) startFsAutoPlay();
};

window.fsNextImage = function () {
    if (!window.fullscreenImages || window.fullscreenImages.length === 0) return;
    window.currentFsIndex = window.currentFsIndex < window.fullscreenImages.length - 1
        ? window.currentFsIndex + 1
        : 0;
    updateFullscreenImage();
    updateProgressBars();
    if (isFsAutoPlaying) startFsAutoPlay();
};

window.closeFullscreen = function () {
    const fsViewer = document.getElementById('fullscreenViewer');
    if (fsViewer) fsViewer.style.display = 'none';
    stopFsAutoPlay();
    stopProgressAnimation();
    isFsAutoPlaying = false;
    if (fsAutoPlayInterval) { clearTimeout(fsAutoPlayInterval); fsAutoPlayInterval = null; }
};

window.closeGalleryViewer = function () {
    const viewer = document.querySelector('.gallery-viewer');
    if (viewer) viewer.remove();
    stopAutoPlay();
    stopFsAutoPlay();
    isFsAutoPlaying = false;
    closeFullscreen();
};

window.prevImage = function () {
    if (window.currentGallery) {
        window.currentImageIndex = window.currentImageIndex > 0
            ? window.currentImageIndex - 1
            : window.currentGallery.fileCount - 1;
        updateImageCounter();
    }
};

window.nextImage = function () {
    if (window.currentGallery) {
        window.currentImageIndex = window.currentImageIndex < window.currentGallery.fileCount - 1
            ? window.currentImageIndex + 1
            : 0;
        updateImageCounter();
    }
};

function updateImageCounter() {
    const currentImage = document.getElementById('currentImage');
    if (currentImage) currentImage.textContent = window.currentImageIndex + 1;
}

// 自動播放
window.toggleAutoPlay = function () {
    isAutoPlaying = !isAutoPlaying;
    const icon = document.getElementById('autoPlayIcon');
    const text = document.getElementById('autoPlayText');
    if (isAutoPlaying) {
        icon.className = 'fas fa-pause'; text.textContent = '暫停'; startAutoPlay();
    } else {
        icon.className = 'fas fa-play'; text.textContent = '開始'; stopAutoPlay();
    }
};

function startAutoPlay() {
    stopAutoPlay();
    autoPlayInterval = setInterval(() => nextImage(), autoPlaySpeed);
}

function stopAutoPlay() {
    if (autoPlayInterval) { clearInterval(autoPlayInterval); autoPlayInterval = null; }
}

window.changeAutoPlaySpeed = function (direction) {
    const speedLevels = [5000, 4000, 3000, 2000, 1000, 500];
    let currentIndex = speedLevels.indexOf(autoPlaySpeed);
    if (currentIndex === -1) {
        currentIndex = speedLevels.findIndex(s => s <= autoPlaySpeed);
        if (currentIndex === -1) currentIndex = speedLevels.length - 1;
    }
    if (direction === 1 && currentIndex > 0) currentIndex--;
    else if (direction === -1 && currentIndex < speedLevels.length - 1) currentIndex++;
    autoPlaySpeed = speedLevels[currentIndex];
    updateSpeedDisplay();
    if (isAutoPlaying) startAutoPlay();
};

function updateSpeedDisplay() {
    const seconds = autoPlaySpeed / 1000;
    const indicator = document.getElementById('speedIndicator');
    const fsIndicator = document.getElementById('fsSpeedIndicator');
    if (indicator) indicator.textContent = `${seconds}秒`;
    if (fsIndicator) fsIndicator.textContent = `${seconds}秒`;
}

// 全屏自動播放
window.fsToggleAutoPlay = function () {
    if (isFsAutoPlaying) stopFsAutoPlay();
    else startFsAutoPlay();
};

function startFsAutoPlay() {
    stopFsAutoPlay(); stopProgressAnimation();
    const icon = document.getElementById('fsAutoPlayIcon');
    if (icon) icon.className = 'fas fa-pause';
    isFsAutoPlaying = true;
    startProgressAnimation();
    fsAutoPlayInterval = setTimeout(() => fsNextImage(), autoPlaySpeed);
}

function stopFsAutoPlay() {
    if (fsAutoPlayInterval) { clearTimeout(fsAutoPlayInterval); fsAutoPlayInterval = null; }
    stopProgressAnimation();
    const icon = document.getElementById('fsAutoPlayIcon');
    if (icon) icon.className = 'fas fa-play';
    isFsAutoPlaying = false;
}

function startProgressAnimation() {
    stopProgressAnimation();
    progressStartTime = Date.now();
    fsProgressInterval = requestAnimationFrame(animateProgressBar);
}

function stopProgressAnimation() {
    if (fsProgressInterval) { cancelAnimationFrame(fsProgressInterval); fsProgressInterval = null; }
}

function animateProgressBar() {
    if (!isFsAutoPlaying) return;
    const elapsed = Date.now() - progressStartTime;
    const progress = Math.min(elapsed / autoPlaySpeed, 1);
    const progressFill = document.getElementById(`progressFill-${window.currentFsIndex}`);
    if (progressFill) progressFill.style.width = `${progress * 100}%`;
    if (progress < 1) fsProgressInterval = requestAnimationFrame(animateProgressBar);
}

function updateProgressBars() {
    const totalBars = window.fullscreenImages ? window.fullscreenImages.length : 0;
    for (let i = 0; i < totalBars; i++) {
        const pf = document.getElementById(`progressFill-${i}`);
        if (pf) {
            if (i < window.currentFsIndex) {
                pf.style.width = '100%'; pf.style.backgroundColor = '#ffffff';
            } else if (i === window.currentFsIndex) {
                pf.style.width = '0%'; pf.style.backgroundColor = '#ffffff';
            } else {
                pf.style.width = '0%'; pf.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }
        }
    }
}

window.fsChangeSpeed = function (direction) {
    const speedLevels = SPEED_LEVELS;
    let currentIndex = speedLevels.indexOf(autoPlaySpeed);
    if (currentIndex === -1) {
        for (let i = 0; i < speedLevels.length; i++) {
            if (speedLevels[i] <= autoPlaySpeed) { currentIndex = i; break; }
        }
        if (currentIndex === -1) currentIndex = speedLevels.length - 1;
    }
    if (direction === 1 && currentIndex > 0) currentIndex--;
    else if (direction === -1 && currentIndex < speedLevels.length - 1) currentIndex++;
    autoPlaySpeed = speedLevels[currentIndex];
    updateFsSpeedDisplay();
    if (isFsAutoPlaying) startFsAutoPlay();
};

function updateFsSpeedDisplay() {
    const seconds = autoPlaySpeed / 1000;
    const speedInfo = document.getElementById('fsSpeedInfo');
    if (speedInfo) { speedInfo.textContent = `${seconds}秒/張`; speedInfo.title = `切換圖片間隔: ${seconds}秒`; }
    const fsSpeedIndicator = document.getElementById('fsSpeedIndicator');
    if (fsSpeedIndicator) fsSpeedIndicator.textContent = `${seconds}秒`;
}

function initSpeedControls() {
    updateFsSpeedDisplay();
    document.querySelectorAll('.fs-auto-btn').forEach(btn => {
        btn.onclick = null;
        if (btn.querySelector('.fa-plus')) {
            btn.onclick = function (e) { fsChangeSpeed(1); e.stopPropagation(); };
        } else if (btn.querySelector('.fa-minus')) {
            btn.onclick = function (e) { fsChangeSpeed(-1); e.stopPropagation(); };
        }
    });
    const toggleBtn = document.getElementById('fsToggleAutoPlay');
    if (toggleBtn) {
        toggleBtn.onclick = function (e) { fsToggleAutoPlay(); e.stopPropagation(); };
    }
}

window.addEventListener('beforeunload', function () {
    stopAutoPlay(); stopFsAutoPlay();
});

console.log('圖庫瀏覽器已載入');
