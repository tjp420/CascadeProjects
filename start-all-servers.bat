@echo off
REM Start SimpleBeacon Frontend (port 3000) + MCP Backend (port 54355)
setlocal enabledelayedexpansion

echo =========================================
echo   SimpleBeacon Server Launcher
echo =========================================
echo.

set FRONTEND_DIR=C:\Users\Trevor\CascadeProjects\coming-soon
set BACKEND_DIR=C:\Users\Trevor\CascadeProjects\ai-platform
set FRONTEND_PORT=3000
set BACKEND_PORT=54355

REM --- Check and start MCP backend (port 54355) ---
set BACKEND_RUNNING=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%BACKEND_PORT% ^| findstr LISTENING') do (
    set BACKEND_RUNNING=1
    echo [BACKEND] Port %BACKEND_PORT% already in use by PID: %%a
    echo [BACKEND] MCP backend appears to be running.
)

if !BACKEND_RUNNING! == 0 (
    echo [BACKEND] Starting MCP backend on port %BACKEND_PORT%...
    start "MCP Backend" cmd /c "cd /d %BACKEND_DIR% && node mcp-http-server.cjs"
    timeout /t 3 /nobreak >nul
    echo [BACKEND] MCP backend started.
)

REM --- Check and start Frontend (port 3000) ---
set FRONTEND_RUNNING=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%FRONTEND_PORT% ^| findstr LISTENING') do (
    set FRONTEND_RUNNING=1
    echo [FRONTEND] Port %FRONTEND_PORT% already in use by PID: %%a
    echo [FRONTEND] Frontend server appears to be running.
)

if !FRONTEND_RUNNING! == 0 (
    echo [FRONTEND] Starting frontend server on port %FRONTEND_PORT%...
    start "SimpleBeacon Frontend" cmd /c "cd /d %FRONTEND_DIR% && node server.cjs"
    timeout /t 2 /nobreak >nul
    echo [FRONTEND] Frontend server started.
)

echo.
echo =========================================
echo   Servers Ready
echo =========================================
echo  Frontend:  http://localhost:%FRONTEND_PORT%
echo  Upload:    http://localhost:%FRONTEND_PORT%/certificate-upload.html
echo  Backend:   http://localhost:%BACKEND_PORT%
echo.
echo  Press any key to open the certificate upload page...
pause >nul
start http://localhost:%FRONTEND_PORT%/certificate-upload.html
