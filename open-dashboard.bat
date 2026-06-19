@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"
set "PORT=54449"
set URL=http://127.0.0.1:%PORT%/simplebeacon-dashboard/
set HEALTH_URL=http://127.0.0.1:%PORT%/health

echo [SimpleBeacon Dashboard Launcher]

:: Check if server already running (must be LISTENING, not TIME_WAIT)
netstat -ano | findstr ":%PORT%" | findstr /C:"LISTENING" >nul 2>&1
if %errorlevel% == 0 (
    echo Server already running on port %PORT%.
    goto :open_browser
)

:: Start server from ai-platform directory
pushd "%ROOT%\ai-platform" >nul
echo Starting SimpleBeacon server on port %PORT%...
start "SimpleBeacon Server" /min cmd /c "node tools\start-v1-internal-dashboard.cjs ^>^> ^"%ROOT%\server.log^" 2^>^&1"
if %errorlevel% neq 0 (
    echo ERROR: Failed to start server. Is Node.js installed?
    popd
    pause
    exit /b 1
)
popd >nul

:: Wait for server to start (max ~15 seconds)
echo Waiting for server...
for /L %%i in (15,-1,1) do (
    curl -s %HEALTH_URL% >nul 2>&1
    if !errorlevel! == 0 goto :open_browser
    timeout /t 1 /nobreak >nul
)

echo Warning: Server may not be ready yet, opening browser anyway...

:open_browser
echo Opening %URL%
start "" "%URL%"
endlocal
