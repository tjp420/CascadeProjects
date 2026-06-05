@echo off
REM Stop SimpleBeacon Landing Page server (port 3001)
setlocal enabledelayedexpansion

for /f "tokens=2 delims=," %%a in ('wmic process where "commandline like '%%server.cjs%%'" get processid /format:csv ^| findstr [0-9]') do (
    taskkill /PID %%a /F >nul 2>&1
    echo Landing page server stopped (PID: %%a)
    exit /b 0
)

echo No landing page server found running server.cjs
exit /b 1
