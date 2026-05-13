class B2Manager {
    constructor() {
        this.workerUrl = 'https://b2proxy.wongsanki.workers.dev';
        this.downloadBaseUrl = 'https://f005.backblazeb2.com/file/laserpen-gallery-bucket/';
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
        if (this.apiKey) {
            options.headers = options.headers || {};
            options.headers['X-API-Key'] = this.apiKey;
        }
        const resp = await fetch(url, { ...options, cache: 'no-store' });
        if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data.error || `請求失敗 (${resp.status})`);
        }
        return resp.json();
    }

    async uploadFile(file, path) {
        console.log(`上傳: ${path} (${(file.size / 1024).toFixed(1)} KB)`);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path);
        const headers = {};
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;
        const resp = await fetch(this.workerUrl + '/api/upload', { method: 'POST', headers, body: formData });
        if (!resp.ok) {
            const data = await resp.json().catch(() => ({}));
            throw new Error(data.error || `上傳失敗 (${resp.status})`);
        }
        return resp.json();
    }

    async deleteFile(fileName) {
        return this._fetch('/api/delete', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify({ fileName })
        });
    }

    async readGalleries() {
        const data = await this._fetch('/api/galleries');
        return Array.isArray(data) ? data : [];
    }

    async updateGalleries(galleriesData) {
        return this._fetch('/api/galleries', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(galleriesData)
        });
    }

    // ★ 新增：影片
    async readVideos() {
        const data = await this._fetch('/api/videos');
        return Array.isArray(data) ? data : [];
    }

    async updateVideos(videosData) {
        return this._fetch('/api/videos', {
            method: 'POST',
            headers: this._headers(),
            body: JSON.stringify(videosData)
        });
    }

    async testConnection() {
        try {
            await this._fetch('/api/test');
            return { success: true, message: 'Worker 連接正常' };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }
}

const b2Manager = new B2Manager();
