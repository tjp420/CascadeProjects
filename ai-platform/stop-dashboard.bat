@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  Stopping SimpleBeacon listeners on ports 54355 and 8081...
echo.

if not exist "package.json" (
    echo ERROR: Run this file from the ai-platform folder.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not on PATH.
    pause
    exit /b 1
)

call npm run dashboard:kill-ports

echo.
echo  Done. http://localhost:54355/ should no longer respond.
echo.
