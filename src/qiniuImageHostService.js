const qiniu = require('qiniu');
const fs = require('fs');
const path = require('path');

/**
 * 七牛云图床服务
 * 使用七牛云对象存储作为图床
 */
class QiniuImageHostService {
    constructor(accessKey, secretKey, bucket, domain) {
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.bucket = bucket;
        this.domain = domain; // 七牛云域名，如：http://your-domain.com
        
        // 验证必要参数
        if (!accessKey || !secretKey || !bucket || !domain) {
            throw new Error('七牛云配置不完整：需要accessKey、secretKey、bucket和domain');
        }
        
        // 初始化七牛云配置
        this.mac = new qiniu.auth.digest.Mac(this.accessKey, this.secretKey);
        this.config = new qiniu.conf.Config();
        // 空间对应的机房，华东-z0，华北-z1，华南-z2，北美-na0，东南亚-as0
        this.config.zone = qiniu.zone.Zone_z2; // 华南区域，对应 up-z2.qiniup.com
        this.config.useHttpsDomain = true;
        this.config.useCdnDomain = true;
        
        // 初始化上传管理器
        this.formUploader = new qiniu.form_up.FormUploader(this.config);
        this.putExtra = new qiniu.form_up.PutExtra();
        
        // 初始化存储管理器
        this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
    }
    
    /**
     * 生成上传凭证
     * @param {string} key 文件名
     * @returns {string} 上传凭证
     */
    generateUploadToken(key) {
        const options = {
            scope: key ? `${this.bucket}:${key}` : this.bucket,
            expires: 7200 // 2小时有效期
        };
        const putPolicy = new qiniu.rs.PutPolicy(options);
        return putPolicy.uploadToken(this.mac);
    }
    
