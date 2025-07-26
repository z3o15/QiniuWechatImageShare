const axios = require('axios');

/**
 * 推送Plus服务
 * 用于发送微信推送通知
 */
class PushPlusService {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'http://www.pushplus.plus/send';
        
        if (!token) {
            console.warn('警告: 未配置推送Plus Token，将跳过微信推送');
        }
    }
    
    /**
     * 发送推送消息
     * @param {string} title 消息标题
     * @param {string} content 消息内容
     * @param {string} template 模板类型 (html, txt, json, markdown)
     * @returns {Promise<boolean>} 是否发送成功
     */
    async sendMessage(title, content, template = 'html') {
        if (!this.token) {
            console.log('跳过微信推送: 未配置Token');
            return false;
        }
        
        try {
            // 如果标题是"当天日期"，则使用当天日期作为标题
            let finalTitle = title;
            if (title === '当天日期') {
                const today = new Date();
                finalTitle = today.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).replace(/\//g, '-');
            }
            
            const data = {
                token: this.token,
                title: finalTitle,
                content: content,
                template: template
            };
            
            console.log('正在发送微信推送...');
            
            const response = await axios.post(this.baseUrl, data, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10秒超时
            });
            
            if (response.data && response.data.code === 200) {
                console.log('微信推送发送成功');
                return true;
            } else {
                console.error('微信推送发送失败:', response.data?.msg || '未知错误');
                return false;
            }
            
        } catch (error) {
            console.error('发送微信推送时发生错误:', error.message);
            return false;
        }
    }
    
    /**
     * 发送文件上传成功通知
     * @param {Array} successFiles 成功上传的文件列表
     * @param {Array} failFiles 失败的文件列表
     * @returns {Promise<boolean>} 是否发送成功
     */
    async sendUploadNotification(successFiles, failFiles = []) {
        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // 使用当天日期作为标题
        const title = now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\//g, '-');
        
        let content = '';
        
        if (successFiles.length > 0 && failFiles.length === 0) {
            // 全部成功
            content = this.buildSuccessContent(successFiles, timeStr);
        } else if (successFiles.length === 0 && failFiles.length > 0) {
            // 全部失败
            content = this.buildFailContent(failFiles, timeStr);
        } else if (successFiles.length > 0 && failFiles.length > 0) {
            // 部分成功
            content = this.buildMixedContent(successFiles, failFiles, timeStr);
        } else {
            // 没有文件
            content = this.buildNoFileContent(timeStr);
        }
        
        return await this.sendMessage(title, content, 'html');
    }
    
    /**
     * 使用自定义配置发送推送消息
     * @param {Object} config 推送配置对象
     * @param {string} config.token 推送token（可选，默认使用实例token）
     * @param {string} config.title 消息标题
     * @param {string} config.content 消息内容（支持HTML格式）
     * @param {string} config.template 模板类型（可选，默认html）
     * @returns {Promise<boolean>} 是否发送成功
     */
    async sendCustomMessage(config) {
        const token = config.token || this.token;
        
        if (!token) {
            console.log('跳过微信推送: 未配置Token');
            return false;
        }
        
        try {
            // 处理标题
            let finalTitle = config.title;
            if (config.title === '当天日期') {
                const today = new Date();
                finalTitle = today.toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).replace(/\//g, '-');
            }
            
            const data = {
                token: token,
                title: finalTitle,
                content: config.content,
                template: config.template || 'html'
            };
            
            console.log('正在发送自定义微信推送...');
            console.log('推送配置:', {
                title: finalTitle,
                contentLength: config.content.length,
                template: data.template
            });
            
            const response = await axios.post(this.baseUrl, data, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10秒超时
            });
            
            if (response.data && response.data.code === 200) {
                console.log('自定义微信推送发送成功');
                return true;
            } else {
                console.error('自定义微信推送发送失败:', response.data?.msg || '未知错误');
                return false;
            }
            
        } catch (error) {
            console.error('发送自定义微信推送时发生错误:', error.message);
            return false;
        }
    }
    
    /**
     * 构建成功上传的消息内容
     * @param {Array} successFiles 成功的文件列表
     * @param {string} timeStr 时间字符串
     * @returns {string} HTML格式的消息内容
     */
    buildSuccessContent(successFiles, timeStr) {
        let content = '';
        
        successFiles.forEach(file => {
            // 检查是否为图片文件
            const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.file);
            
            if (isImage) {
                content += `<br/><img src='${file.url}' />\n`;
            }
        });
        
        return content;
    }
    
    /**
     * 构建失败上传的消息内容
     * @param {Array} failFiles 失败的文件列表
     * @param {string} timeStr 时间字符串
     * @returns {string} HTML格式的消息内容
     */
    buildFailContent(failFiles, timeStr) {
        let content = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h3 style="color: #dc3545; margin-bottom: 15px;">❌ 文件上传失败</h3>
            <p><strong>检查时间:</strong> ${timeStr}</p>
            <p><strong>失败数量:</strong> ${failFiles.length} 个文件</p>
            
            <h4 style="color: #495057; margin-top: 20px;">📁 失败文件列表:</h4>
            <ul style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #dc3545;">
        `;
        
        failFiles.forEach(file => {
            content += `<li style="margin: 5px 0;"><strong>${file.file}</strong></li>`;
        });
        
        content += `
            </ul>
            <p style="color: #721c24; background: #f5c6cb; padding: 10px; border-radius: 5px; margin-top: 15px;">
                🔧 <strong>可能的解决方案:</strong><br>
                • 检查网络连接<br>
                • 确认GitHub Token权限<br>
                • 检查文件大小是否超过25MB<br>
                • 查看控制台日志获取详细错误信息
            </p>
        </div>
        `;
        
        return content;
    }
    
    /**
     * 构建混合结果的消息内容
     * @param {Array} successFiles 成功的文件列表
     * @param {Array} failFiles 失败的文件列表
     * @param {string} timeStr 时间字符串
     * @returns {string} HTML格式的消息内容
     */
    buildMixedContent(successFiles, failFiles, timeStr) {
        let content = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h3 style="color: #ffc107; margin-bottom: 15px;">⚠️ 文件上传完成（部分成功）</h3>
            <p><strong>上传时间:</strong> ${timeStr}</p>
            <p><strong>成功:</strong> ${successFiles.length} 个 | <strong>失败:</strong> ${failFiles.length} 个</p>
        `;
        
        // 成功的文件
        if (successFiles.length > 0) {
            content += `
            <h4 style="color: #28a745; margin-top: 20px;">✅ 成功上传:</h4>
            <ul style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #28a745;">
            `;
            
            successFiles.forEach(file => {
                // 检查是否为图片文件
                const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.file);
                
                if (isImage) {
                    content += `<br/><img src='${file.url}' />\n`;
                }
            });
            
            content += `</ul>`;
        }
        
        // 失败的文件
        if (failFiles.length > 0) {
            content += `
            <h4 style="color: #dc3545; margin-top: 20px;">❌ 上传失败:</h4>
            <ul style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #dc3545;">
            `;
            
            failFiles.forEach(file => {
                content += `<li style="margin: 5px 0;"><strong>${file.file}</strong></li>`;
            });
            
            content += `</ul>`;
        }
        
        content += `</div>`;
        
        return content;
    }
    
    /**
     * 构建无文件的消息内容
     * @param {string} timeStr 时间字符串
     * @returns {string} HTML格式的消息内容
     */
    buildNoFileContent(timeStr) {
        return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h3 style="color: #6c757d; margin-bottom: 15px;">📋 自动上传检查</h3>
            <p><strong>检查时间:</strong> ${timeStr}</p>
            <p style="color: #6c757d;">未找到符合条件的meet文件</p>
            
            <div style="background: #e9ecef; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <p style="margin: 0; color: #495057;">
                    <strong>📝 文件命名规则:</strong><br>
                    文件名需要以 <code>meet</code> 开始，以当天日期 <code>YYYYMMDD</code> 结束<br>
                    例如: <code>meet-会议记录20241220.pdf</code>
                </p>
            </div>
        </div>
        `;
    }
    
    /**
     * 发送服务启动通知
     * @returns {Promise<boolean>} 是否发送成功
     */
    async sendStartupNotification() {
        const title = '🚀 自动上传服务启动';
        const content = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h3 style="color: #007bff; margin-bottom: 15px;">🚀 服务启动成功</h3>
            <p><strong>启动时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
            <p><strong>执行计划:</strong> 每天上午 9:00</p>
            <p><strong>监控目录:</strong> 桌面文件夹</p>
            
            <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #007bff;">
                <p style="margin: 0; color: #004085;">
                    <strong>📋 功能说明:</strong><br>
                    • 自动检查桌面文件夹中的meet文件<br>
                    • 文件名格式: meet*YYYYMMDD.*<br>
                    • 自动上传到GitHub图床<br>
                    • 微信推送上传结果
                </p>
            </div>
            
            <p style="color: #6c757d; font-size: 0.9em;">
                💡 服务将在后台持续运行，请保持程序开启
            </p>
        </div>
        `;
        
        return await this.sendMessage(title, content, 'html');
    }
}

module.exports = PushPlusService;