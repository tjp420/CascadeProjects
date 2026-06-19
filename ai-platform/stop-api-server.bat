@echo off
REM Stop SimpleBeacon API server (port 3002)
setlocal enabledelayedexpansion

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
    echo API server on port 3002 stopped (PID: %%a)
    exit /b 0
)

echo No API server found listening on port 3002
exit /b 1
