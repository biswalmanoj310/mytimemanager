@echo off
REM MyTimeManager Docker Startup Script for Windows
REM This script starts the application using Docker

echo ========================================
echo  MyTimeManager - Docker Startup
echo ========================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not in PATH
    echo.
    echo Please install Docker Desktop from:
    echo https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

echo [1/3] Building Docker images...
docker-compose build

if errorlevel 1 (
    echo.
    echo ERROR: Failed to build Docker images
    pause
    exit /b 1
)

echo.
echo [2/3] Starting containers...
docker-compose up -d

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start containers
    pause
    exit /b 1
)

echo.
echo [3/3] Waiting for services to be ready...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo  SUCCESS! MyTimeManager is running!
echo ========================================
echo.
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo  API Docs: http://localhost:8000/docs
echo.
echo Open your browser and go to:
echo   http://localhost:3000
echo.
echo To stop the app, run: stop-docker.bat
echo To view logs, run:    docker-compose logs -f
echo.
pause
