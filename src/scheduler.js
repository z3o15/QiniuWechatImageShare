#!/usr/bin/env node

/**
 * 自动上传调度器启动脚本
 * 用于启动定时任务服务
 */

const AutoUploadScheduler = require('./autoUploadScheduler');
const path = require('path');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '../.env') });

/**
 * 主函数
 */
async function main() {
    console.log('=== GitHub图床自动上传服务 ===');
    console.log('版本: 1.0.0');
    console.log('作者: AI Assistant');
    console.log('');
    
    try {
        // 检查环境变量
        if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_USERNAME || !process.env.GITHUB_REPOSITORY) {
            console.error('错误: 缺少必要的环境变量配置');
            console.error('请确保 .env 文件中包含以下配置:');
            console.error('- GITHUB_TOKEN');
            console.error('- GITHUB_USERNAME');
            console.error('- GITHUB_REPOSITORY');
            process.exit(1);
        }
        
        // 创建调度器实例
        const scheduler = new AutoUploadScheduler();
        
        // 处理命令行参数
        const args = process.argv.slice(2);
        
        if (args.includes('--test') || args.includes('-t')) {
            // 测试模式：立即执行一次任务
            console.log('测试模式: 立即执行一次上传任务');
            await scheduler.runOnce();
            console.log('测试完成，程序退出');
            process.exit(0);
        } else if (args.includes('--help') || args.includes('-h')) {
            // 显示帮助信息
            showHelp();
            process.exit(0);
        } else {
            // 正常模式：启动定时任务
            scheduler.start();
            
            // 保持程序运行
            console.log('按 Ctrl+C 停止服务');
            
            // 优雅退出处理
            process.on('SIGINT', () => {
                console.log('\n正在停止服务...');
                console.log('服务已停止');
                process.exit(0);
            });
            
            process.on('SIGTERM', () => {
                console.log('\n收到终止信号，正在停止服务...');
                console.log('服务已停止');
                process.exit(0);
            });
        }
        
    } catch (error) {
        console.error('启动服务时发生错误:', error.message);
        process.exit(1);
    }
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log('GitHub图床自动上传服务');
    console.log('');
    console.log('用法:');
    console.log('  node scheduler.js [选项]');
    console.log('');
    console.log('选项:');
    console.log('  -t, --test    测试模式，立即执行一次上传任务');
    console.log('  -h, --help    显示此帮助信息');
    console.log('');
    console.log('功能说明:');
    console.log('  - 每天上午9:00自动检查桌面文件夹');
    console.log('  - 查找以"meet"开始、当天日期结束的文件');
    console.log('  - 自动上传到GitHub图床');
    console.log('  - 发送系统通知');
    console.log('');
    console.log('文件命名规则:');
    console.log('  meet[任意内容]YYYYMMDD.[扩展名]');
    console.log('  例如: meet-会议记录20241220.pdf');
    console.log('       meetingNotes20241220.docx');
    console.log('');
    console.log('环境变量配置:');
    console.log('  在 .env 文件中配置以下变量:');
    console.log('  GITHUB_TOKEN=your_github_token');
    console.log('  GITHUB_USERNAME=your_username');
    console.log('  GITHUB_REPOSITORY=your_repository');
}

// 启动程序
if (require.main === module) {
    main();
}

module.exports = { main, showHelp };