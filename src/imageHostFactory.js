const GitHubImageHostService = require('./githubImageHostService');
const QiniuImageHostService = require('./qiniuImageHostService');

/**
 * 图床服务工厂类
 * 根据配置选择使用GitHub或七牛云图床服务
 */
class ImageHostFactory {
    /**
     * 创建图床服务实例
     * @param {string} provider 服务提供商：'github' 或 'qiniu'
     * @param {Object} config 配置对象
     * @returns {GitHubImageHostService|QiniuImageHostService} 图床服务实例
     */
    static createService(provider, config) {
        switch (provider.toLowerCase()) {
            case 'github':
                return new GitHubImageHostService(
                    config.token,
                    config.username,
                    config.repository
                );
                
            case 'qiniu':
                return new QiniuImageHostService(
                    config.accessKey,
                    config.secretKey,
                    config.bucket,
                    config.domain
                );
                
            default:
                throw new Error(`不支持的图床服务提供商: ${provider}`);
        }
    }
    
    /**
     * 从环境变量创建图床服务
     * @returns {GitHubImageHostService|QiniuImageHostService} 图床服务实例
     */
    static createFromEnv() {
        // 优先检查七牛云配置（排除占位符值）
        if (process.env.QINIU_ACCESS_KEY && 
            process.env.QINIU_SECRET_KEY && 
            process.env.QINIU_BUCKET && 
            process.env.QINIU_DOMAIN &&
            !process.env.QINIU_ACCESS_KEY.startsWith('your_') &&
            !process.env.QINIU_SECRET_KEY.startsWith('your_') &&
            !process.env.QINIU_BUCKET.startsWith('your_') &&
            !process.env.QINIU_DOMAIN.startsWith('your_')) {
            
            console.log('✅ 检测到七牛云配置，使用七牛云图床服务');
            return ImageHostFactory.createService('qiniu', {
                accessKey: process.env.QINIU_ACCESS_KEY,
                secretKey: process.env.QINIU_SECRET_KEY,
                bucket: process.env.QINIU_BUCKET,
                domain: process.env.QINIU_DOMAIN
            });
        }
        
        // 检查GitHub配置
        if (process.env.GITHUB_TOKEN && 
            process.env.GITHUB_USERNAME && 
            process.env.GITHUB_REPOSITORY) {
            
            console.log('✅ 检测到GitHub配置，使用GitHub图床服务');
            return ImageHostFactory.createService('github', {
                token: process.env.GITHUB_TOKEN,
                username: process.env.GITHUB_USERNAME,
                repository: process.env.GITHUB_REPOSITORY
            });
        }
        
        throw new Error('未找到有效的图床服务配置，请检查环境变量');
    }
    
    /**
     * 获取当前配置的服务提供商
     * @returns {string} 服务提供商名称
     */
    static getCurrentProvider() {
        if (process.env.QINIU_ACCESS_KEY && 
            process.env.QINIU_SECRET_KEY && 
            process.env.QINIU_BUCKET && 
            process.env.QINIU_DOMAIN &&
            !process.env.QINIU_ACCESS_KEY.startsWith('your_') &&
            !process.env.QINIU_SECRET_KEY.startsWith('your_') &&
            !process.env.QINIU_BUCKET.startsWith('your_') &&
            !process.env.QINIU_DOMAIN.startsWith('your_')) {
            return 'qiniu';
        }
        
        if (process.env.GITHUB_TOKEN && 
            process.env.GITHUB_USERNAME && 
            process.env.GITHUB_REPOSITORY) {
            return 'github';
        }
        
        return 'none';
    }
    
    /**
     * 检查配置完整性
     * @returns {Object} 配置检查结果
     */
    static checkConfig() {
        const result = {
            github: {
                configured: false,
                missing: []
            },
            qiniu: {
                configured: false,
                missing: []
            },
            current: 'none'
        };
        
        // 检查GitHub配置
        const githubRequired = ['GITHUB_TOKEN', 'GITHUB_USERNAME', 'GITHUB_REPOSITORY'];
        const githubMissing = githubRequired.filter(key => !process.env[key]);
        result.github.configured = githubMissing.length === 0;
        result.github.missing = githubMissing;
        
        // 检查七牛云配置（排除占位符值）
        const qiniuRequired = ['QINIU_ACCESS_KEY', 'QINIU_SECRET_KEY', 'QINIU_BUCKET', 'QINIU_DOMAIN'];
        const qiniuMissing = qiniuRequired.filter(key => 
            !process.env[key] || process.env[key].startsWith('your_')
        );
        result.qiniu.configured = qiniuMissing.length === 0;
        result.qiniu.missing = qiniuMissing.map(key => 
            process.env[key] && process.env[key].startsWith('your_') ? `${key} (占位符值)` : key
        );
        
        // 确定当前使用的服务
        result.current = ImageHostFactory.getCurrentProvider();
        
        return result;
    }
}

module.exports = ImageHostFactory;