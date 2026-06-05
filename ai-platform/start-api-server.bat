@echo off
REM Start SimpleBeacon API server on port 54355
setlocal enabledelayedexpansion

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :54355 ^| findstr LISTENING') do (
    echo Port 54355 already in use by PID: %%a
    echo Run stop-api-server.bat first, or visit http://localhost:54355
    exit /b 1
)

node server\index.cjs
