@echo off
REM Stop SimpleBeacon MCP HTTP Server (port 3002)
setlocal enabledelayedexpansion

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
    echo MCP HTTP server on port 3002 stopped (PID: %%a)
    exit /b 0
)

echo No MCP HTTP server found listening on port 3002
exit /b 1
