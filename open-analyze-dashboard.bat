@echo off
setlocal enabledelayedexpansion

set REPO_ROOT=%~dp0
if "%REPO_ROOT:~-1%"=="\" set REPO_ROOT=%REPO_ROOT:~0,-1%
set PLATFORM_DIR=%REPO_ROOT%\ai-platform
set PORT=54800
set DASHBOARD_URL=http://127.0.0.1:%PORT%/simplebeacon-dashboard/#/analyze

echo ==========================================
echo  SimpleBeacon Analyze Dashboard Launcher
echo ==========================================
echo.

REM Verify ai-platform exists
if not exist "%PLATFORM_DIR%\package.json" (
    echo ERROR: ai-platform not found at %PLATFORM_DIR%
    pause
    exit /b 1
)

REM Check if server is already running on the target port
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo [INFO] Server already running on port %PORT%
    echo [INFO] Opening %DASHBOARD_URL% ...
    start "" "%DASHBOARD_URL%"
    exit /b 0
)

echo [INFO] Starting SimpleBeacon server on port %PORT% ...
cd /d "%PLATFORM_DIR%"
set SIMPLEBEACON_INTERNAL_DASHBOARD=true
set PORT=%PORT%
start "SimpleBeacon Server" cmd /k "node server/index.cjs"

echo [INFO] Waiting for server to be ready...
:wait_loop
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo [INFO] Server ready! Opening browser...
    timeout /t 1 /nobreak >nul
    start "" "%DASHBOARD_URL%"
    exit /b 0
)
timeout /t 1 /nobreak >nul
goto wait_loop
