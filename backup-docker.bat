@echo off
REM Automatic Backup Script for MyTimeManager (Windows)
REM This script creates timestamped backups of the database

setlocal enabledelayedexpansion

REM Configuration
set BACKUP_DIR=backend\database\backups
set DB_FILE=backend\database\mytimemanager.db
set RETENTION_DAYS=30

REM Create backup directory if it doesn't exist
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Generate timestamp
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%
set BACKUP_FILE=%BACKUP_DIR%\mytimemanager_backup_%TIMESTAMP%.db

REM Check if database exists
if not exist "%DB_FILE%" (
    echo Database file not found: %DB_FILE%
    exit /b 1
)

REM Create backup
echo [%date% %time%] Creating backup: %BACKUP_FILE%
copy "%DB_FILE%" "%BACKUP_FILE%" >nul

if exist "%BACKUP_FILE%" (
    echo [%date% %time%] Backup created successfully: %BACKUP_FILE%
    
    REM Get file size
    for %%A in ("%BACKUP_FILE%") do set BACKUP_SIZE=%%~zA
    set /a BACKUP_SIZE_KB=%BACKUP_SIZE% / 1024
    echo [%date% %time%] Backup size: !BACKUP_SIZE_KB! KB
    
    REM Note: Windows doesn't have gzip by default, keeping uncompressed
    REM Users can manually compress if needed
) else (
    echo [%date% %time%] ERROR: Backup failed!
    exit /b 1
)

REM Clean up old backups (older than RETENTION_DAYS)
echo [%date% %time%] Cleaning up old backups (older than %RETENTION_DAYS% days)...
forfiles /P "%BACKUP_DIR%" /M mytimemanager_backup_*.db /D -%RETENTION_DAYS% /C "cmd /c del @path" 2>nul

REM Count remaining backups
set BACKUP_COUNT=0
for %%F in (%BACKUP_DIR%\mytimemanager_backup_*.db) do set /a BACKUP_COUNT+=1
echo [%date% %time%] Total backups: !BACKUP_COUNT!

echo [%date% %time%] Backup completed successfully!
