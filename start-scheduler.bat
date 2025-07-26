@echo off
chcp 65001 >nul
echo ========================================
echo    GitHub Image Host Service
echo ========================================
echo.

REM Check Node.js installation
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Node.js not found, please install Node.js first
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if in correct directory
if not exist "package.json" (
    echo Error: Please run this script in project root directory
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo Warning: .env config file not found
    echo Please copy .env.example to .env and fill in your GitHub config
    echo.
    if exist ".env.example" (
        echo Copying .env.example to .env...
        copy ".env.example" ".env" >nul
        echo Please edit .env file and fill in your config
        notepad .env
    )
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo Dependency installation failed
        pause
        exit /b 1
    )
)

echo Starting GitHub Image Host Service...
echo Starting frontend server and auto upload scheduler...
echo Press Ctrl+C to stop all services
echo.

REM Start frontend server in background
echo Starting frontend server...
start "GitHub Image Host Frontend" /min cmd /c "npm start"

REM Wait for frontend server to start
echo Waiting for frontend server to start...
timeout /t 3 /nobreak >nul

REM Auto open browser
echo Opening frontend page...
start http://localhost:3005

REM Start scheduler in foreground to keep window open
echo Starting auto upload scheduler...
echo Scheduler will run automatically at 9:00 AM daily
echo Frontend page opened in browser: http://localhost:3005
echo.
npm run scheduler

echo.
echo Scheduler service stopped
echo Note: Frontend server may still be running in background
echo To stop completely, close all related command windows
pause