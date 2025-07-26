@echo off
chcp 65001 >nul
echo ========================================
echo    GitHub图床自动上传服务
echo ========================================
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到Node.js，请先安装Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查是否在正确的目录
if not exist "package.json" (
    echo 错误: 请在项目根目录运行此脚本
    pause
    exit /b 1
)

:: 检查.env文件是否存在
if not exist ".env" (
    echo 警告: 未找到.env配置文件
    echo 请复制.env.example为.env并填入你的GitHub配置
    echo.
    if exist ".env.example" (
        echo 正在复制.env.example到.env...
        copy ".env.example" ".env" >nul
        echo 请编辑.env文件并填入你的配置信息
        notepad .env
    )
    pause
    exit /b 1
)

:: 检查依赖是否安装
if not exist "node_modules" (
    echo 正在安装依赖...
    npm install
    if %errorlevel% neq 0 (
        echo 依赖安装失败
        pause
        exit /b 1
    )
)

echo 启动自动上传调度器...
echo 服务将在每天上午9:00自动执行
echo 按Ctrl+C停止服务
echo.

:: 启动调度器
npm run scheduler

echo.
echo 服务已停止
pause