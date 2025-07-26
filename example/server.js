const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const ImageHostFactory = require('../src/imageHostFactory');
const PushPlusService = require('../src/pushPlusService');

// 简单的历史记录存储
let uploadHistory = [];
const MAX_HISTORY_RECORDS = 100;

// 检测模式状态
let currentMode = 'production'; // 'test' 或 'production'
let autoUploadScheduler = null;

// 添加历史记录
function addToHistory(record) {
    record.timestamp = new Date().toISOString();
    record.id = Date.now().toString();
    uploadHistory.unshift(record);
    
    // 保持最大记录数
    if (uploadHistory.length > MAX_HISTORY_RECORDS) {
        uploadHistory = uploadHistory.slice(0, MAX_HISTORY_RECORDS);
    }
}

const app = express();
const PORT = process.env.PORT || 3005;

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 初始化图床服务（自动选择GitHub或七牛云）
let imageHostService = null;
let currentProvider = 'none';

try {
    const configCheck = ImageHostFactory.checkConfig();
    console.log('📋 图床服务配置检查:');
    console.log(`   七牛云: ${configCheck.qiniu.configured ? '✅ 已配置' : '❌ 未配置'}`);
    console.log(`   GitHub: ${configCheck.github.configured ? '✅ 已配置' : '❌ 未配置'}`);
    
    if (configCheck.current !== 'none') {
        imageHostService = ImageHostFactory.createFromEnv();
        currentProvider = configCheck.current;
        console.log(`🚀 当前使用: ${currentProvider === 'qiniu' ? '七牛云' : 'GitHub'}图床服务`);
    } else {
        console.warn('⚠️  未找到有效的图床服务配置，请检查.env文件');
        if (configCheck.qiniu.missing.length > 0) {
            console.warn(`   七牛云缺少: ${configCheck.qiniu.missing.join(', ')}`);
        }
        if (configCheck.github.missing.length > 0) {
            console.warn(`   GitHub缺少: ${configCheck.github.missing.join(', ')}`);
        }
    }
} catch (error) {
    console.error('❌ 图床服务初始化失败:', error.message);
}

// 初始化推送Plus服务
let pushPlusService = null;
if (process.env.PUSHPLUS_TOKEN) {
    pushPlusService = new PushPlusService(process.env.PUSHPLUS_TOKEN);
    console.log('✅ 推送Plus服务已配置');
} else {
    console.log('⚠️  推送Plus服务未配置');
}

// 初始化自动上传调度器（但不自动启动，避免与独立调度器冲突）
if (imageHostService && pushPlusService) {
    const AutoUploadScheduler = require('../src/autoUploadScheduler');
    autoUploadScheduler = new AutoUploadScheduler(imageHostService, pushPlusService);
    // 注释掉自动启动，避免与 start-scheduler.bat 中的调度器重复推送
    // autoUploadScheduler.start(); // 默认启动正式模式
    console.log('✅ 自动上传调度器已初始化（通过API控制启动）');
}

// 健康检查接口
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: `${currentProvider === 'qiniu' ? '七牛云' : 'GitHub'} Image Host`,
        provider: currentProvider,
        timestamp: new Date().toISOString(),
        configured: !!imageHostService
    });
});

