@echo off
echo ========================================
echo OffNet Desktop Application Installer
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

REM Create installation directory
set INSTALL_DIR=%USERPROFILE%\OffNet
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
echo ✓ Created installation directory: %INSTALL_DIR%

REM Copy application files
echo Copying application files...
xcopy /E /I /Y "desktop-app\*" "%INSTALL_DIR%" >nul
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy application files
    pause
    exit /b 1
)
echo ✓ Copied application files

REM Copy main application files
echo Copying main application files...
xcopy /E /I /Y "public\*" "%INSTALL_DIR%\public" >nul
xcopy /E /I /Y "server.js" "%INSTALL_DIR%\" >nul
xcopy /E /I /Y "db.js" "%INSTALL_DIR%\" >nul
xcopy /E /I /Y "package.json" "%INSTALL_DIR%\" >nul
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy main application files
    pause
    exit /b 1
)
echo ✓ Copied main application files

REM Install dependencies
echo Installing dependencies...
cd /d "%INSTALL_DIR%"
call npm install --production >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: npm install had issues, but continuing...
    echo You may need to run: cd "%INSTALL_DIR%" && npm install
)
echo ✓ Dependencies installed

REM Create desktop shortcut
echo Creating desktop shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\OffNet.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\node.exe'; $Shortcut.Arguments = 'server.js'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.IconLocation = '%INSTALL_DIR%\icon.ico'; $Shortcut.Save()"
echo ✓ Created desktop shortcut

REM Create start menu shortcut
echo Creating Start Menu shortcut...
if not exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\OffNet" mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\OffNet"
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\OffNet\OffNet.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\node.exe'; $Shortcut.Arguments = 'server.js'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.IconLocation = '%INSTALL_DIR%\icon.ico'; $Shortcut.Save()"
echo ✓ Created Start Menu shortcut

REM Create background service shortcut
echo Creating background service shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\OffNet Background.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\node.exe'; $Shortcut.Arguments = 'desktop-app/background-service.js'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%\desktop-app'; $Shortcut.IconLocation = '%INSTALL_DIR%\icon.ico'; $Shortcut.Save()"
echo ✓ Created background service shortcut

REM Create uninstaller
echo Creating uninstaller...
echo @echo off > "%INSTALL_DIR%\uninstall.bat"
echo echo Uninstalling OffNet... >> "%INSTALL_DIR%\uninstall.bat"
echo taskkill /f /im electron.exe 2>nul >> "%INSTALL_DIR%\uninstall.bat"
echo timeout /t 2 /nobreak >> "%INSTALL_DIR%\uninstall.bat"
echo rmdir /s /q "%USERPROFILE%\Desktop\OffNet.lnk" 2>nul >> "%INSTALL_DIR%\uninstall.bat"
echo rmdir /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\OffNet" 2>nul >> "%INSTALL_DIR%\uninstall.bat"
echo rmdir /s /q "%INSTALL_DIR%" 2>nul >> "%INSTALL_DIR%\uninstall.bat"
echo echo OffNet has been uninstalled. >> "%INSTALL_DIR%\uninstall.bat"
echo pause >> "%INSTALL_DIR%\uninstall.bat"
echo ✓ Created uninstaller

REM Add to Windows Registry for auto-start (optional)
echo Would you like to add OffNet to Windows startup? (Y/N)
set /p choice=
if /i "%choice%"=="Y" (
    powershell -Command "New-Item -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'OffNet' -Value '%INSTALL_DIR%\node.exe server.js' -Force"
    echo ✓ Added to Windows startup
)

REM Create configuration files
echo Creating configuration files...
echo {"autoStart": true, "minimizeToTray": false, "enableNotifications": true} > "%INSTALL_DIR%\settings.json"
echo {"backgroundCaching": true, "syncInterval": 30000, "cacheEndpoints": ["/posts", "/posts/1", "/posts/2", "/users", "/users/1", "/users/2", "/comments", "/comments/1", "/albums", "/albums/1", "/photos", "/photos/1", "/todos", "/todos/1"]} > "%INSTALL_DIR%\desktop-app\background-settings.json"
echo ✓ Created configuration files

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo OffNet has been installed to: %INSTALL_DIR%
echo.
echo Shortcuts created:
echo   - Desktop: OffNet.lnk
echo   - Desktop: OffNet Background.lnk (for background service)
echo   - Start Menu: OffNet.lnk
echo.
echo To start the application:
echo   1. Double-click desktop shortcut
echo   2. Or run: cd "%INSTALL_DIR%" && node server.js
echo.
echo To start background service:
echo   1. Double-click "OffNet Background" shortcut
echo   2. Or run: cd "%INSTALL_DIR%\desktop-app" && node background-service.js
echo.
echo To uninstall: Run "%INSTALL_DIR%\uninstall.bat"
echo.
echo Press any key to start OffNet now...
pause >nul
cd /d "%INSTALL_DIR%"
start "" node server.js
