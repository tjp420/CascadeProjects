@echo off
setlocal EnableExtensions
title Cascade AI Platform - Localhost
cd /d "%~dp0"

echo.
echo  Cascade AI Platform - Localhost
echo  ================================
echo.

REM --- Node.js ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed or not in PATH.
    echo  Install from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo  Node: %%v

REM --- Mode: dashboard (default), website, or both ---
set "MODE=%~1"
if "%MODE%"=="" set "MODE=dashboard"
if /i not "%MODE%"=="dashboard" if /i not "%MODE%"=="website" if /i not "%MODE%"=="both" (
    echo  Unknown mode "%MODE%". Use: dashboard, website, or both
    echo.
    pause
    exit /b 1
)

REM --- Dependencies ---
if not exist "ai-platform\node_modules\" (
    echo.
    echo  Installing ai-platform dependencies (first run)...
    pushd ai-platform
    call npm install
    if %errorlevel% neq 0 (
        popd
        echo  ERROR: npm install failed in ai-platform
        pause
        exit /b 1
    )
    popd
)

if /i "%MODE%"=="website" goto :need_root_deps
if /i "%MODE%"=="both" goto :need_root_deps
goto :deps_done

:need_root_deps
if not exist "node_modules\" (
    echo.
    echo  Installing root dependencies (first run)...
    call npm install
    if %errorlevel% neq 0 (
        echo  ERROR: npm install failed in project root
        pause
        exit /b 1
    )
)

:deps_done

REM --- Start ---
if /i "%MODE%"=="both" goto :start_both
if /i "%MODE%"=="website" goto :start_website
goto :start_dashboard

:start_dashboard
echo.
echo  Starting full AI Platform (recommended)...
echo    Dashboard:  http://localhost:54355/
echo    WebSocket:  ws://localhost:8081
echo.
echo  Press Ctrl+C to stop the server.
echo.
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:54355/"
node ai-platform\gguf-dashboard-server.js
goto :end

:start_website
echo.
echo  Starting marketing site...
echo    Website:  http://localhost:51543/
echo    Roadmap:  http://localhost:51543/roadmap
echo    WebSocket: ws://localhost:51544
echo.
echo  Press Ctrl+C to stop the server.
echo.
start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:51543/"
node server-51543.js
goto :end

:start_both
echo.
echo  Starting both servers in separate windows...
echo    Dashboard:  http://localhost:54355/
echo    Website:    http://localhost:51543/
echo.
start "Cascade Dashboard :54355" cmd /k "cd /d "%~dp0" && node ai-platform\gguf-dashboard-server.js"
timeout /t 2 /nobreak >nul
start "Cascade Website :51543" cmd /k "cd /d "%~dp0" && node server-51543.js"
timeout /t 4 /nobreak >nul
start http://localhost:54355/
start http://localhost:51543/
echo.
echo  Both servers started. Close their windows to stop them.
echo.
pause
exit /b 0

:end
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: Server exited with an error.
    echo  If the port is in use, run kill-server.bat and try again.
    echo.
    pause
    exit /b 1
)
pause
exit /b 0
