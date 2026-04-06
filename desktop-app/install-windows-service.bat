
@echo off
echo Installing OffNet Background Service...

REM Check if NSSM exists
if not exist "C:\Users\samue\OneDrive\Desktop\AI\OffNet\tools\nssm.exe" (
    echo NSSM not found. Please download NSSM from https://nssm.cc/download
    echo Place nssm.exe in tools directory and try again.
    pause
    exit /b 1
)

REM Stop existing service if running
"C:\Users\samue\OneDrive\Desktop\AI\OffNet\tools\nssm.exe" stop "OffNetBackground" 2>nul

REM Remove existing service if exists
"C:\Users\samue\OneDrive\Desktop\AI\OffNet\tools\nssm.exe" remove "OffNetBackground" confirm 2>nul

REM Install new service
"C:\Users\samue\OneDrive\Desktop\AI\OffNet\tools\nssm.exe" install "OffNetBackground" "C:\Users\samue\OneDrive\Desktop\AI\node.exe" "C:\Users\samue\OneDrive\Desktop\AI\OffNet\desktop-app\background-service.js" --background

REM Set service description
"C:\Users\samue\OneDrive\Desktop\AI\OffNet\tools\nssm.exe" set "OffNetBackground" Description "OffNet Background Service - Continuous data caching and synchronization"

REM Set service to start automatically
"C:\Users\samue\OneDrive\Desktop\AI\OffNet\tools\nssm.exe" set "OffNetBackground" Start SERVICE_AUTO_START

REM Start the service
"C:\Users\samue\OneDrive\Desktop\AI\OffNet\tools\nssm.exe" start "OffNetBackground"

echo OffNet Background Service installed successfully!
echo Service will start automatically when Windows starts.
echo You can manage the service using:
echo   nssm start OffNetBackground
echo   nssm stop OffNetBackground
echo   nssm restart OffNetBackground
echo   nssm remove OffNetBackground
pause
