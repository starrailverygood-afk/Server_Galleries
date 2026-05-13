// ═══ 全域狀態 ═══
let reverseMode = localStorage.getItem('reverseMode') === 'true';
let currentTab = 'gallery'; // 'gallery' | 'video'
let galleryDatabase = [];
let videoDatabase = [];
let activeFilters = { character: [], tags: [] };

const SPEED_LEVELS = [1000, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000];
const B2_BASE_URL = 'https://f005.backblazeb2.com/file/laserpen-gallery-bucket/';
const USE_B2 = true;
const PLACEHOLDER_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

let fsAutoPlayInterval = null;
let fsProgressInterval = null;
let autoPlaySpeed = 10000;
let isFsAutoPlaying = false;
let progressStartTime = 0;

function buildB2Url(...segs) {
    const s = segs.filter(s => s && s !== '').map(s => s.replace(/^\/+|\/+$/g, ''));
    return (B2_BASE_URL + '/' + s.join('/')).replace(/([^:]\/)\/+/g, '$1');
}

function escHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
function escAttr(str) { return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

// ═══ 初始化 ═══
document.addEventListener('DOMContentLoaded', async function () {
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    try {
        await loadGalleryData();
        await loadVideoData();
        processGalleryCovers();
        updateStats();
        updateTagFilters();
        renderGalleryList(galleryDatabase);
    } catch (error) {
        console.error('初始化失敗:', error);
        showError('無法載入圖庫數據: ' + error.message);
    }

    // Header 右側按鈕
    const header = document.querySelector('.header');
    if (header) {
        const right = document.createElement('div');
        right.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'btn-settings';
        settingsBtn.innerHTML = '<i class="fas fa-sliders-h"></i>';
        settingsBtn.onclick = openSettings;

        const manageBtn = document.createElement('button');
        manageBtn.className = 'btn-manage';
        manageBtn.innerHTML = '<i class="fas fa-cog"></i> 管理';
        manageBtn.onclick = openManagementPage;

        right.appendChild(settingsBtn);
        right.appendChild(manageBtn);
        header.appendChild(right);
    }

    if (!document.getElementById('managementPanel')) {
        const p = document.createElement('div');
        p.id = 'managementPanel';
        p.className = 'management-panel';
        p.style.display = 'none';
        document.body.appendChild(p);
    }
    if (!document.getElementById('settingsPanel')) {
        const p = document.createElement('div');
        p.id = 'settingsPanel';
        p.style.display = 'none';
        document.body.appendChild(p);
    }
});

// ═══ Tab 切換 ═══
window.switchMainTab = function (tab) {
    if (currentTab === tab) return;
    currentTab = tab;
    document.querySelectorAll('.main-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('gallerySection').style.display = tab === 'gallery' ? '' : 'none';
    document.getElementById('videoSection').style.display = tab === 'video' ? '' : 'none';

    activeFilters = { character: [], tags: [] };
    document.querySelectorAll('.sidebar .tag.selected').forEach(t => t.classList.remove('selected'));
    updateStats();
    updateTagFilters();

    if (tab === 'gallery') renderGalleryList(galleryDatabase);
    else renderVideoList(videoDatabase);
};

// ═══ 資料載入 ═══
async function loadGalleryData() {
    const data = await b2Manager.readGalleries();
    galleryDatabase = Array.isArray(data) ? data : [];
    galleryDatabase.forEach((g, i) => {
        if (!g.id) g.id = 'gallery-' + (i + 1);
        if (!g.folderPath && g.name) g.folderPath = 'galleries/' + g.name;
        if (!g.imageFiles || !Array.isArray(g.imageFiles)) g.imageFiles = [];
        if (!g.fileCount) g.fileCount = g.imageFiles.length;
    });
}

async function loadVideoData() {
    try {
        const data = await b2Manager.readVideos();
        videoDatabase = Array.isArray(data) ? data : [];
        videoDatabase.forEach(v => {
            if (!v.id) v.id = 'video-' + Date.now();
            if (!v.character) v.character = [];
            if (!v.tags) v.tags = [];
        });
    } catch (e) {
        console.warn('載入影片數據失敗:', e);
        videoDatabase = [];
    }
}

// ═══ 圖庫封面處理 ═══
function processGalleryCovers() {
    for (const g of galleryDatabase) {
        g.color = PLACEHOLDER_COLORS[(parseInt(g.id.replace('gallery-', '')) || 0) % PLACEHOLDER_COLORS.length];
        g.initials = getGalleryInitials(g.name);
        if (g.imageFiles && g.imageFiles.length > 0 && g.folderPath) {
            const base = g.folderPath.replace(/^\/+|\/+$/g, '');
            g.coverImage = buildB2Url(base, g.imageFiles[0]);
            g.fullImagePaths = g.imageFiles.map(f => buildB2Url(base, f));
        }
    }
}

function getGalleryInitials(name) {
    if (!name) return '?';
    if (name.length <= 3) return name;
    if (/[\u4e00-\u9fff]/.test(name)) return name.substring(0, 2);
    const w = name.split(/[-_\s]+/);
    return w.length >= 2 ? (w[0][0] + w[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();
}

function createPlaceholderSVG(gallery, idx) {
    const svg = `<svg width="200" height="150" viewBox="0 0 200 150" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="150" fill="${gallery.color || '#3b82f6'}"/>
        <text x="50%" y="50%" font-family="Arial" font-size="24" fill="white" text-anchor="middle" dy=".3em">${gallery.initials || '圖'}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// ═══ 統計 & 篩選 ═══
function updateStats() {
    const el = document.getElementById('sidebarStats');
    if (!el) return;
    if (currentTab === 'gallery') {
        const total = galleryDatabase.reduce((s, g) => s + (g.fileCount || 0), 0);
        el.innerHTML = `<div class="stat-item"><i class="fas fa-folder"></i><span>${galleryDatabase.length}</span>個圖庫</div>
                        <div class="stat-item"><i class="fas fa-image"></i><span>${total}</span>張圖片</div>`;
    } else {
        el.innerHTML = `<div class="stat-item" style="flex:1"><i class="fas fa-film"></i><span>${videoDatabase.length}</span>個影片鏈接</div>`;
    }
}

function updateTagFilters() {
    const data = currentTab === 'gallery' ? galleryDatabase : videoDatabase;
    const chars = new Set(), tags = new Set();
    data.forEach(item => {
        (Array.isArray(item.character) ? item.character : (item.character ? [item.character] : [])).forEach(c => chars.add(c));
        if (Array.isArray(item.tags)) item.tags.forEach(t => tags.add(t));
    });
    buildTagList('character-tags', chars, 'character');
    buildTagList('custom-tags', tags, 'tags');
}

function buildTagList(containerId, tagSet, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'zh-TW')).forEach(text => {
        const el = document.createElement('span');
        el.className = 'tag';
        if (activeFilters[type]?.includes(text)) el.classList.add('selected');
        el.textContent = text;
        el.dataset.type = type;
        el.dataset.value = text;
        el.addEventListener('click', function () {
            this.classList.toggle('selected');
            updateActiveFilters();
            filterContent();
        });
        container.appendChild(el);
    });
}

function updateActiveFilters() {
    activeFilters = { character: [], tags: [] };
    document.querySelectorAll('.sidebar .tag.selected').forEach(tag => {
        const t = tag.dataset.type, v = tag.dataset.value;
        if (t && v && activeFilters[t]) activeFilters[t].push(v);
    });
}

function filterContent() {
    if (currentTab === 'gallery') {
        let list = [...galleryDatabase];
        if (activeFilters.character.length) list = list.filter(g => {
            const c = Array.isArray(g.character) ? g.character : [g.character];
            return activeFilters.character.some(f => c.includes(f));
        });
        if (activeFilters.tags.length) list = list.filter(g => {
            const t = Array.isArray(g.tags) ? g.tags : [];
            return activeFilters.tags.some(f => t.includes(f));
        });
        renderGalleryList(list);
    } else {
        let list = [...videoDatabase];
        if (activeFilters.character.length) list = list.filter(v => {
            const c = Array.isArray(v.character) ? v.character : [];
            return activeFilters.character.some(f => c.includes(f));
        });
        if (activeFilters.tags.length) list = list.filter(v => {
            const t = Array.isArray(v.tags) ? v.tags : [];
            return activeFilters.tags.some(f => t.includes(f));
        });
        renderVideoList(list);
    }
}

// 保留舊名相容
function filterGalleries() { filterContent(); }

window.clearAllFilters = function () {
    activeFilters = { character: [], tags: [] };
    document.querySelectorAll('.sidebar .tag.selected').forEach(t => t.classList.remove('selected'));
    if (currentTab === 'gallery') renderGalleryList(galleryDatabase);
    else renderVideoList(videoDatabase);
};

// ═══ 圖庫渲染 ═══
function renderGalleryList(galleries) {
    const container = document.getElementById('galleryView');
    if (!container) return;
    if (galleries.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-images"></i><h3>沒有找到圖庫</h3>
            <p>請嘗試選擇其他標籤或清除篩選條件</p>
            <button class="btn-clear" onclick="clearAllFilters()" style="margin-top:20px"><i class="fas fa-times"></i> 清除篩選</button></div>`;
        return;
    }
    container.innerHTML = galleries.map(g => `
        <div class="gallery-card" onclick="openGalleryViewer('${g.id}')">
            <div class="gallery-cover-container">
                <img src="${g.coverImage || ''}" alt="${escHtml(g.name)}" class="gallery-cover"
                     onerror="handleCoverImageError(this,'${g.id}')" loading="lazy">
                <div class="placeholder-cover" style="background-color:${g.color};display:none;">
                    <div class="placeholder-text">${g.initials}</div>
                </div>
            </div>
            <div class="gallery-info">
                <div class="gallery-title"><span>${escHtml(g.name)}</span><span class="file-count">${g.fileCount || 0} 張</span></div>
                <div class="gallery-tags">
                    ${(Array.isArray(g.character) ? g.character : [g.character]).filter(Boolean).map(c => `<span class="tag" data-type="character">${escHtml(c)}</span>`).join('')}
                    ${(Array.isArray(g.tags) ? g.tags : []).map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

window.handleCoverImageError = function (img, id) {
    img.style.display = 'none';
    const p = img.nextElementSibling;
    if (p) p.style.display = 'flex';
};

// ═══ 影片渲染 ═══
function renderVideoList(videos) {
    const container = document.getElementById('videoView');
    if (!container) return;
    if (videos.length === 0) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-film"></i><h3>沒有影片鏈接</h3>
            <p>點擊右上角「管理」按鈕新增影片鏈接</p></div>`;
        return;
    }
    container.innerHTML = videos.map(v => {
        const hasCover = v.cover && v.cover.trim();
        const coverUrl = hasCover ? (v.cover.startsWith('http') ? v.cover : buildB2Url(v.cover)) : '';
        const color = PLACEHOLDER_COLORS[(parseInt(String(v.id).replace('video-', '')) || 0) % PLACEHOLDER_COLORS.length];
        let domain = '';
        try { domain = new URL(v.url).hostname; } catch { domain = v.url; }
        const chars = Array.isArray(v.character) ? v.character : [];
        const tags = Array.isArray(v.tags) ? v.tags : [];

        return `
        <div class="gallery-card video-card" onclick="window.open('${escAttr(v.url)}','_blank')">
            <div class="gallery-cover-container">
                ${hasCover ? `
                    <img src="${coverUrl}" class="gallery-cover" loading="lazy"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                    <div class="placeholder-cover" style="background-color:${color};display:none;">
                        <div class="placeholder-text">🎬</div>
                    </div>
                ` : `
                    <div class="placeholder-cover" style="background-color:${color};">
                        <div class="placeholder-text">🎬</div>
                    </div>
                `}
                <div class="video-link-badge"><i class="fas fa-external-link-alt"></i></div>
            </div>
            <div class="gallery-info">
                <div class="gallery-title"><span>${escHtml(v.name)}</span></div>
                <div class="video-url-display"><i class="fas fa-link"></i> ${escHtml(domain)}</div>
                <div class="gallery-tags">
                    ${chars.map(c => `<span class="tag" data-type="character">${escHtml(c)}</span>`).join('')}
                    ${tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
                </div>
            </div>
        </div>`;
    }).join('');
}

// ═══ 錯誤 / 空狀態 ═══
function renderEmptyState(msg) {
    const c = document.getElementById('galleryView');
    if (c) c.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle" style="color:#ef4444"></i>
        <h3>錯誤</h3><p>${msg}</p>
        <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px"><i class="fas fa-redo"></i> 重新載入</button></div>`;
}

function showError(msg) {
    const c = document.getElementById('galleryView');
    if (c) c.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle" style="color:#ef4444"></i>
        <h3>無法載入圖庫數據</h3><p>${msg}</p>
        <button onclick="location.reload()" style="margin:5px;padding:10px 20px"><i class="fas fa-redo"></i> 重新載入</button></div>`;
}

// ═══ 設定面板 ═══
window.openSettings = function () {
    const p = document.getElementById('settingsPanel');
    if (!p) return;
    p.style.display = 'block';
    p.innerHTML = `
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
                        <p>開啟後，點左半熒幕翻到<strong>下一頁</strong>，點右半翻到<strong>上一頁</strong></p>
                    </div>
                    <label class="toggle-switch">
                        <input type="checkbox" id="reverseModeToggle" ${reverseMode ? 'checked' : ''} onchange="toggleReverseMode()">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        </div>`;
};
window.closeSettings = function () { document.getElementById('settingsPanel').style.display = 'none'; };
window.toggleReverseMode = function () {
    reverseMode = document.getElementById('reverseModeToggle').checked;
    localStorage.setItem('reverseMode', reverseMode.toString());
};

// ═══ 圖庫瀏覽器 ═══
window.openGalleryViewer = function (galleryId) {
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;
    const viewer = document.createElement('div');
    viewer.className = 'gallery-viewer';
    viewer.innerHTML = `
    <div class="viewer-overlay" onclick="closeGalleryViewer()"></div>
    <div class="viewer-content">
        <div class="viewer-header">
            <h2>${escHtml(gallery.name)}</h2>
            <button class="viewer-close" onclick="closeGalleryViewer()"><i class="fas fa-times"></i></button>
        </div>
        <div class="viewer-info">
            <div class="info-stats">
                <span><i class="fas fa-image"></i> ${gallery.fileCount} 張圖片</span>
                <span><i class="fas fa-user"></i> ${Array.isArray(gallery.character) ? gallery.character.join(', ') : gallery.character}</span>
            </div>
            <div class="info-tags">${(Array.isArray(gallery.tags) ? gallery.tags : []).map(t => `<span class="viewer-tag">${escHtml(t)}</span>`).join('')}</div>
        </div>
        <div class="image-grid" id="imageGrid-${gallery.id}">
            <div class="loading-images"><i class="fas fa-spinner fa-spin"></i> 載入圖片中...</div>
        </div>
        <div class="viewer-controls">
            <div class="control-group">
                <button class="viewer-btn" onclick="prevImage()"><i class="fas fa-chevron-left"></i> 上一張</button>
                <span class="image-counter"><span id="currentImage">1</span> / <span id="totalImagesViewer">${gallery.fileCount}</span></span>
                <button class="viewer-btn" onclick="nextImage()">下一張 <i class="fas fa-chevron-right"></i></button>
            </div>
        </div>
    </div>
    <div class="fullscreen-viewer" id="fullscreenViewer" style="display:none;"></div>`;
    document.body.appendChild(viewer);
    loadGalleryImages(gallery);
    window.currentGallery = gallery;
    window.currentImageIndex = 0;
    window.galleryImages = gallery.fullImagePaths || [];
};

async function loadGalleryImages(gallery) {
    const grid = document.getElementById('imageGrid-' + gallery.id);
    if (!grid) return;
    grid.innerHTML = '';
    const files = gallery.fullImagePaths || [];
    if (files.length === 0) {
        for (let i = 1; i <= gallery.fileCount; i++) {
            const d = document.createElement('div');
            d.className = 'grid-image-item placeholder';
            d.innerHTML = `<div class="placeholder-box" style="background-color:${gallery.color}"><div class="placeholder-text-small">${i}</div></div>`;
            grid.appendChild(d);
        }
        return;
    }
    files.forEach((path, idx) => {
        const d = document.createElement('div');
        d.className = 'grid-image-item';
        d.innerHTML = `<img src="${path}" alt="${escHtml(gallery.name)} - ${idx + 1}" onclick="openImageFullscreen('${gallery.id}',${idx})" loading="lazy"
            onerror="handleGridImageError(this,'${gallery.id}',${idx})">`;
        grid.appendChild(d);
    });
}

window.handleGridImageError = function (img, gid, idx) {
    const g = galleryDatabase.find(g => g.id === gid);
    if (g) img.src = createPlaceholderSVG(g, idx + 1);
    img.onerror = null;
};

// ═══ 全屏瀏覽器 ═══
window.fsLeftClick = function () { reverseMode ? fsNextImage() : fsPrevImage(); };
window.fsRightClick = function () { reverseMode ? fsPrevImage() : fsNextImage(); };

window.openImageFullscreen = function (galleryId, imageIndex) {
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;
    const images = gallery.fullImagePaths || [];
    window.fullscreenImages = images;
    window.currentFsIndex = imageIndex;
    window.currentGalleryId = galleryId;

    const fs = document.getElementById('fullscreenViewer');
    if (!fs) return;
    fs.classList.toggle('reversed', reverseMode);
    fs.innerHTML = `
        <div class="fs-progress-container">${images.map((_, i) => `<div class="fs-progress-bar" id="progressBar-${i}"><div class="fs-progress-fill" id="progressFill-${i}"></div></div>`).join('')}</div>
        <button class="fs-close-btn" onclick="closeFullscreen()"><i class="fas fa-times"></i></button>
        <div class="fs-image-container">
            <img id="fsImage" src="" alt="">
            <div class="fs-click-zone fs-click-left" onclick="fsLeftClick()"></div>
            <div class="fs-click-zone fs-click-right" onclick="fsRightClick()"></div>
            <div class="fs-auto-controls">
                <button class="fs-auto-btn" onclick="fsChangeSpeed(-1)"><i class="fas fa-minus"></i></button>
                <button class="fs-auto-btn" id="fsToggleAutoPlay" onclick="fsToggleAutoPlay()"><i class="fas fa-play" id="fsAutoPlayIcon"></i></button>
                <button class="fs-auto-btn" onclick="fsChangeSpeed(1)"><i class="fas fa-plus"></i></button>
            </div>
        </div>
        <div class="fs-info">
            <span id="fsImageIndex">${imageIndex + 1} / ${images.length}</span>
            <span class="fs-speed-info" id="fsSpeedInfo">${autoPlaySpeed / 1000}秒/張</span>
        </div>`;
    fs.style.display = 'block';
    updateFullscreenImage();
    updateProgressBars();
};

function updateFullscreenImage() {
    if (!window.fullscreenImages) return;
    const img = document.getElementById('fsImage');
    const info = document.getElementById('fsImageIndex');
    if (img && window.fullscreenImages[window.currentFsIndex]) {
        img.src = window.fullscreenImages[window.currentFsIndex];
        if (info) info.textContent = (window.currentFsIndex + 1) + ' / ' + window.fullscreenImages.length;
        updateFsSpeedDisplay();
        const g = galleryDatabase.find(g => g.id === window.currentGalleryId);
        img.onerror = function () { this.src = createPlaceholderSVG(g || {}, window.currentFsIndex + 1); this.onerror = null; };
    }
}

window.fsPrevImage = function () {
    if (!window.fullscreenImages || !window.fullscreenImages.length) return;
    window.currentFsIndex = window.currentFsIndex > 0 ? window.currentFsIndex - 1 : window.fullscreenImages.length - 1;
    updateFullscreenImage(); updateProgressBars();
    if (isFsAutoPlaying) startFsAutoPlay();
};
window.fsNextImage = function () {
    if (!window.fullscreenImages || !window.fullscreenImages.length) return;
    window.currentFsIndex = window.currentFsIndex < window.fullscreenImages.length - 1 ? window.currentFsIndex + 1 : 0;
    updateFullscreenImage(); updateProgressBars();
    if (isFsAutoPlaying) startFsAutoPlay();
};
window.closeFullscreen = function () {
    const fs = document.getElementById('fullscreenViewer');
    if (fs) fs.style.display = 'none';
    stopFsAutoPlay(); isFsAutoPlaying = false;
};
window.closeGalleryViewer = function () {
    const v = document.querySelector('.gallery-viewer');
    if (v) v.remove();
    closeFullscreen();
};
window.prevImage = function () {
    if (window.currentGallery) {
        window.currentImageIndex = window.currentImageIndex > 0 ? window.currentImageIndex - 1 : window.currentGallery.fileCount - 1;
        const el = document.getElementById('currentImage');
        if (el) el.textContent = window.currentImageIndex + 1;
    }
};
window.nextImage = function () {
    if (window.currentGallery) {
        window.currentImageIndex = window.currentImageIndex < window.currentGallery.fileCount - 1 ? window.currentImageIndex + 1 : 0;
        const el = document.getElementById('currentImage');
        if (el) el.textContent = window.currentImageIndex + 1;
    }
};

// ═══ 自動播放 ═══
window.fsToggleAutoPlay = function () { isFsAutoPlaying ? stopFsAutoPlay() : startFsAutoPlay(); };

function startFsAutoPlay() {
    stopFsAutoPlay();
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
    const progress = Math.min((Date.now() - progressStartTime) / autoPlaySpeed, 1);
    const fill = document.getElementById('progressFill-' + window.currentFsIndex);
    if (fill) fill.style.width = (progress * 100) + '%';
    if (progress < 1) fsProgressInterval = requestAnimationFrame(animateProgressBar);
}

function updateProgressBars() {
    const total = window.fullscreenImages ? window.fullscreenImages.length : 0;
    for (let i = 0; i < total; i++) {
        const f = document.getElementById('progressFill-' + i);
        if (f) {
            if (i < window.currentFsIndex) { f.style.width = '100%'; f.style.backgroundColor = '#fff'; }
            else if (i === window.currentFsIndex) { f.style.width = '0%'; f.style.backgroundColor = '#fff'; }
            else { f.style.width = '0%'; f.style.backgroundColor = 'rgba(255,255,255,0.3)'; }
        }
    }
}

window.fsChangeSpeed = function (dir) {
    let idx = SPEED_LEVELS.indexOf(autoPlaySpeed);
    if (idx === -1) idx = SPEED_LEVELS.findIndex(s => s <= autoPlaySpeed);
    if (idx === -1) idx = SPEED_LEVELS.length - 1;
    if (dir === 1 && idx > 0) idx--;
    else if (dir === -1 && idx < SPEED_LEVELS.length - 1) idx++;
    autoPlaySpeed = SPEED_LEVELS[idx];
    updateFsSpeedDisplay();
    if (isFsAutoPlaying) startFsAutoPlay();
};

function updateFsSpeedDisplay() {
    const s = autoPlaySpeed / 1000;
    const el = document.getElementById('fsSpeedInfo');
    if (el) el.textContent = s + '秒/張';
}

window.addEventListener('beforeunload', () => { stopFsAutoPlay(); });
