// ═══ 全域狀態 ═══
let reverseMode = localStorage.getItem('reverseMode') === 'true';
let currentTab = 'gallery';
let galleryDatabase = [];
let videoDatabase = [];
let activeFilters = { character: [], tags: [] };

const SPEED_LEVELS = [1000, 2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000, 20000];
const B2_BASE_URL = 'https://f005.backblazeb2.com/file/laserpen-gallery-bucket/';
const USE_B2 = true;
const PLACEHOLDER_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

let fsAutoPlayInterval = null;
let autoPlaySpeed = 10000;
let isFsAutoPlaying = false;

// ═══ ★ 主題系統 ═══
const THEMES = [
    { id: '', name: '深藍', color: '#3b82f6', bg: '#0f172a' },
    { id: 'theme-purple', name: '暗紫', color: '#8b5cf6', bg: '#13111c' },
    { id: 'theme-green', name: '純白', color: '#3b82f6', bg: '#ffffff' },
    { id: 'theme-rose', name: '玫瑰', color: '#f43f5e', bg: '#18080d' },
    { id: 'theme-black', name: '純黑', color: '#3b82f6', bg: '#000000' },
    { id: 'theme-amber', name: '琥珀', color: '#f59e0b', bg: '#14100a' },
];
let currentTheme = localStorage.getItem('selectedTheme') || '';

// 立即套用已儲存的主題（避免閃爍）
(function () {
    if (currentTheme) document.documentElement.classList.add(currentTheme);
})();

window.setTheme = function (themeId) {
    document.documentElement.className = document.documentElement.className.replace(/theme-\w+/g, '').trim();
    if (themeId) document.documentElement.classList.add(themeId);
    currentTheme = themeId;
    localStorage.setItem('selectedTheme', themeId);
    document.querySelectorAll('.theme-option').forEach(el => {
        el.classList.toggle('active', (el.dataset.theme || '') === themeId);
    });
};

// ═══ ★ 檔案類型判斷 ═══
function isVideoFile(path) {
    if (!path) return false;
    const ext = path.split('.').pop().split('?')[0].toLowerCase();
    return ['mp4', 'webm', 'mov'].includes(ext);
}

// ═══════════════════════════════════════════════════════
//  離屏圖片載入佇列
// ═══════════════════════════════════════════════════════
const _MAX_LOAD = 6;
let _loadN = 0;
const _loadQ = [];

function queueCanvasLoad(canvas, url, maxDim, onErr) {
    const task = { canvas, url, maxDim: maxDim || 400, onErr };
    if (_loadN < _MAX_LOAD) { _loadN++; _execLoad(task); }
    else _loadQ.push(task);
}

function _execLoad(task) {
    const { canvas, url, maxDim, onErr } = task;
    if (!canvas.isConnected) { _loadN--; _drainQueue(); return; }
    const offscreen = new Image();
    offscreen.onload = function () {
        if (!canvas.isConnected) { _killImg(offscreen); return; }
        let w = this.naturalWidth, h = this.naturalHeight;
        if (w > maxDim || h > maxDim) {
            const r = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * r); h = Math.round(h * r);
        }
        canvas.width = w;
        canvas.height = h;
        try { canvas.getContext('2d').drawImage(this, 0, 0, w, h); } catch (_) {}
        canvas.style.opacity = '1';
        const ph = canvas.parentElement && canvas.parentElement.querySelector('.placeholder-cover');
        if (ph) ph.style.display = 'none';
        _killImg(offscreen);
    };
    offscreen.onerror = function () {
        if (onErr) onErr(canvas);
        _killImg(offscreen);
    };
    offscreen.src = url;
}

function _killImg(img) {
    img.onload = img.onerror = null;
    img.src = '';
    _loadN--;
    _drainQueue();
}

function _drainQueue() {
    while (_loadQ.length && _loadN < _MAX_LOAD) {
        const t = _loadQ.shift();
        if (t.canvas.isConnected) { _loadN++; _execLoad(t); }
    }
}

function flushLoadQueue() { _loadQ.length = 0; }

// ═══ 懶載入 Observer ═══
let coverObserver = null;
let gridObserver = null;

