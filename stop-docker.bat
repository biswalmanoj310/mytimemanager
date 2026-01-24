@echo off
REM MyTimeManager Docker Stop Script for Windows

echo ========================================
echo  Stopping MyTimeManager...
echo ========================================
echo.

docker-compose down

echo.
echo MyTimeManager stopped successfully!
echo.
echo Your data is safely stored in:
echo   backend/database/mytimemanager.db
echo.
pause
