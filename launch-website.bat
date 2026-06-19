@echo off
setlocal enabledelayedexpansion

set PORT=3001
set URL=http://localhost:%PORT%

cd /d "%~dp0\coming-soon"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo Server already running on %URL%
    start "" %URL%
    exit /b 0
)

echo Starting SimpleBeacon server on %URL%...
start /b node server.cjs > server.log 2>&1

:wait
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    echo Server ready. Opening browser...
    timeout /t 1 /nobreak >nul
    start "" %URL%
    exit /b 0
)
timeout /t 1 /nobreak >nul
goto wait