function setupCoverObserver() {
    if (coverObserver) coverObserver.disconnect();
    coverObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const c = entry.target;
            if (entry.isIntersecting && c.dataset.src) {
                const src = c.dataset.src;
                c.removeAttribute('data-src');
                coverObserver.unobserve(c);
                queueCanvasLoad(c, src, 400, cv => {
                    cv.style.display = 'none';
                    const ph = cv.parentElement && cv.parentElement.querySelector('.placeholder-cover');
                    if (ph) ph.style.display = 'flex';
                });
            }
        });
    }, { rootMargin: '300px' });
}

function setupGridObserver() {
    if (gridObserver) gridObserver.disconnect();
    gridObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const item = entry.target;
            if (item.classList.contains('grid-video-item')) {
                gridObserver.unobserve(item);
                return;
            }
            const c = item.querySelector('canvas[data-src]');
            if (!c) return;
            const src = c.dataset.src;
            const gid = c.dataset.gid;
            const idx = parseInt(c.dataset.idx || '0');
            c.removeAttribute('data-src');
            gridObserver.unobserve(item);
            queueCanvasLoad(c, src, 400, cv => {
                drawCanvasPlaceholder(cv, gid, idx);
            });
        });
    }, { rootMargin: '200px' });
}

function drawCanvasPlaceholder(canvas, gid, idx) {
    const g = galleryDatabase.find(x => x.id === gid);
    canvas.width = 200; canvas.height = 150;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = (g && g.color) || '#3b82f6';
    ctx.fillRect(0, 0, 200, 150);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(idx + 1), 100, 75);
    canvas.style.opacity = '1';
}

