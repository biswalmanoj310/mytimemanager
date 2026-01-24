@echo off
REM Manual Backup Trigger for Windows
REM Run this anytime to create an immediate backup

echo ========================================
echo  MyTimeManager Manual Backup
echo ========================================
echo.

REM Check if app is running
docker ps | findstr mytimemanager-backend >nul
if errorlevel 1 (
    echo App is not running. Starting backup locally...
    call backup-docker.bat
) else (
    echo Running backup inside Docker container...
    docker exec mytimemanager-backend /usr/local/bin/backup-docker.sh
)

echo.
echo Backup completed!
echo.
echo Backups are stored in:
echo   backend\database\backups\
echo.
pause
