@echo off
REM Quick Setup Checker for Windows
REM This script checks if Docker is installed and ready

echo ========================================
echo  MyTimeManager Setup Checker
echo ========================================
echo.

REM Check Docker
echo [1/2] Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [X] Docker is NOT installed
    echo.
    echo Please install Docker Desktop:
    echo 1. Go to: https://www.docker.com/products/docker-desktop
    echo 2. Download "Docker Desktop for Windows"
    echo 3. Run installer (requires admin rights)
    echo 4. Restart computer when prompted
    echo 5. Open Docker Desktop and wait for it to start
    echo 6. You should see a whale icon in the system tray
    echo.
    echo After installing Docker, run this script again.
    pause
    exit /b 1
)

echo [OK] Docker is installed
docker --version

REM Check Docker is running
echo.
echo [2/2] Checking if Docker is running...
docker ps >nul 2>&1
if errorlevel 1 (
    echo [X] Docker is installed but NOT running
    echo.
    echo Please start Docker Desktop:
    echo 1. Look for Docker Desktop in Start Menu
    echo 2. Open it
    echo 3. Wait for the whale icon to appear in system tray
    echo 4. Icon should be stable (not animated)
    echo 5. Then run this script again
    echo.
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.
echo ========================================
echo  All checks passed! You're ready!
echo ========================================
echo.
echo Next steps:
echo 1. Double-click: start-docker.bat
echo 2. Wait 2-3 minutes (first time only)
echo 3. Open browser: http://localhost:3000
echo.
echo Need help? Read: QUICK_SETUP.md
echo.
pause
