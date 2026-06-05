@echo off
REM Stop SimpleBeacon MCP HTTP Server (port 54355)
setlocal enabledelayedexpansion

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :54355 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
    echo MCP HTTP server on port 54355 stopped (PID: %%a)
    exit /b 0
)

echo No MCP HTTP server found listening on port 54355
exit /b 1