// ═══ URL / HTML 工具 ═══
function buildB2Url(...segs) {
    const s = segs.filter(s => s && s !== '').map(s => s.replace(/^\/+|\/+$/g, ''));
    return (B2_BASE_URL + '/' + s.join('/')).replace(/([^:]\/)\/+/g, '$1');
}
function escHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
function escAttr(str) { return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

// ═══ 影片功能（獨立 fetch 版，保留相容）═══
async function loadVideos() {
    const container = document.getElementById('videoView');
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 載入中...</div>';
    try {
        const resp = await fetch(B2_CONFIG.workerUrl + '/api/videos');
        const videos = await resp.json();
        if (!Array.isArray(videos) || videos.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:60px;color:#999;"><i class="fas fa-film" style="font-size:48px;margin-bottom:15px;display:block;"></i>尚無影片鏈接</div>';
            return;
        }
        container.innerHTML = videos.map(v => `
            <a href="${v.url}" target="_blank" rel="noopener noreferrer"
               class="gallery-card" style="text-decoration:none;color:inherit;display:block;">
                <div class="gallery-cover" style="position:relative;">
                    ${v.thumbnail
                        ? `<img src="${v.thumbnail}" alt="${v.title}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;">`
                        : `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#1a1a2e;"><i class="fas fa-play-circle" style="font-size:48px;color:#e94560;"></i></div>`}
                    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:40px;color:rgba(255,255,255,0.8);text-shadow:0 0 20px rgba(0,0,0,0.8);">
                        <i class="fas fa-play-circle"></i>
                    </div>
                </div>
                <div class="gallery-info">
                    <h3>${v.title || '未命名影片'}</h3>
                    ${v.tags ? `<div class="gallery-tags">${v.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
                </div>
            </a>
        `).join('');
    } catch (e) {
        container.innerHTML = `<div style="text-align:center;padding:60px;color:#e94560;"><i class="fas fa-exclamation-triangle"></i> 載入失敗：${e.message}</div>`;
    }
}

// ═══ 初始化 ═══
document.addEventListener('DOMContentLoaded', async function () {
    // 套用主題到 body（補上，以免 CSS 選擇器用到 body）
    if (currentTheme) document.body.classList.add(currentTheme);

    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';

    setupCoverObserver();
    setupGridObserver();

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
        p.id = 'managementPanel'; p.className = 'management-panel'; p.style.display = 'none';
        document.body.appendChild(p);
    }
    if (!document.getElementById('settingsPanel')) {
        const p = document.createElement('div');
        p.id = 'settingsPanel'; p.style.display = 'none';
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
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.style.display = tab === 'gallery' ? '' : 'none';

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
    } catch (e) { console.warn('載入影片數據失敗:', e); videoDatabase = []; }
}

// ═══ 圖庫封面處理 ═══
function processGalleryCovers() {
    for (const g of galleryDatabase) {
        g.color = PLACEHOLDER_COLORS[(parseInt(g.id.replace('gallery-', '')) || 0) % PLACEHOLDER_COLORS.length];
        g.initials = getGalleryInitials(g.name);
        if (g.imageFiles && g.imageFiles.length > 0 && g.folderPath) {
            const base = g.folderPath.replace(/^\/+|\/+$/g, '');
            g.fullImagePaths = g.imageFiles.map(f => buildB2Url(base, f));

            if (g.coverThumb) {
                g.coverImage = g.coverThumb.startsWith('http') ? g.coverThumb : buildB2Url(g.coverThumb);
            } else {
                const coverFile = g.imageFiles.find(f => !isVideoFile(f)) || g.imageFiles[0];
                g.coverImage = isVideoFile(coverFile) ? '' : buildB2Url(base, coverFile);
            }
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
        if (activeFilters[type] && activeFilters[type].includes(text)) el.classList.add('selected');
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
                <div class="placeholder-cover" style="background-color:${g.color};">
                    <div class="placeholder-text">${g.initials}</div>
                </div>
                ${g.coverImage ? `
                    <img src="${g.coverImage}" class="gallery-cover-img"
                         loading="lazy" decoding="async"
                         onload="this.classList.add('loaded')"
                         onerror="this.remove()">
                ` : ''}
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

window.handleCoverImageError = function (el, id) {
    el.style.display = 'none';
    const p = el.nextElementSibling;
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
                    <img src="${coverUrl}" class="gallery-cover" loading="lazy" decoding="async"
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

// ═══ ★ 設定面板（含主題選擇）═══
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
                <div class="settings-item" style="flex-direction:column;align-items:stretch;">
                    <div class="settings-item-info" style="margin-bottom:14px;">
                        <h4>主題配色</h4>
                        <p>選擇喜歡的配色方案</p>
                    </div>
                    <div class="theme-grid">
                        ${THEMES.map(t => `
                            <div class="theme-option${currentTheme === t.id ? ' active' : ''}" data-theme="${t.id}" onclick="setTheme('${t.id}')">
                                <div class="theme-swatch" style="background:${t.bg};box-shadow:inset 0 -18px 0 ${t.color};"></div>
                                <span class="theme-name">${t.name}</span>
                            </div>
                        `).join('')}
                    </div>
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

// ═══ loadGalleryImages ═══
async function loadGalleryImages(gallery) {
    const grid = document.getElementById('imageGrid-' + gallery.id);
    if (!grid) return;
    grid.innerHTML = '';
    flushLoadQueue();

    if (gridObserver) gridObserver.disconnect();
    setupGridObserver();

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
        d.style.cursor = 'pointer';
        d.style.backgroundColor = gallery.color;
        d.onclick = function () { openImageFullscreen(gallery.id, idx); };

        if (isVideoFile(path)) {
            d.classList.add('grid-video-item');
            d.innerHTML = `
                <div class="grid-video-placeholder">
                    <i class="fas fa-play-circle"></i>
                    <span class="grid-video-label">MP4</span>
                </div>`;
        } else {
            d.innerHTML = `<canvas data-src="${path}" data-gid="${gallery.id}" data-idx="${idx}"
                class="grid-canvas" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0;"></canvas>`;
        }
        grid.appendChild(d);
    });

    grid.querySelectorAll('.grid-image-item').forEach(item => {
        gridObserver.observe(item);
    });
}

window.handleGridImageError = function (el, gid, idx) {
    const g = galleryDatabase.find(x => x.id === gid);
    if (g && el.tagName === 'IMG') {
        el.src = createPlaceholderSVG(g, idx + 1);
        el.onerror = null;
    }
};

// ═══════════════════════════════════════════════════════
//  ★ 全屏瀏覽器 — 影片預載入池 ±5（無縫切換）
// ═══════════════════════════════════════════════════════

let _fsCache = {};
let _fsVideoPool = {};

function _fsClearCache() {
    Object.values(_fsCache).forEach(img => { if (img && img.src) img.src = ''; });
    _fsCache = {};
    _fsClearVideoPool();
}

function _fsClearVideoPool() {
    Object.values(_fsVideoPool).forEach(entry => {
        entry.video.pause();
        entry.video.removeAttribute('src');
        entry.video.load();
        if (entry.video.parentNode) entry.video.parentNode.removeChild(entry.video);
    });
    _fsVideoPool = {};
}

function _fsPrepareVideo(index) {
    if (!window.fullscreenImages) return null;
    const src = window.fullscreenImages[index];
    if (!src || !isVideoFile(src)) return null;
    if (_fsVideoPool[index]) return _fsVideoPool[index];

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.style.display = 'none';
    video.src = src;

    const entry = { video, ready: false };
    video.addEventListener('canplaythrough', () => { entry.ready = true; }, { once: true });
    video.load();

    const container = document.getElementById('fsContainer');
    if (container) container.appendChild(video);

    _fsVideoPool[index] = entry;
    return entry;
}

// ★ 預載入範圍：±5（共 11 個）
function _fsPreload(index) {
    if (!window.fullscreenImages) return;
    const len = window.fullscreenImages.length;
    const keep = new Set();
    for (let d = -5; d <= 5; d++) keep.add((index + d + len) % len);

    // 清理圖片快取
    Object.keys(_fsCache).forEach(k => {
        if (!keep.has(parseInt(k))) {
            if (_fsCache[k]) _fsCache[k].src = '';
            delete _fsCache[k];
        }
    });
    keep.forEach(i => {
        const s = window.fullscreenImages[i];
        if (s && !isVideoFile(s) && !_fsCache[i]) {
            const img = new Image();
            img.src = s;
            _fsCache[i] = img;
        }
    });

    // 清理影片池
    Object.keys(_fsVideoPool).forEach(k => {
        const ki = parseInt(k);
        if (!keep.has(ki)) {
            const entry = _fsVideoPool[ki];
            entry.video.pause();
            entry.video.removeAttribute('src');
            entry.video.load();
            if (entry.video.parentNode) entry.video.parentNode.removeChild(entry.video);
            delete _fsVideoPool[ki];
        }
    });
    keep.forEach(i => {
        const s = window.fullscreenImages[i];
        if (s && isVideoFile(s) && !_fsVideoPool[i]) {
            _fsPrepareVideo(i);
        }
    });
}

// ═══ ★ 全屏控制項自動隱藏（4 秒無操作）═══
let _fsIdleTimer = null;

function _fsShowControls() {
    const fs = document.getElementById('fullscreenViewer');
    if (!fs || fs.style.display === 'none') return;
    fs.classList.add('fs-active');
    clearTimeout(_fsIdleTimer);
    _fsIdleTimer = setTimeout(() => {
        if (fs) fs.classList.remove('fs-active');
    }, 4000);
}

window.fsLeftClick = function () {
    _fsShowControls();
    reverseMode ? fsNextImage() : fsPrevImage();
};
window.fsRightClick = function () {
    _fsShowControls();
    reverseMode ? fsPrevImage() : fsNextImage();
};

window.openImageFullscreen = function (galleryId, imageIndex) {
    const gallery = galleryDatabase.find(g => g.id === galleryId);
    if (!gallery) return;
    const images = gallery.fullImagePaths || [];
    window.fullscreenImages = images;
    window.currentFsIndex = imageIndex;
    window.currentGalleryId = galleryId;
    _fsClearCache();

    const fs = document.getElementById('fullscreenViewer');
    if (!fs) return;
    fs.classList.toggle('reversed', reverseMode);
    fs.classList.add('fs-active');
    fs.innerHTML = `
        <div class="fs-progress-container">
            <div class="fs-progress-bar" style="width:100%;">
                <div class="fs-progress-fill" id="fsProgressFill" style="width:0%;transition:width 0.2s;"></div>
            </div>
        </div>
        <button class="fs-close-btn" onclick="closeFullscreen()"><i class="fas fa-times"></i></button>
        <div class="fs-image-container" id="fsContainer">
            <img id="fsImage" src="" alt="" decoding="async">
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

    // 綁定活動偵測（每次新建 DOM 都要重綁）
    ['mousemove', 'mousedown', 'touchstart', 'keydown'].forEach(evt => {
        fs.addEventListener(evt, _fsShowControls, { passive: true });
    });
    _fsShowControls(); // 啟動 4 秒倒數

    updateFullscreenImage();
};

// ═══ updateFullscreenImage — 無縫影片切換 ═══
function updateFullscreenImage() {
    if (!window.fullscreenImages) return;
    const idx = window.currentFsIndex;
    const src = window.fullscreenImages[idx];
    const img = document.getElementById('fsImage');
    const info = document.getElementById('fsImageIndex');

    if (!src) return;

    // 先隱藏 + 暫停所有池中影片
    Object.values(_fsVideoPool).forEach(entry => {
        entry.video.pause();
        entry.video.style.display = 'none';
    });

    if (isVideoFile(src)) {
        if (img) { img.style.display = 'none'; img.removeAttribute('src'); }
        let entry = _fsVideoPool[idx];
        if (!entry) entry = _fsPrepareVideo(idx);
        if (entry) {
            entry.video.style.display = 'block';
            entry.video.currentTime = 0;
            entry.video.play().catch(() => {});
        }
    } else {
        if (img) {
            img.style.display = 'block';
            img.src = src;
            const g = galleryDatabase.find(g => g.id === window.currentGalleryId);
            img.onerror = function () { this.src = createPlaceholderSVG(g || {}, idx + 1); this.onerror = null; };
        }
    }

    if (info) info.textContent = (idx + 1) + ' / ' + window.fullscreenImages.length;
    updateFsSpeedDisplay();
    updateProgressBar();
    _fsPreload(idx);
}

function updateProgressBar() {
    const fill = document.getElementById('fsProgressFill');
    if (!fill || !window.fullscreenImages) return;
    const total = window.fullscreenImages.length;
    const pct = total > 1 ? (window.currentFsIndex / (total - 1)) * 100 : 100;
    fill.style.width = pct + '%';
}

window.fsPrevImage = function () {
    if (!window.fullscreenImages || !window.fullscreenImages.length) return;
    window.currentFsIndex = window.currentFsIndex > 0 ? window.currentFsIndex - 1 : window.fullscreenImages.length - 1;
    updateFullscreenImage();
    if (isFsAutoPlaying) startFsAutoPlay();
};
window.fsNextImage = function () {
    if (!window.fullscreenImages || !window.fullscreenImages.length) return;
    window.currentFsIndex = window.currentFsIndex < window.fullscreenImages.length - 1 ? window.currentFsIndex + 1 : 0;
    updateFullscreenImage();
    if (isFsAutoPlaying) startFsAutoPlay();
};

// ═══ closeFullscreen — 清理影片池 + idle timer ═══
window.closeFullscreen = function () {
    clearTimeout(_fsIdleTimer);
    _fsIdleTimer = null;
    const fs = document.getElementById('fullscreenViewer');
    if (fs) {
        const img = document.getElementById('fsImage');
        if (img) img.src = '';
        fs.style.display = 'none';
    }
    _fsClearCache();
    stopFsAutoPlay();
    isFsAutoPlaying = false;
};

window.closeGalleryViewer = function () {
    flushLoadQueue();
    if (gridObserver) gridObserver.disconnect();
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
    fsAutoPlayInterval = setTimeout(function () { fsNextImage(); }, autoPlaySpeed);
}

function stopFsAutoPlay() {
    if (fsAutoPlayInterval) { clearTimeout(fsAutoPlayInterval); fsAutoPlayInterval = null; }
    const icon = document.getElementById('fsAutoPlayIcon');
    if (icon) icon.className = 'fas fa-play';
    isFsAutoPlaying = false;
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

window.addEventListener('beforeunload', function () {
    stopFsAutoPlay();
    _fsClearCache();
    flushLoadQueue();
    if (gridObserver) gridObserver.disconnect();
    if (coverObserver) coverObserver.disconnect();
});
