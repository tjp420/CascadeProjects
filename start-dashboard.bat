@echo off
REM Simplebeacon Dashboard Launcher (Windows)
REM Works from any path — auto-detects repo root, starts the server, and opens the browser.
setlocal enabledelayedexpansion

echo ==========================================
echo  Simplebeacon Dashboard Launcher
echo ==========================================
echo.

REM Resolve repo root from script location
set REPO_ROOT=%~dp0
if "%REPO_ROOT:~-1%"=="\" set REPO_ROOT=%REPO_ROOT:~0,-1%
set PLATFORM_DIR=%REPO_ROOT%\ai-platform
set DASHBOARD_URL=http://localhost:55000/simplebeacon-dashboard/

REM Verify ai-platform exists
if not exist "%PLATFORM_DIR%\package.json" (
    echo ERROR: ai-platform not found at %PLATFORM_DIR%
    echo Make sure you are running this from the CascadeProjects repo root.
    pause
    exit /b 1
)

echo [INFO] Repo: %REPO_ROOT%
echo [INFO] URL:  %DASHBOARD_URL%

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if port is already in use
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :55000 ^| findstr LISTENING') do (
    echo [WARN] Port 55000 is already in use.
    echo [WARN] The dashboard may already be running, or another service is using this port.
    echo [WARN] Opening browser anyway...
    start "" "%DASHBOARD_URL%"
    exit /b 0
)

echo [INFO] Starting server in background...
cd /d "%PLATFORM_DIR%"
set PORT=55000
start "Simplebeacon Dashboard" cmd /k "npm start ^> \"%REPO_ROOT%\dashboard.log\" 2^>^&1"

echo [INFO] Logs: %REPO_ROOT%\dashboard.log
echo [INFO] Waiting for server to start...

REM Wait for server to be ready
:wait_loop
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :55000 ^| findstr LISTENING') do (
    echo [INFO] Server is ready!
    echo [INFO] Opening browser...
    timeout /t 1 /nobreak >nul
    start "" "%DASHBOARD_URL%"
    exit /b 0
)
timeout /t 1 /nobreak >nul
goto wait_loop
