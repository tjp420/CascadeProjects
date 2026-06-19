@echo off
REM Start SimpleBeacon API server on port 3002
setlocal enabledelayedexpansion
set PORT=3002

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo Port 3002 already in use by PID: %%a
    echo Run stop-api-server.bat first, or visit http://localhost:3002
    exit /b 1
)

cd /d "%~dp0"
node server\index.cjs
