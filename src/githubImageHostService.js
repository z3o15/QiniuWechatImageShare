const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * GitHub图床服务
 * 使用GitHub仓库作为图床存储
 */
class GitHubImageHostService {
    constructor(token, username, repository) {
        this.token = token;
        this.username = username;
        this.repository = repository;
        this.baseUrl = 'https://api.github.com';
        
        // 验证必要参数
        if (!token || !username || !repository) {
            throw new Error('GitHub配置不完整：需要token、username和repository');
        }
    }
    
    /**
     * 上传base64图片到GitHub仓库
     * @param {string} base64Data base64编码的图片数据
     * @param {string} filename 文件名
     * @returns {Promise<string|null>} 图片URL或null
     */
    async uploadBase64Image(base64Data, filename) {
        try {
            // 清理base64数据，移除data:image/xxx;base64,前缀
            const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
            
            // 构建API URL
            const apiUrl = `${this.baseUrl}/repos/${this.username}/${this.repository}/contents/${filename}`;
            
            // 准备请求数据
            const requestData = {
                message: `Upload image: ${filename}`,
                content: cleanBase64,
                branch: 'main' // 或者 'master'，根据仓库默认分支
            };
            
            // 发送请求
            const response = await axios.put(apiUrl, requestData, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.status === 201) {
                // 上传成功，返回文件的下载URL
                const downloadUrl = response.data.content.download_url;
                console.log(`图片上传成功: ${downloadUrl}`);
                return downloadUrl;
            } else {
                console.error('图片上传失败:', response.status, response.statusText);
                return null;
            }
            
        } catch (error) {
            console.error('上传图片时发生错误:', error.response?.data || error.message);
            return null;
        }
    }
    
    /**
     * 上传本地文件到GitHub仓库
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
            
            // 读取文件并转换为base64
            const fileBuffer = fs.readFileSync(filePath);
            const base64Data = fileBuffer.toString('base64');
            
            return await this.uploadBase64Image(base64Data, filename);
            
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
            const apiUrl = `${this.baseUrl}/repos/${this.username}/${this.repository}/contents/${filename}`;
            
            const response = await axios.get(apiUrl, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            return response.status === 200;
            
        } catch (error) {
            if (error.response?.status === 404) {
                return false;
            }
            console.error('检查文件存在性时发生错误:', error.response?.data || error.message);
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
            // 首先获取文件信息以获取SHA
            const getUrl = `${this.baseUrl}/repos/${this.username}/${this.repository}/contents/${filename}`;
            const getResponse = await axios.get(getUrl, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            const sha = getResponse.data.sha;
            
            // 删除文件
            const deleteUrl = `${this.baseUrl}/repos/${this.username}/${this.repository}/contents/${filename}`;
            const deleteResponse = await axios.delete(deleteUrl, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                data: {
                    message: `Delete image: ${filename}`,
                    sha: sha,
                    branch: 'main'
                }
            });
            
            return deleteResponse.status === 200;
            
        } catch (error) {
            console.error('删除文件时发生错误:', error.response?.data || error.message);
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
        // 避免使用可能冲突的路径，直接在根目录生成文件
        return `${prefix}_${timestamp}_${random}_${basename}${ext}`;
    }
    
    /**
     * 获取仓库信息
     * @returns {Promise<Object|null>} 仓库信息
     */
    async getRepositoryInfo() {
        try {
            const apiUrl = `${this.baseUrl}/repos/${this.username}/${this.repository}`;
            const response = await axios.get(apiUrl, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            return {
                name: response.data.name,
                fullName: response.data.full_name,
                private: response.data.private,
                size: response.data.size,
                defaultBranch: response.data.default_branch,
                createdAt: response.data.created_at,
                updatedAt: response.data.updated_at
            };
            
        } catch (error) {
            console.error('获取仓库信息时发生错误:', error.response?.data || error.message);
            return null;
        }
    }
    
    /**
     * 列出仓库中的文件
     * @param {string} path 路径，默认为根目录
     * @returns {Promise<Array|null>} 文件列表
     */
    async listFiles(path = '') {
        try {
            const apiUrl = `${this.baseUrl}/repos/${this.username}/${this.repository}/contents/${path}`;
            const response = await axios.get(apiUrl, {
                headers: {
                    'Authorization': `token ${this.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            return response.data.map(item => ({
                name: item.name,
                path: item.path,
                type: item.type,
                size: item.size,
                downloadUrl: item.download_url
            }));
            
        } catch (error) {
            console.error('列出文件时发生错误:', error.response?.data || error.message);
            return null;
        }
    }
}

module.exports = GitHubImageHostService;
