@echo off
echo ========================================
echo MyTimeManager - Docker Status Check
echo ========================================
echo.

echo [1/4] Checking Docker containers status...
docker ps -a --filter "name=mytimemanager"
echo.

echo [2/4] Checking backend logs (last 30 lines)...
docker logs mytimemanager-backend --tail 30
echo.

echo [3/4] Testing backend health endpoint...
curl http://localhost:8000/health
echo.

echo [4/4] Testing backend root endpoint...
curl http://localhost:8000/
echo.

echo ========================================
echo Check complete!
echo If you see errors above, the backend isn't running properly.
echo ========================================
pause
