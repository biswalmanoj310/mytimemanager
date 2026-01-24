@echo off
REM Restore Database from Backup (Windows)

echo ========================================
echo  MyTimeManager Database Restore
echo ========================================
echo.

set BACKUP_DIR=backend\database\backups
set DB_FILE=backend\database\mytimemanager.db

REM Check if backup directory exists
if not exist "%BACKUP_DIR%" (
    echo No backups found in %BACKUP_DIR%
    pause
    exit /b 1
)

REM List available backups
echo Available backups:
echo.
dir /B /O-D "%BACKUP_DIR%\mytimemanager_backup_*.db" 2>nul
if errorlevel 1 (
    echo No backup files found!
    pause
    exit /b 1
)

echo.
echo WARNING: This will replace your current database!
echo Current database will be backed up as mytimemanager.db.before_restore
echo.
set /p CONFIRM="Type YES to continue: "

if not "%CONFIRM%"=="YES" (
    echo Restore cancelled.
    pause
    exit /b 0
)

echo.
set /p BACKUP_FILE="Enter backup filename (from list above): "

if not exist "%BACKUP_DIR%\%BACKUP_FILE%" (
    echo Backup file not found: %BACKUP_DIR%\%BACKUP_FILE%
    pause
    exit /b 1
)

REM Stop Docker if running
echo Stopping MyTimeManager...
docker-compose down >nul 2>&1

REM Backup current database
if exist "%DB_FILE%" (
    echo Backing up current database...
    copy "%DB_FILE%" "%DB_FILE%.before_restore" >nul
)

REM Restore from backup
echo Restoring from backup...
copy "%BACKUP_DIR%\%BACKUP_FILE%" "%DB_FILE%" >nul

if exist "%DB_FILE%" (
    echo.
    echo ========================================
    echo  Restore completed successfully!
    echo ========================================
    echo.
    echo Database restored from: %BACKUP_FILE%
    echo Previous database saved as: mytimemanager.db.before_restore
    echo.
    echo You can now start the app with start-docker.bat
) else (
    echo.
    echo ERROR: Restore failed!
    if exist "%DB_FILE%.before_restore" (
        echo Restoring previous database...
        copy "%DB_FILE%.before_restore" "%DB_FILE%" >nul
    )
)

echo.
pause
