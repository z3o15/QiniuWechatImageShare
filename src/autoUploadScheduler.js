const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const notifier = require('node-notifier');
const GitHubImageHostService = require('./githubImageHostService');
const PushPlusService = require('./pushPlusService');
require('dotenv').config();

/**
 * 自动上传调度器
 * 支持两种模式：
 * 1. 正式模式：每天9-10点检查桌面文件夹中以meet开始、当天日期结束的文件
 * 2. 测试模式：持续检测桌面文件变化
 * 自动上传到GitHub图床并发送通知
 */
class AutoUploadScheduler {
    constructor(imageHost, pushPlus) {
        // 使用传入的服务实例
        this.imageHost = imageHost || new GitHubImageHostService(
            process.env.GITHUB_TOKEN,
            process.env.GITHUB_USERNAME,
            process.env.GITHUB_REPOSITORY
        );
        
        this.pushPlus = pushPlus || new PushPlusService(process.env.PUSHPLUS_TOKEN);
        
        // 获取桌面路径
        this.desktopPath = path.join(os.homedir(), 'Desktop');
        
        // 调度器状态
        this.cronJob = null;
        this.testModeInterval = null;
        this.isRunning = false;
        this.currentMode = 'production';
        
        console.log(`桌面路径: ${this.desktopPath}`);
        console.log(`推送Plus: ${process.env.PUSHPLUS_TOKEN ? '已配置' : '未配置'}`);
    }
    
