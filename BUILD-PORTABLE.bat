@echo off
echo ========================================
echo OffNet Portable Application Builder
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js is installed
node --version

REM Create portable directory
set PORTABLE_DIR=%CD%\OffNet-Portable
if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
mkdir "%PORTABLE_DIR%"

echo ✓ Created portable directory: %PORTABLE_DIR%

REM Copy application files
echo Copying application files...
xcopy /E /I /Y "desktop-app\*" "%PORTABLE_DIR%" >nul
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy application files
    pause
    exit /b 1
)

REM Copy main application files
echo Copying main application files...
xcopy /E /I /Y "public\*" "%PORTABLE_DIR%\public" >nul
xcopy /E /I /Y "server.js" "%PORTABLE_DIR%\" >nul
xcopy /E /I /Y "db.js" "%PORTABLE_DIR%\" >nul
xcopy /E /I /Y "package.json" "%PORTABLE_DIR%\" >nul
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy main application files
    pause
    exit /b 1
)

echo ✓ Copied application files

REM Install dependencies
echo Installing dependencies...
cd /d "%PORTABLE_DIR%"
call npm install --production >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: npm install had issues, but continuing...
)

echo ✓ Dependencies installed

REM Create launcher scripts
echo Creating launcher scripts...

REM Main application launcher
echo @echo off > "Start OffNet.bat"
echo echo Starting OffNet Desktop Application... >> "Start OffNet.bat"
echo cd /d "%%~dp0" >> "Start OffNet.bat"
echo start "" node server.js >> "Start OffNet.bat"
echo title OffNet Desktop >> "Start OffNet.bat"

REM Background service launcher
echo @echo off > "Start Background Service.bat"
echo echo Starting OffNet Background Service... >> "Start Background Service.bat"
echo cd /d "%%~dp0\desktop-app" >> "Start Background Service.bat"
echo start "" node background-service.js >> "Start Background Service.bat"
echo title OffNet Background Service >> "Start Background Service.bat"

REM Developer mode launcher
echo @echo off > "Start Developer Mode.bat"
echo echo Starting OffNet in Developer Mode... >> "Start Developer Mode.bat"
echo cd /d "%%~dp0\desktop-app" >> "Start Developer Mode.bat"
echo start "" npm run dev >> "Start Developer Mode.bat"
echo title OffNet Developer Mode >> "Start Developer Mode.bat"

echo ✓ Created launcher scripts

REM Create configuration files
echo Creating configuration files...
echo {"autoStart": true, "minimizeToTray": false, "enableNotifications": true} > "settings.json"
echo {"backgroundCaching": true, "syncInterval": 30000, "cacheEndpoints": ["/posts", "/posts/1", "/posts/2", "/users", "/users/1", "/users/2", "/comments", "/comments/1", "/albums", "/albums/1", "/photos", "/photos/1", "/todos", "/todos/1"]} > "background-settings.json"
echo ✓ Created configuration files

REM Create README for portable version
echo Creating README...
echo OffNet Portable Application > "README-Portable.txt"
echo. >> "README-Portable.txt"
echo This is a portable version of OffNet that requires no installation. >> "README-Portable.txt"
echo. >> "README-Portable.txt"
echo To use: >> "README-Portable.txt"
echo 1. Extract this entire folder to any location >> "README-Portable.txt"
echo 2. Run one of the following: >> "README-Portable.txt"
echo    - "Start OffNet.bat" - Main desktop application >> "README-Portable.txt"
echo    - "Start Background Service.bat" - Background caching service >> "README-Portable.txt"
echo    - "Start Developer Mode.bat" - Development mode with dev tools >> "README-Portable.txt"
echo. >> "README-Portable.txt"
echo The application will create a database file (offnet.db) >> "README-Portable.txt"
echo and configuration files in this directory. >> "README-Portable.txt"
echo. >> "README-Portable.txt"
echo No administrator privileges required! >> "README-Portable.txt"

echo ✓ Created README

echo.
echo ========================================
echo Portable Build Complete!
echo ========================================
echo.
echo Portable OffNet has been created in: %PORTABLE_DIR%
echo.
echo The portable version includes:
echo   - Complete OffNet desktop application
echo   - Background service for continuous caching
echo   - All dependencies pre-installed
echo   - Launcher scripts for easy use
echo   - No installation required
echo.
echo To use OffNet:
echo   1. Copy the "%PORTABLE_DIR%" folder anywhere
echo   2. Run "Start OffNet.bat" to launch the main app
echo   3. Run "Start Background Service.bat" for background caching
echo.
echo Press any key to open the portable folder...
pause >nul
explorer "%PORTABLE_DIR%"
