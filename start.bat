@echo off
chcp 65001 >nul
echo.
echo ========================================
echo    GitHub图床服务 - 启动脚本
echo ========================================
echo.

if not exist ".env" (
    echo ❌ 未找到 .env 配置文件
    echo 请先运行 install.bat 进行安装配置
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo ❌ 未找到依赖包
    echo 请先运行 install.bat 安装依赖
    pause
    exit /b 1
)

echo 🚀 正在启动GitHub图床服务...
echo.
echo 📍 服务将运行在: http://localhost:3000
echo 📋 健康检查: http://localhost:3000/health
echo 🖼️ Web界面: http://localhost:3000
echo.
echo 按 Ctrl+C 停止服务
echo.

node example/server.js

echo.
echo 👋 服务已停止
pause
