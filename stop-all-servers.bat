@echo off
REM Stop SimpleBeacon Frontend (port 3000) + MCP Backend (port 54355)
echo =========================================
echo   Stopping SimpleBeacon Servers
echo =========================================
echo.

set FRONTEND_PORT=3000
set BACKEND_PORT=54355

REM --- Kill MCP backend (port 54355) ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    echo [BACKEND] Killing process on port %BACKEND_PORT% (PID: %%a)...
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! == 0 (
        echo [BACKEND] Stopped.
    ) else (
        echo [BACKEND] Failed to stop (may already be stopped).
    )
)

REM --- Kill Frontend (port 3000) ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
    echo [FRONTEND] Killing process on port %FRONTEND_PORT% (PID: %%a)...
    taskkill /PID %%a /F >nul 2>&1
    if !errorlevel! == 0 (
        echo [FRONTEND] Stopped.
    ) else (
        echo [FRONTEND] Failed to stop (may already be stopped).
    )
)

echo.
echo =========================================
echo   All servers stopped.
echo =========================================
pause
