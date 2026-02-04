// b2-manager.js - 修正版
class B2Manager {
    constructor() {
        // B2 配置
        this.keyId = '005b43cbafca7bf0000000001';
        this.applicationKey = 'K005MDzxnd7uAVLoZrN+rlk+oJ98aTQ';
        
        // 重要：你需要知道 bucketId，這不是 bucketName！
        // 登錄 Backblaze B2 → 點擊你的 bucket → 查看 "bucketId"
        this.bucketId = '3b1483bc2bfa2fac9ac70b1f'; // 替換為你的真實 bucketId
        
        this.bucketName = 'laserpen-gallery-bucket';
        this.downloadBaseUrl = 'https://f005.backblazeb2.com/file/laserpen-gallery-bucket/';
        
        this.authToken = null;
        this.apiUrl = null;
        this.downloadUrl = null;
        this.uploadUrl = null;
        this.uploadAuthToken = null;
    }
    
    // 1. 授權認證
    async authorize() {
        try {
            console.log('正在進行 B2 授權...');
            
            const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
                headers: {
                    'Authorization': 'Basic ' + btoa(this.keyId + ':' + this.applicationKey)
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`B2 授權失敗 (${response.status}): ${errorText}`);
            }
            
            const authData = await response.json();
            this.authToken = authData.authorizationToken;
            this.apiUrl = authData.apiUrl;
            this.downloadUrl = authData.downloadUrl;
            
            console.log('✅ B2 授權成功');
            console.log('API URL:', this.apiUrl);
            console.log('下載 URL:', this.downloadUrl);
            
            return authData;
            
        } catch (error) {
            console.error('❌ B2 授權錯誤:', error);
            
            // 提供有用的錯誤信息
            if (error.message.includes('Failed to fetch')) {
                throw new Error('網路連接失敗。請確保：\n1. 使用 HTTP 伺服器啟動（不是 file://）\n2. 檢查網路連接\n3. 允許 CORS（使用 Chrome 測試模式）');
            }
            
            throw error;
        }
    }
    
    // 2. 獲取上傳 URL（修正：使用 bucketId）
    async getUploadUrl() {
        if (!this.authToken) {
            console.log('尚未授權，先進行授權...');
            await this.authorize();
        }
        
        console.log('獲取上傳 URL...');
        console.log('使用 bucketId:', this.bucketId);
        
        try {
            const response = await fetch(this.apiUrl + '/b2api/v2/b2_get_upload_url', {
                method: 'POST',
                headers: {
                    'Authorization': this.authToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bucketId: this.bucketId  // 這裡必須是 bucketId，不是 bucketName！
                })
            });
            
            console.log('獲取上傳 URL 響應狀態:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('獲取上傳 URL 失敗詳細信息:', errorText);
                throw new Error(`獲取上傳 URL 失敗 (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            this.uploadUrl = data.uploadUrl;
            this.uploadAuthToken = data.authorizationToken;
            
            console.log('✅ 上傳 URL 獲取成功');
            console.log('上傳 URL:', this.uploadUrl);
            console.log('上傳授權令牌:', this.uploadAuthToken?.substring(0, 50) + '...');
            
            return data;
            
        } catch (error) {
            console.error('❌ 獲取上傳 URL 錯誤:', error);
            
            // 如果 bucketId 錯誤，提示用戶如何獲取
            if (error.message.includes('400') || error.message.includes('Invalid bucketId')) {
                console.error(`
                ⚠️ 可能的原因：
                1. bucketId 錯誤
                2. bucketName 和 bucketId 混淆
                
                🔧 如何獲取正確的 bucketId：
                1. 登錄 Backblaze B2 控制台
                2. 點擊你的 bucket: "${this.bucketName}"
                3. 找到 "Bucket ID" 欄位
                4. 複製 bucketId 並替換 this.bucketId
                
                當前 bucketId: ${this.bucketId}
                `);
            }
            
            throw error;
        }
    }
    
    // 3. 上傳文件
    async uploadFile(file, path) {
        // 確保有上傳 URL
        if (!this.uploadUrl || !this.uploadAuthToken) {
            console.log('上傳 URL 不存在，先獲取...');
            await this.getUploadUrl();
        }
        
        console.log(`開始上傳文件: ${path}`);
        console.log('文件大小:', file.size, 'bytes');
        console.log('文件類型:', file.type);
        console.log('上傳到 URL:', this.uploadUrl);
        
        try {
            // 計算 SHA1
            console.log('計算 SHA1...');
            const fileBuffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-1', fileBuffer);
            const sha1 = Array.from(new Uint8Array(hashBuffer))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            
            console.log('SHA1:', sha1);
            
            // 準備上傳
            console.log('開始上傳請求...');
            const response = await fetch(this.uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': this.uploadAuthToken,
                    'X-Bz-File-Name': encodeURIComponent(path),
                    'Content-Type': file.type || 'b2/x-auto',
                    'X-Bz-Content-Sha1': sha1,
                    'X-Bz-Info-src_last_modified_millis': file.lastModified || Date.now()
                },
                body: file
            });
            
            console.log('上傳響應狀態:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('上傳失敗詳細信息:', errorText);
                throw new Error(`上傳失敗 (${response.status}): ${errorText}`);
            }
            
            const result = await response.json();
            console.log('✅ 文件上傳成功:', result.fileName);
            console.log('文件 ID:', result.fileId);
            
            return result;
            
        } catch (error) {
            console.error('❌ 文件上傳錯誤:', error);
            
            // 如果是 CORS 錯誤，提供解決方案
            if (error.message.includes('CORS') || error.message.includes('NetworkError')) {
                console.error(`
                ⚠️ CORS 錯誤解決方案：
                1. 使用 Chrome 測試模式啟動：
                   chrome.exe --disable-web-security --user-data-dir="C:/TempChrome"
                2. 或部署到真正的伺服器
                3. 或使用代理伺服器
                `);
            }
            
            throw error;
        }
    }
    
    // 4. 刪除文件
    async deleteFile(fileName) {
        if (!this.authToken) await this.authorize();
        
        console.log(`刪除文件: ${fileName}`);
        
        try {
            // 先獲取文件 ID
            const listResponse = await fetch(this.apiUrl + '/b2api/v2/b2_list_file_names', {
                method: 'POST',
                headers: {
                    'Authorization': this.authToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bucketId: this.bucketId,
                    startFileName: fileName,
                    maxFileCount: 1
                })
            });
            
            if (!listResponse.ok) {
                throw new Error(`查詢文件失敗: ${listResponse.status}`);
            }
            
            const listData = await listResponse.json();
            
            if (!listData.files || listData.files.length === 0) {
                throw new Error('文件不存在');
            }
            
            const fileInfo = listData.files[0];
            
            // 刪除文件
            const deleteResponse = await fetch(this.apiUrl + '/b2api/v2/b2_delete_file_version', {
                method: 'POST',
                headers: {
                    'Authorization': this.authToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileId: fileInfo.fileId,
                    fileName: fileInfo.fileName
                })
            });
            
            if (!deleteResponse.ok) {
                throw new Error(`刪除失敗: ${deleteResponse.status}`);
            }
            
            const result = await deleteResponse.json();
            console.log('✅ 文件刪除成功:', fileName);
            return result;
            
        } catch (error) {
            console.error('❌ 刪除文件錯誤:', error);
            throw error;
        }
    }
    
    // 5. 讀取 galleries.json
    async readGalleries() {
        console.log('讀取 galleries.json...');
        
        try {
            const response = await fetch(this.downloadBaseUrl + 'galleries.json', {
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('galleries.json 不存在，返回空數組');
                    return [];
                }
                throw new Error(`讀取失敗 (${response.status}): ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`✅ 成功讀取 ${Array.isArray(data) ? data.length : 0} 個圖庫`);
            return data;
            
        } catch (error) {
            console.error('❌ 讀取 galleries.json 錯誤:', error);
            
            // 返回測試數據供開發使用
            console.log('使用測試數據進行開發...');
            return this.getTestGalleries();
        }
    }
    
    // 6. 更新 galleries.json
    async updateGalleries(galleriesData) {
        console.log('更新 galleries.json...');
        console.log('圖庫數量:', galleriesData.length);
        
        const jsonString = JSON.stringify(galleriesData, null, 2);
        const jsonBlob = new Blob([jsonString], { type: 'application/json' });
        const jsonFile = new File([jsonBlob], 'galleries.json');
        
        return await this.uploadFile(jsonFile, 'galleries.json');
    }
    
    // 測試用圖庫數據
    getTestGalleries() {
        return [
            {
                id: 'test-gallery-1',
                name: '測試圖庫 1',
                folderPath: 'galleries/測試圖庫1',
                character: ['甘雨'],
                tags: ['測試', '開發'],
                fileCount: 3,
                imageFiles: ['1.jpg', '2.jpg', '3.jpg']
            },
            {
                id: 'test-gallery-2',
                name: '測試圖庫 2',
                folderPath: 'galleries/測試圖庫2',
                character: ['刻晴'],
                tags: ['測試'],
                fileCount: 2,
                imageFiles: ['a.jpg', 'b.jpg']
            }
        ];
    }
    
    // 7. 測試連接
    async testConnection() {
        try {
            console.log('測試 B2 連接...');
            
            // 測試授權
            await this.authorize();
            console.log('✅ 授權測試通過');
            
            // 測試獲取上傳 URL
            await this.getUploadUrl();
            console.log('✅ 獲取上傳 URL 測試通過');
            
            // 測試下載
            try {
                const response = await fetch(this.downloadBaseUrl + 'galleries.json');
                if (response.ok) {
                    console.log('✅ 下載測試通過');
                } else {
                    console.log('⚠️ galleries.json 不存在（這是正常的）');
                }
            } catch (e) {
                console.log('⚠️ 下載測試失敗:', e.message);
            }
            
            return {
                success: true,
                message: 'B2 連接測試通過！',
                apiUrl: this.apiUrl,
                downloadUrl: this.downloadUrl
            };
            
        } catch (error) {
            console.error('❌ B2 連接測試失敗:', error);
            
            return {
                success: false,
                message: `連接測試失敗: ${error.message}`,
                error: error.toString()
            };
        }
    }
}

// 創建並測試連接
const b2Manager = new B2Manager();

// 添加測試函數到全局
window.testB2Connection = async function() {
    console.clear();
    console.log('=== B2 連接測試開始 ===');
    
    const result = await b2Manager.testConnection();
    
    if (result.success) {
        alert(`✅ B2 連接測試成功！\n\nAPI: ${result.apiUrl}\n下載: ${result.downloadUrl}`);
    } else {
        alert(`❌ B2 連接測試失敗\n\n錯誤: ${result.message}\n\n請檢查控制台查看詳細信息`);
    }
    
    console.log('=== B2 連接測試結束 ===');
    return result;
};

// 自動測試連接（可選）
// window.addEventListener('DOMContentLoaded', () => {
//     setTimeout(() => {
//         console.log('自動測試 B2 連接...');
//         // testB2Connection();
//     }, 1000);
// });