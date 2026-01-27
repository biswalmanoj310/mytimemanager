@echo off
REM Fix task timestamps that were stored in UTC instead of local time
REM This script will repair the created_at dates for existing tasks

echo === Fixing Task Timestamps ===
echo.
echo This will fix the dates on your daily tasks so they appear today.
echo.

cd mytimemanager

REM Stop Docker containers first
echo Stopping the app...
call stop-docker.bat
timeout /t 3 /nobreak >nul

REM Pull latest code
echo.
echo Getting latest updates...
git pull

REM Run the fix script
echo.
echo Fixing task dates...
python fix_task_timestamps.py

REM Restart Docker
echo.
echo Starting the app...
call start-docker.bat

echo.
echo === Done! ===
echo Your tasks should now appear in the Daily tab.
echo Press any key to close...
pause >nul
