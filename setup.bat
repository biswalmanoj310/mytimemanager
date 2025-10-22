@echo off
REM MyTimeManager - Project Setup Script (Windows)
REM This script creates the complete folder structure and initializes the project

echo.
echo ========================================
echo   MyTimeManager - Project Setup
echo ========================================
echo.

echo Creating folder structure...

REM Backend structure
mkdir backend\app\models 2>nul
mkdir backend\app\routes 2>nul
mkdir backend\app\services 2>nul
mkdir backend\app\utils 2>nul
mkdir backend\app\database 2>nul
mkdir backend\tests 2>nul

REM Frontend structure
mkdir frontend\public 2>nul
mkdir frontend\src\components\dashboard 2>nul
mkdir frontend\src\components\tasks 2>nul
mkdir frontend\src\components\goals 2>nul
mkdir frontend\src\components\pillars 2>nul
mkdir frontend\src\components\common 2>nul
mkdir frontend\src\pages 2>nul
mkdir frontend\src\services 2>nul
mkdir frontend\src\utils 2>nul
mkdir frontend\src\styles 2>nul
mkdir frontend\src\assets\images 2>nul
mkdir frontend\src\hooks 2>nul

REM Database directory
mkdir database 2>nul

REM Documentation
mkdir docs 2>nul

echo Folder structure created!
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Review .gitignore and .env files
echo 2. Run: git remote add origin https://github.com/biswalmanoj310/mytimemanager.git
echo 3. Run: git branch -M main
echo 4. Run: git push -u origin main
echo 5. Create Python virtual environment: cd backend ^&^& python -m venv venv
echo 6. Activate virtual environment: backend\venv\Scripts\activate
echo.
echo Happy Time Managing!
echo.
pause
