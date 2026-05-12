// b2-manager.js — 透過 Cloudflare Worker 代理所有 B2 操作
// 不再需要 --disable-web-security

class B2Manager {
    constructor() {
        // ⚠️ 替換為你部署的 Worker URL
        this.workerUrl = 'https://b2proxy.wongsanki.workers.dev';

        // 公開下載 URL（讀取圖片用，不需要代理）
        this.downloadBaseUrl = 'https://f005.backblazeb2.com/file/laserpen-gallery-bucket/';

        // 如果 Worker 有設 API_SECRET，這裡也要填一樣的值；沒設就留空
        this.apiKey = '';
    }

    _headers(json = true) {
        const h = {};
        if (json) h['Content-Type'] = 'application/json';
        if (this.apiKey) h['X-API-Key'] = this.apiKey;
        return h;
    }

    async _fetch(path, options = {}) {
        const url = this.workerUrl + path;
        if (this.apiKey && options.headers) {
            options.headers['X-API-Key'] = this.apiKey;
        } else if (this.apiKey) {
            options.headers = { 'X-API-Key': this.apiKey };
        }
        const resp = await fetch(url, {
            ...options,
            cache: 'no-store'    // ← 加這行，防止快取 404
        });
        if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data.error || `請求失敗 (${resp.status})`);
        }
        return resp.json();
    }

    // 上傳文件
    async uploadFile(file, path) {
        console.log(`上傳: ${path} (${(file.size / 1024).toFixed(1)} KB)`);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);

        const headers = {};
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;

        const resp = await fetch(this.workerUrl + '/api/upload', {
            method: 'POST',
            headers,
            body: formData
        });
        if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data.error || `上傳失敗 (${resp.status})`);
        }
        const result = await resp.json();
        console.log('✅ 上傳成功:', path);
        return result;
    }

    // 刪除文件
    async deleteFile(fileName) {
        console.log(`刪除: ${fileName}`);
        return this._fetch('/api/delete', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ fileName })
        });
    }

    // 讀取 galleries.json
    async readGalleries() {
        console.log('讀取 galleries.json...');
        const data = await this._fetch('/api/galleries');
        console.log(`✅ 讀取到 ${Array.isArray(data) ? data.length : 0} 個圖庫`);
        return Array.isArray(data) ? data : [];
    }

    // 更新 galleries.json
    async updateGalleries(galleriesData) {
        console.log(`更新 galleries.json (${galleriesData.length} 個圖庫)...`);
        return this._fetch('/api/galleries', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(galleriesData)
        });
    }

    // 測試連接
    async testConnection() {
        try {
            const result = await this._fetch('/api/test');
            console.log('✅ Worker 連接正常');
            return { success: true, message: 'Worker 連接正常' };
        } catch (e) {
            console.error('❌ Worker 連接失敗:', e);
            return { success: false, message: e.message };
        }
    }
}

const b2Manager = new B2Manager();

// 全局測試函數
window.testB2Connection = async function () {
    const result = await b2Manager.testConnection();
    const msg = result.success
        ? '✅ Worker 連接正常！'
        : '❌ 連接失敗: ' + result.message;
    console.log(msg);
};