// 获取存储服务信息
app.get('/api/repository-info', async (req, res) => {
    try {
        if (!imageHostService) {
            return res.status(503).json({ error: '图床服务未配置' });
        }
        
        const info = await imageHostService.getRepositoryInfo();
        if (info) {
            res.json({ 
                success: true, 
                data: { 
                    ...info, 
                    provider: currentProvider 
                } 
            });
        } else {
            res.status(500).json({ error: '获取存储服务信息失败' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 上传base64图片
app.post('/api/upload-base64', async (req, res) => {
    try {
        if (!imageHostService) {
            return res.status(503).json({ error: '图床服务未配置' });
        }
        
        const { base64Data, filename, prefix } = req.body;
        
        if (!base64Data) {
            return res.status(400).json({ error: '缺少图片数据' });
        }
        
        // 生成唯一文件名
        const originalFilename = filename || 'image.jpg';
        const uniqueFilename = imageHostService.generateUniqueFilename(originalFilename, prefix);
        
        // 检查文件是否已存在
        const exists = await imageHostService.fileExists(uniqueFilename);
        if (exists) {
            return res.status(409).json({ error: '文件已存在' });
        }
        
        // 上传图片
        const imageUrl = await imageHostService.uploadBase64Image(base64Data, uniqueFilename);
        
        if (imageUrl) {
            // 添加到历史记录
            addToHistory({
                type: 'base64_upload',
                filename: uniqueFilename,
                originalFilename: originalFilename,
                status: 'success',
                url: imageUrl,
                method: 'manual'
            });
            
            res.json({
                success: true,
                url: imageUrl,
                filename: uniqueFilename,
                message: '图片上传成功'
            });
        } else {
            // 添加失败记录
            addToHistory({
                type: 'base64_upload',
                filename: uniqueFilename,
                originalFilename: originalFilename,
                status: 'failed',
                error: '图片上传失败',
                method: 'manual'
            });
            
            res.status(500).json({ error: '图片上传失败' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 上传本地文件
app.post('/api/upload-file', async (req, res) => {
    try {
        if (!imageHostService) {
            return res.status(503).json({ error: '图床服务未配置' });
        }
        
        const { filePath, filename, prefix } = req.body;
        
        if (!filePath) {
            return res.status(400).json({ error: '缺少文件路径' });
        }
        
        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: '本地文件不存在' });
        }
        
        // 生成唯一文件名
        const originalFilename = filename || path.basename(filePath);
        const uniqueFilename = imageHostService.generateUniqueFilename(originalFilename, prefix);
        
        // 上传文件
        const imageUrl = await imageHostService.uploadFile(filePath, uniqueFilename);
        
        if (imageUrl) {
            res.json({
                success: true,
                url: imageUrl,
                filename: uniqueFilename,
                message: '文件上传成功'
            });
        } else {
            res.status(500).json({ error: '文件上传失败' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 检查文件是否存在
app.get('/api/file-exists/:filename', async (req, res) => {
    try {
        if (!imageHostService) {
            return res.status(503).json({ error: '图床服务未配置' });
        }
        
        const { filename } = req.params;
        const exists = await imageHostService.fileExists(filename);
        
        res.json({
            success: true,
            filename: filename,
            exists: exists
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 删除文件
app.delete('/api/delete/:filename', async (req, res) => {
    try {
        if (!imageHostService) {
            return res.status(503).json({ error: '图床服务未配置' });
        }
        
        const { filename } = req.params;
        const deleted = await imageHostService.deleteFile(filename);
        
        if (deleted) {
            res.json({
                success: true,
                filename: filename,
                message: '文件删除成功'
            });
        } else {
            res.status(500).json({ error: '文件删除失败' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 列出文件
app.get('/api/files', async (req, res) => {
    try {
        if (!imageHostService) {
            return res.status(503).json({ error: '图床服务未配置' });
        }
        
        const { path } = req.query;
        const files = await imageHostService.listFiles(path);
        
        if (files) {
            res.json({
                success: true,
                path: path,
                files: files
            });
        } else {
            res.status(500).json({ error: '获取文件列表失败' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 扫描桌面文件
app.get('/api/scan-desktop', (req, res) => {
    try {
        const os = require('os');
        const desktopPath = path.join(os.homedir(), 'Desktop');
        
        if (!fs.existsSync(desktopPath)) {
            return res.status(404).json({ error: '桌面目录不存在' });
        }
        
        // 获取当天日期字符串
        const today = new Date();
        const todayDate = today.getFullYear() + 
                         String(today.getMonth() + 1).padStart(2, '0') + 
                         String(today.getDate()).padStart(2, '0');
        
        // 检查文件是否为目标文件（meet开头，当天日期结尾）
        const isTargetFile = (filename) => {
            const regex = new RegExp(`^meet.*${todayDate}\\.[^.]+$`);
            return regex.test(filename);
        };
        
        const files = fs.readdirSync(desktopPath);
        const targetFiles = files.filter(file => {
            const filePath = path.join(desktopPath, file);
            const stats = fs.statSync(filePath);
            // 只处理文件，跳过文件夹，并且必须是目标文件
            return stats.isFile() && isTargetFile(file);
        }).map(file => {
            const filePath = path.join(desktopPath, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                path: filePath,
                size: stats.size,
                modified: stats.mtime
            };
        });
        
        res.json({
            success: true,
            desktopPath: desktopPath,
            files: targetFiles,
            count: targetFiles.length,
            dateFilter: todayDate
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 批量上传桌面文件
app.post('/api/upload-desktop-files', async (req, res) => {
    try {
        if (!imageHostService) {
            return res.status(503).json({ error: '图床服务未配置' });
        }
        
        const { files, targetDir } = req.body;
        
        if (!files || !Array.isArray(files)) {
            return res.status(400).json({ error: '缺少文件列表' });
        }
        
        const results = [];
        const targetDirectory = targetDir || 'D:\\github-image-host\\image';
        
        // 确保目标目录存在
        if (!fs.existsSync(targetDirectory)) {
            fs.mkdirSync(targetDirectory, { recursive: true });
        }
        
        for (const file of files) {
            try {
                if (!fs.existsSync(file.path)) {
                    results.push({
                        file: file.name,
                        success: false,
                        error: '文件不存在'
                    });
                    continue;
                }
                
                // 生成唯一文件名
                const uniqueFilename = imageHostService.generateUniqueFilename(file.name);
                
                // 上传到图床
                const imageUrl = await imageHostService.uploadFile(file.path, uniqueFilename);
                
                if (imageUrl) {
                    // 移动文件到目标目录（使用复制+删除方式避免跨设备问题）
                    const targetPath = path.join(targetDirectory, file.name);
                    let finalTargetPath = targetPath;
                    
                    // 如果目标文件已存在，生成新名称
                    let counter = 1;
                    while (fs.existsSync(finalTargetPath)) {
                        const ext = path.extname(file.name);
                        const nameWithoutExt = path.basename(file.name, ext);
                        finalTargetPath = path.join(targetDirectory, `${nameWithoutExt}_${counter}${ext}`);
                        counter++;
                    }
                    
                    // 使用复制+删除方式移动文件，避免跨设备问题
                    fs.copyFileSync(file.path, finalTargetPath);
                    fs.unlinkSync(file.path);
                    
                    // 添加到历史记录
                    addToHistory({
                        type: 'desktop_upload',
                        filename: uniqueFilename,
                        originalFilename: file.name,
                        status: 'success',
                        url: imageUrl,
                        method: 'batch',
                        movedTo: finalTargetPath
                    });
                    
                    results.push({
                        file: file.name,
                        success: true,
                        url: imageUrl,
                        filename: uniqueFilename,
                        movedTo: finalTargetPath
                    });
                } else {
                    // 添加失败记录
                    addToHistory({
                        type: 'desktop_upload',
                        filename: file.name,
                        originalFilename: file.name,
                        status: 'failed',
                        error: '上传失败',
                        method: 'batch'
                    });
                    
                    results.push({
                        file: file.name,
                        success: false,
                        error: '上传失败'
                    });
                }
            } catch (error) {
                results.push({
                    file: file.name,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        
        res.json({
            success: true,
            results: results,
            total: files.length,
            successCount: successCount,
            failureCount: files.length - successCount,
            targetDirectory: targetDirectory
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 生成唯一文件名
app.post('/api/generate-filename', (req, res) => {
    try {
        if (!imageHostService) {
            return res.status(503).json({ error: '图床服务未配置' });
        }
        
        const { originalFilename, prefix } = req.body;
        
        if (!originalFilename) {
            return res.status(400).json({ error: '缺少原始文件名' });
        }
        
        const uniqueFilename = imageHostService.generateUniqueFilename(originalFilename, prefix);
        
        res.json({
            success: true,
            originalFilename: originalFilename,
            uniqueFilename: uniqueFilename
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 自定义推送接口
app.post('/api/push', async (req, res) => {
    try {
        if (!pushPlusService) {
            return res.status(503).json({ error: '推送Plus服务未配置' });
        }
        
        const { token, title, content, template } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ error: '缺少标题或内容' });
        }
        
        // 构建推送配置对象
        const pushConfig = {
            token: token, // 可选，如果不提供则使用默认token
            title: title,
            content: content,
            template: template || 'html'
        };
        
        const result = await pushPlusService.sendCustomMessage(pushConfig);
        
        if (result) {
            res.json({
                success: true,
                message: '推送发送成功'
            });
        } else {
            res.status(500).json({ 
                error: '推送发送失败'
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 切换检测模式
app.post('/api/switch-mode', async (req, res) => {
    try {
        const { mode } = req.body;
        
        if (!mode || !['test', 'production'].includes(mode)) {
            return res.status(400).json({ error: '无效的模式参数，必须是 test 或 production' });
        }
        
        if (!autoUploadScheduler) {
            return res.status(503).json({ error: '自动上传调度器未初始化' });
        }
        
        // 停止当前调度器
        autoUploadScheduler.stop();
        
        // 更新模式
        currentMode = mode;
        
        // 根据模式重新启动调度器
        if (mode === 'test') {
            autoUploadScheduler.startTestMode(); // 持续检测
        } else {
            autoUploadScheduler.start(); // 每天9-10点检测
        }
        
        res.json({
            success: true,
            mode: currentMode,
            message: `已切换到${mode === 'test' ? '测试' : '正式'}模式`,
            description: mode === 'test' ? '持续检测桌面文件' : '每天9-10点检测'
        });
        
        console.log(`🔄 检测模式已切换到: ${mode === 'test' ? '测试模式（持续检测）' : '正式模式（每天9-10点）'}`);
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取当前检测模式
app.get('/api/current-mode', (req, res) => {
    try {
        res.json({
            success: true,
            mode: currentMode,
            description: currentMode === 'test' ? '持续检测桌面文件' : '每天9-10点检测',
            schedulerStatus: autoUploadScheduler ? 'running' : 'not_initialized'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取历史记录
app.get('/api/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const paginatedHistory = uploadHistory.slice(offset, offset + limit);
        
        // 统计信息
        const stats = {
            total: uploadHistory.length,
            successful: uploadHistory.filter(h => h.status === 'success').length,
            failed: uploadHistory.filter(h => h.status === 'failed').length,
            lastUpload: uploadHistory.length > 0 ? uploadHistory[0].timestamp : null
        };
        
        res.json({
            success: true,
            history: paginatedHistory,
            stats: stats,
            pagination: {
                limit: limit,
                offset: offset,
                total: uploadHistory.length,
                hasMore: offset + limit < uploadHistory.length
            },
            serviceStatus: {
                running: true,
                port: PORT,
                uptime: process.uptime(),
                configured: !!imageHostService,
                startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        error: '服务器内部错误',
        message: error.message
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        error: '接口不存在',
        path: req.path
    });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 图床服务启动成功`);
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`📋 健康检查: http://localhost:${PORT}/health`);
    
    if (!imageHostService) {
        console.log('⚠️  请配置图床相关环境变量后重启服务');
    }
});

module.exports = app;
