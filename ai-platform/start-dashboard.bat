@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo  SimpleBeacon dashboard - starting on http://localhost:54355/
echo  Stop later with: stop-dashboard.bat
echo.

if not exist "package.json" (
    echo ERROR: Run this file from the ai-platform folder.
    pause
    exit /b 1
)

if not exist ".env.v1-internal" (
    echo WARNING: .env.v1-internal not found. Copy .env.v1-internal.example if auth fails.
    echo.
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not on PATH.
    pause
    exit /b 1
)

start "SimpleBeacon Dashboard :54355" cmd /k "cd /d "%~dp0" && npm run dashboard:v1-internal"

echo Waiting for server to bind port 54355...
timeout /t 4 /nobreak >nul

start "" "http://localhost:54355/"

echo.
echo  Server window opened. Browser launched when ready.
echo.