    /**
     * 获取当天日期字符串 (格式: YYYYMMDD)
     * @returns {string} 当天日期
     */
    getTodayDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }
    
    /**
     * 检查文件名是否符合条件
     * @param {string} filename 文件名
     * @returns {boolean} 是否符合条件
     */
    isTargetFile(filename) {
        const todayDate = this.getTodayDateString();
        // 检查文件名是否以meet开始并以当天日期结束
        const pattern = new RegExp(`^meet.*${todayDate}\\.[^.]+$`, 'i');
        return pattern.test(filename);
    }
    
    /**
     * 扫描桌面文件夹，查找符合条件的文件
     * @returns {Array} 符合条件的文件路径列表
     */
    scanDesktopFiles() {
        try {
            if (!fs.existsSync(this.desktopPath)) {
                console.log('桌面文件夹不存在');
                return [];
            }
            
            const files = fs.readdirSync(this.desktopPath);
            const targetFiles = [];
            
            for (const file of files) {
                const filePath = path.join(this.desktopPath, file);
                const stat = fs.statSync(filePath);
                
                // 只处理文件，跳过文件夹
                if (stat.isFile() && this.isTargetFile(file)) {
                    targetFiles.push({
                        name: file,
                        path: filePath,
                        size: stat.size
                    });
                }
            }
            
            return targetFiles;
        } catch (error) {
            console.error('扫描桌面文件时发生错误:', error.message);
            return [];
        }
    }
    
    /**
     * 生成HTML文件
     * @param {Array} successFiles 成功上传的文件列表
     * @returns {Promise<boolean>} 生成是否成功
     */
    async generateHtmlFile(successFiles) {
        try {
            const imageDir = path.join(__dirname, '../image');
            
            // 确保image目录存在
            if (!fs.existsSync(imageDir)) {
                fs.mkdirSync(imageDir, { recursive: true });
                console.log(`创建image目录: ${imageDir}`);
            }
            
            // 生成当天日期作为文件名
            const today = new Date();
            const dateStr = today.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, '-');
            
            const htmlFilename = `${dateStr}.html`;
            const htmlFilePath = path.join(imageDir, htmlFilename);
            
            // 生成HTML内容
            let htmlContent = '';
            successFiles.forEach(file => {
                // 检查是否为图片文件
                const isImage = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.file);
                
                if (isImage) {
                    htmlContent += `<br/><img src='${file.url}' />\n`;
                }
            });
            
            // 如果文件已存在，追加内容；否则创建新文件
            if (fs.existsSync(htmlFilePath)) {
                fs.appendFileSync(htmlFilePath, htmlContent, 'utf8');
                console.log(`HTML内容已追加到文件: ${htmlFilename}`);
            } else {
                fs.writeFileSync(htmlFilePath, htmlContent, 'utf8');
                console.log(`HTML文件已创建: ${htmlFilename}`);
            }
            
            return true;
        } catch (error) {
            console.error('生成HTML文件时发生错误:', error.message);
            return false;
        }
    }
    
    /**
     * 移动文件到备份目录
     * @param {string} sourcePath 源文件路径
     * @param {string} filename 文件名
     * @returns {Promise<boolean>} 移动是否成功
     */
    async moveFileToBackup(sourcePath, filename) {
        try {
            const backupDir = path.join(__dirname, '../image');
            
            // 确保备份目录存在
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
                console.log(`创建备份目录: ${backupDir}`);
            }
            
            const targetPath = path.join(backupDir, filename);
            
            // 如果目标文件已存在，添加时间戳避免冲突
            let finalTargetPath = targetPath;
            if (fs.existsSync(targetPath)) {
                const ext = path.extname(filename);
                const nameWithoutExt = path.basename(filename, ext);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                finalTargetPath = path.join(backupDir, `${nameWithoutExt}_${timestamp}${ext}`);
            }
            
            // 移动文件（使用复制+删除方式，避免跨设备链接问题）
            fs.copyFileSync(sourcePath, finalTargetPath);
            fs.unlinkSync(sourcePath);
            console.log(`文件已移动到备份目录: ${filename} -> ${path.basename(finalTargetPath)}`);
            
            return true;
        } catch (error) {
            console.error(`移动文件 ${filename} 到备份目录时发生错误:`, error.message);
            return false;
        }
    }

    /**
     * 上传文件到GitHub图床
     * @param {Object} fileInfo 文件信息
     * @returns {Promise<Object>} 上传结果 {url: string|null, moved: boolean}
     */
    async uploadFile(fileInfo) {
        try {
            // 生成唯一文件名
            const uniqueFilename = this.imageHost.generateUniqueFilename(fileInfo.name, 'meet-files');
            
            console.log(`正在上传文件: ${fileInfo.name} -> ${uniqueFilename}`);
            
            // 上传文件
            const uploadUrl = await this.imageHost.uploadFile(fileInfo.path, uniqueFilename);
            
            if (uploadUrl) {
                console.log(`文件上传成功: ${uploadUrl}`);
                
                // 上传成功后移动文件到备份目录
                const moved = await this.moveFileToBackup(fileInfo.path, fileInfo.name);
                
                return {
                    url: uploadUrl,
                    moved: moved
                };
            } else {
                console.error(`文件上传失败: ${fileInfo.name}`);
                return {
                    url: null,
                    moved: false
                };
            }
        } catch (error) {
            console.error(`上传文件 ${fileInfo.name} 时发生错误:`, error.message);
            return {
                url: null,
                moved: false
            };
        }
    }
    
    /**
     * 发送通知
     * @param {string} title 通知标题
     * @param {string} message 通知内容
     * @param {string} type 通知类型 (success, error, info)
     */
    sendNotification(title, message, type = 'info') {
        const iconMap = {
            success: path.join(__dirname, '../assets/success.ico'),
            error: path.join(__dirname, '../assets/error.ico'),
            info: path.join(__dirname, '../assets/info.ico')
        };
        
        notifier.notify({
            title: title,
            message: message,
            icon: iconMap[type] || iconMap.info,
            sound: true,
            wait: false,
            timeout: 10
        });
    }
    
    /**
     * 执行自动上传任务
     */
    async executeUploadTask() {
        console.log('\n=== 开始执行自动上传任务 ===');
        console.log(`执行时间: ${new Date().toLocaleString()}`);
        
        try {
            // 扫描桌面文件
            const targetFiles = this.scanDesktopFiles();
            
            if (targetFiles.length === 0) {
                console.log('未找到符合条件的文件');
                this.sendNotification(
                    '自动上传检查',
                    '未找到符合条件的meet文件',
                    'info'
                );
                return;
            }
            
            console.log(`找到 ${targetFiles.length} 个符合条件的文件:`);
            targetFiles.forEach(file => {
                console.log(`- ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
            });
            
            // 上传文件
            const uploadResults = [];
            for (const file of targetFiles) {
                const uploadResult = await this.uploadFile(file);
                uploadResults.push({
                    file: file.name,
                    success: !!uploadResult.url,
                    url: uploadResult.url,
                    moved: uploadResult.moved
                });
            }
            
            // 统计结果
            const successCount = uploadResults.filter(r => r.success).length;
            const failCount = uploadResults.length - successCount;
            
            console.log(`\n上传完成: 成功 ${successCount} 个，失败 ${failCount} 个`);
            
            // 发送通知
            const successFiles = uploadResults.filter(r => r.success);
            const failFiles = uploadResults.filter(r => !r.success);
            
            // 发送系统通知
            if (successCount > 0) {
                const movedCount = successFiles.filter(r => r.moved).length;
                const message = `成功上传 ${successCount} 个文件，已移动 ${movedCount} 个到备份目录:\n${successFiles.map(r => `${r.file}${r.moved ? ' ✓' : ' (移动失败)'}`).join('\n')}`;
                this.sendNotification('文件上传成功', message, 'success');
                
                // 输出上传链接和移动状态
                console.log('\n上传结果:');
                successFiles.forEach(result => {
                    console.log(`${result.file}: ${result.url} ${result.moved ? '(已移动到备份目录)' : '(移动失败)'}`);
                });
            }
            
            if (failCount > 0) {
                const message = `${failCount} 个文件上传失败:\n${failFiles.map(r => r.file).join('\n')}`;
                this.sendNotification('文件上传失败', message, 'error');
            }
            
            // 发送微信推送
            const pushSuccess = await this.pushPlus.sendUploadNotification(successFiles, failFiles);
            
            // 如果推送成功且有成功上传的文件，生成HTML文件
            if (pushSuccess && successFiles.length > 0) {
                await this.generateHtmlFile(successFiles);
            }
            
        } catch (error) {
            console.error('执行自动上传任务时发生错误:', error.message);
            this.sendNotification(
                '自动上传错误',
                `任务执行失败: ${error.message}`,
                'error'
            );
            
            // 发送错误推送
            await this.pushPlus.sendMessage(
                '❌ 自动上传服务错误',
                `<div style="color: #dc3545;"><strong>错误时间:</strong> ${new Date().toLocaleString('zh-CN')}<br><strong>错误信息:</strong> ${error.message}</div>`,
                'html'
            );
        }
        
        console.log('=== 自动上传任务完成 ===\n');
    }
    
    /**
     * 启动定时任务（正式模式）
     */
    async start() {
        this.stop(); // 先停止现有任务
        
        console.log('启动自动上传调度器（正式模式）...');
        console.log('定时任务: 每天上午9:00-10:00之间随机执行');
        console.log(`监控目录: ${this.desktopPath}`);
        console.log(`文件模式: meet*${this.getTodayDateString()}.*`);
        
        // 每天上午9点到10点之间随机执行
        this.cronJob = cron.schedule('0 9-10 * * *', () => {
            // 在9-10点之间随机延迟0-60分钟执行
            const randomDelay = Math.floor(Math.random() * 60) * 60 * 1000; // 0-60分钟
            setTimeout(() => {
                this.executeUploadTask();
            }, randomDelay);
        }, {
            scheduled: true,
            timezone: 'Asia/Shanghai'
        });
        
        this.isRunning = true;
        this.currentMode = 'production';
        
        console.log('正式模式定时任务已启动！');
        
        // 发送启动通知
        this.sendNotification(
            '自动上传服务启动（正式模式）',
            '每天9-10点自动检查并上传meet文件',
            'info'
        );
        
        // 发送微信推送启动通知
        await this.pushPlus.sendStartupNotification();
    }
    
    /**
     * 启动测试模式（持续检测）
     */
    async startTestMode() {
        this.stop(); // 先停止现有任务
        
        console.log('启动自动上传调度器（测试模式）...');
        console.log('检测频率: 每30秒检测一次');
        console.log(`监控目录: ${this.desktopPath}`);
        console.log(`文件模式: meet*${this.getTodayDateString()}.*`);
        
        // 每30秒检测一次
        this.testModeInterval = setInterval(() => {
            this.executeUploadTask();
        }, 30000); // 30秒
        
        this.isRunning = true;
        this.currentMode = 'test';
        
        console.log('测试模式已启动！');
        
        // 发送启动通知
        this.sendNotification(
            '自动上传服务启动（测试模式）',
            '每30秒检测并上传meet文件',
            'info'
        );
        
        // 立即执行一次
        setTimeout(() => {
            this.executeUploadTask();
        }, 5000); // 5秒后执行第一次
    }
    
    /**
     * 停止调度器
     */
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('正式模式定时任务已停止');
        }
        
        if (this.testModeInterval) {
            clearInterval(this.testModeInterval);
            this.testModeInterval = null;
            console.log('测试模式检测已停止');
        }
        
        this.isRunning = false;
        
        // 发送停止通知
        this.sendNotification(
            '自动上传服务已停止',
            `${this.currentMode === 'test' ? '测试模式' : '正式模式'}已停止运行`,
            'info'
        );
    }
    
    /**
     * 获取调度器状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            mode: this.currentMode,
            hasProductionJob: !!this.cronJob,
            hasTestInterval: !!this.testModeInterval
        };
    }
    
    /**
     * 手动执行一次任务（用于测试）
     */
    async runOnce() {
        console.log('手动执行一次上传任务...');
        await this.executeUploadTask();
    }
}

module.exports = AutoUploadScheduler;