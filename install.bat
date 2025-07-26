@echo off
chcp 65001 >nul
echo.
echo ========================================
echo    GitHub图床服务 - 安装脚本
echo ========================================
echo.

echo 📦 正在安装依赖包...
npm install

if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败，请检查npm是否正确安装
    pause
    exit /b 1
)

echo.
echo ✅ 依赖安装完成！
echo.
echo 📋 接下来的配置步骤：
echo.
echo 1. 复制 .env.example 为 .env
echo 2. 编辑 .env 文件，填入你的GitHub配置：
echo    - GITHUB_TOKEN: 在 https://github.com/settings/tokens 获取
echo    - GITHUB_USERNAME: 你的GitHub用户名
echo    - GITHUB_REPOSITORY: 用作图床的仓库名
echo.
echo 3. 运行测试：npm test
echo 4. 启动服务：npm start
echo.
echo 📖 详细说明请查看 README.md 文件
echo.

if not exist ".env" (
    echo 🔧 正在创建 .env 文件...
    copy ".env.example" ".env" >nul
    echo ✅ .env 文件已创建，请编辑填入你的配置
    echo.
)

echo 🎉 安装完成！
echo.
pause
