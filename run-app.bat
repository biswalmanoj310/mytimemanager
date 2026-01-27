@echo off
REM MyTimeManager - One-Click Startup for Windows
REM This script automatically starts Docker Desktop and runs the app
REM Perfect for non-technical users!

title MyTimeManager - Starting App...

echo ================================================
echo   MyTimeManager - Starting Application
echo ================================================
echo.
echo Please wait while we start everything for you...
echo.

REM Step 1: Check if Docker Desktop is installed
echo [Step 1/5] Checking Docker installation...
where docker >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: Docker Desktop is not installed!
    echo.
    echo Please install Docker Desktop first:
    echo 1. Go to: https://www.docker.com/products/docker-desktop
    echo 2. Download and install Docker Desktop
    echo 3. Restart your computer
    echo 4. Run this script again
    echo.
    pause
    exit /b 1
)
echo    ✓ Docker Desktop is installed
echo.

REM Step 2: Check if Docker Desktop is running
echo [Step 2/5] Checking if Docker Desktop is running...
docker info >nul 2>&1
if errorlevel 1 (
    echo    Docker Desktop is not running. Starting it now...
    echo.
    
    REM Try to start Docker Desktop
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    
    echo    Waiting for Docker Desktop to start - this may take 30-60 seconds...
    echo    Please be patient...
    echo.
    
    REM Wait for Docker to be ready (max 2 minutes)
    set RETRY_COUNT=0
    :WAIT_DOCKER
    timeout /t 5 /nobreak >nul
    docker info >nul 2>&1
    if errorlevel 1 (
        set /a RETRY_COUNT+=1
        if %RETRY_COUNT% LSS 24 (
            echo    Still waiting... %RETRY_COUNT% of 24 attempts
            goto WAIT_DOCKER
        ) else (
            echo.
            echo ERROR: Docker Desktop did not start in time.
            echo.
            echo Please:
            echo 1. Manually open Docker Desktop
            echo 2. Wait until you see "Docker Desktop is running" in the system tray
            echo 3. Run this script again
            echo.
            pause
            exit /b 1
        )
    )
    echo    ✓ Docker Desktop is now running!
) else (
    echo    ✓ Docker Desktop is already running
)
echo.

REM Step 3: Build Docker images
echo [Step 3/5] Building application - first time may take 2-3 minutes...
docker-compose build --quiet
if errorlevel 1 (
    echo.
    echo ERROR: Failed to build application
    echo.
    echo Please check if:
    echo - You have internet connection
    echo - Docker Desktop has enough disk space
    echo.
    pause
    exit /b 1
)
echo    ✓ Application built successfully
echo.

REM Step 4: Start the application
echo [Step 4/5] Starting MyTimeManager...
docker-compose up -d
if errorlevel 1 (
    echo.
    echo ERROR: Failed to start application
    echo.
    echo Try running: docker-compose logs
    echo to see what went wrong.
    echo.
    pause
    exit /b 1
)
echo    ✓ Application started successfully
echo.

REM Step 5: Wait a bit for services to initialize
echo [Step 5/5] Initializing services...
timeout /t 8 /nobreak >nul
echo    ✓ Ready!
echo.

REM Success message
echo ================================================
echo   SUCCESS! MyTimeManager is now running! 🎉
echo ================================================
echo.
echo   📱 Open your web browser and go to:
echo.
echo      👉 http://localhost:3000 👈
echo.
echo   This is your MyTimeManager app!
echo.
echo ================================================
echo   Useful Information:
echo ================================================
echo.
echo   📊 View API Documentation:
echo      http://localhost:8000/docs
echo.
echo   🛑 To stop the app:
echo      Double-click: stop-docker.bat
echo.
echo   📋 To view logs:
echo      Double-click: check-docker-status.bat
echo.
echo   💾 To backup your data:
echo      Double-click: backup-now.bat
echo.
echo ================================================
echo.
echo Keep this window open to see any messages.
echo You can minimize it, but don't close it!
echo.
echo The app will continue running even if you close your browser.
echo.

REM Ask if user wants to open the browser automatically
set /p OPEN_BROWSER="Do you want to open the app in your browser now? (Y/N): "
if /i "%OPEN_BROWSER%"=="Y" (
    echo.
    echo Opening browser...
    start http://localhost:3000
)

echo.
echo Press any key to close this window (app will keep running)...
pause >nul
