@echo off
echo 🚀 Installing OffNet Desktop Application...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    echo    Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found

REM Install desktop app dependencies
echo 📦 Installing desktop dependencies...
cd desktop-app
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install desktop dependencies
    pause
    exit /b 1
)

echo ✅ Desktop dependencies installed

REM Install main project dependencies
echo 📦 Installing main project dependencies...
cd ..
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install main dependencies
    pause
    exit /b 1
)

echo ✅ Main dependencies installed

echo.
echo 🎉 OffNet Desktop Application installed successfully!
echo.
echo 📋 Next Steps:
echo    1. Run: npm run desktop
echo    2. Or run: cd desktop-app && npm start
echo.
echo 🌐 The desktop app will start automatically and manage the server for you!
echo.
pause
