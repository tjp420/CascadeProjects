@echo off
REM Start SimpleBeacon server fresh (kills old processes first)

echo [1/3] Killing any existing Node.js processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] Starting SimpleBeacon server on port 3000...
cd /d "%~dp0\ai-platform"
set PORT=3000
start "SimpleBeacon Server" cmd /k "node server\index.cjs"

echo [3/3] Waiting for server to be ready...
:wait_loop
timeout /t 1 /nobreak >nul
netstat -ano | findstr :3000 | findstr LISTENING >nul
if errorlevel 1 goto wait_loop

echo.
echo ==========================================
echo  Server is running on http://localhost:3000
echo ==========================================
echo.
echo  Test the API:
echo  curl http://localhost:3000/api/health/routes
echo.
pause