    /**
     * 上传base64图片到七牛云
     * @param {string} base64Data base64编码的图片数据
     * @param {string} filename 文件名
     * @returns {Promise<string|null>} 图片URL或null
     */
    async uploadBase64Image(base64Data, filename) {
        try {
            // 清理base64数据，移除data:image/xxx;base64,前缀
            const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
            
            // 生成上传凭证
            const uploadToken = this.generateUploadToken(filename);
            
            return new Promise((resolve, reject) => {
                this.formUploader.put(uploadToken, filename, cleanBase64, this.putExtra, (respErr, respBody, respInfo) => {
                    if (respErr) {
                        console.error('七牛云上传错误:', respErr);
                        resolve(null);
                        return;
                    }
                    
                    if (respInfo.statusCode === 200) {
                        // 上传成功，构建访问URL
                        const domain = this.domain.startsWith('http') ? this.domain : `https://${this.domain}`;
                        const imageUrl = `${domain}/${respBody.key}`;
                        console.log(`图片上传成功: ${imageUrl}`);
                        resolve(imageUrl);
                    } else {
                        console.error('七牛云上传失败:', respInfo.statusCode, respBody);
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('上传图片时发生错误:', error.message);
            return null;
        }
    }
    
    /**
     * 上传本地文件到七牛云
     * @param {string} filePath 本地文件路径
     * @param {string} filename 目标文件名
     * @returns {Promise<string|null>} 图片URL或null
     */
    async uploadFile(filePath, filename) {
        try {
            // 检查文件是否存在
            if (!fs.existsSync(filePath)) {
                throw new Error(`文件不存在: ${filePath}`);
            }
            
            // 生成上传凭证
            const uploadToken = this.generateUploadToken(filename);
            
            return new Promise((resolve, reject) => {
                this.formUploader.putFile(uploadToken, filename, filePath, this.putExtra, (respErr, respBody, respInfo) => {
                    if (respErr) {
                        console.error('七牛云上传错误:', respErr);
                        resolve(null);
                        return;
                    }
                    
                    if (respInfo.statusCode === 200) {
                        // 上传成功，构建访问URL
                        const domain = this.domain.startsWith('http') ? this.domain : `https://${this.domain}`;
                        const imageUrl = `${domain}/${respBody.key}`;
                        console.log(`文件上传成功: ${imageUrl}`);
                        resolve(imageUrl);
                    } else {
                        console.error('七牛云上传失败:', respInfo.statusCode, respBody);
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('上传本地文件时发生错误:', error.message);
            return null;
        }
    }
    
    /**
     * 检查文件是否已存在
     * @param {string} filename 文件名
     * @returns {Promise<boolean>} 是否存在
     */
    async fileExists(filename) {
        try {
            return new Promise((resolve, reject) => {
                this.bucketManager.stat(this.bucket, filename, (err, respBody, respInfo) => {
                    if (err) {
                        resolve(false);
                        return;
                    }
                    
                    if (respInfo.statusCode === 200) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            });
            
        } catch (error) {
            console.error('检查文件存在性时发生错误:', error.message);
            return false;
        }
    }
    
    /**
     * 删除文件
     * @param {string} filename 文件名
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteFile(filename) {
        try {
            return new Promise((resolve, reject) => {
                this.bucketManager.delete(this.bucket, filename, (err, respBody, respInfo) => {
                    if (err) {
                        console.error('删除文件时发生错误:', err);
                        resolve(false);
                        return;
                    }
                    
                    if (respInfo.statusCode === 200) {
                        console.log(`文件删除成功: ${filename}`);
                        resolve(true);
                    } else {
                        console.error('删除文件失败:', respInfo.statusCode, respBody);
                        resolve(false);
                    }
                });
            });
            
        } catch (error) {
            console.error('删除文件时发生错误:', error.message);
            return false;
        }
    }
    
    /**
     * 生成唯一文件名
     * @param {string} originalFilename 原始文件名
     * @param {string} prefix 前缀
     * @returns {string} 唯一文件名
     */
    generateUniqueFilename(originalFilename, prefix = 'img') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const ext = path.extname(originalFilename);
        const basename = path.basename(originalFilename, ext);
        return `${prefix}_${timestamp}_${random}_${basename}${ext}`;
    }
    
    /**
     * 获取存储空间信息
     * @returns {Promise<Object|null>} 存储空间信息
     */
    async getRepositoryInfo() {
        try {
            return new Promise((resolve, reject) => {
                this.bucketManager.getBucketInfo(this.bucket, (err, respBody, respInfo) => {
                    if (err) {
                        console.error('获取存储空间信息时发生错误:', err);
                        resolve(null);
                        return;
                    }
                    
                    if (respInfo.statusCode === 200) {
                        resolve({
                            name: this.bucket,
                            domain: this.domain,
                            region: respBody.region || 'unknown',
                            private: respBody.private || false,
                            createdAt: respBody.tbl || 'unknown'
                        });
                    } else {
                        console.error('获取存储空间信息失败:', respInfo.statusCode, respBody);
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('获取存储空间信息时发生错误:', error.message);
            return null;
        }
    }
    
    /**
     * 列出存储空间中的文件
     * @param {string} prefix 文件前缀，默认为空
     * @param {number} limit 返回数量限制，默认100
     * @returns {Promise<Array|null>} 文件列表
     */
    async listFiles(prefix = '', limit = 100) {
        try {
            return new Promise((resolve, reject) => {
                this.bucketManager.listPrefix(this.bucket, {
                    prefix: prefix,
                    limit: limit
                }, (err, respBody, respInfo) => {
                    if (err) {
                        console.error('列出文件时发生错误:', err);
                        resolve(null);
                        return;
                    }
                    
                    if (respInfo.statusCode === 200) {
                        const files = respBody.items.map(item => ({
                            name: item.key,
                            path: item.key,
                            type: 'file',
                            size: item.fsize,
                            downloadUrl: `${this.domain}/${item.key}`,
                            putTime: new Date(item.putTime / 10000) // 七牛云时间戳是纳秒级
                        }));
                        resolve(files);
                    } else {
                        console.error('列出文件失败:', respInfo.statusCode, respBody);
                        resolve(null);
                    }
                });
            });
            
        } catch (error) {
            console.error('列出文件时发生错误:', error.message);
            return null;
        }
    }
}

module.exports = QiniuImageHostService;