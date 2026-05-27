@echo off
echo Quick Start AI Platform Server
echo ================================
echo.

REM Kill any existing Node.js processes
echo Stopping any existing servers...
taskkill /F /IM node.exe >nul 2>&1

REM Wait a moment for processes to stop
timeout /t 2 >nul

REM Install dependencies
echo Installing dependencies...
npm install express ws >nul 2>&1

echo.
echo Starting GGUF Dashboard Server (port 54355)...
echo.

REM Start the full dashboard server with dynamic roadmap API
start cmd /k "cd /d "%~dp0" && node ai-platform\gguf-dashboard-server.js"

REM Wait for server to start
timeout /t 3 >nul

echo.
echo ========================================
echo SERVER STARTED SUCCESSFULLY!
echo ========================================
echo.
echo Access the AI Platform at:
echo http://localhost:54355/
echo.
echo Alternative URLs:
echo http://localhost:54355/dashboard-new.html
echo http://localhost:54355/api/dynamic-roadmap/
echo.
echo Press any key to open in browser...
pause >nul

REM Open in default browser
start http://localhost:54355/

echo.
echo Server is running in the background window.
echo Close that window to stop the server.
pause
