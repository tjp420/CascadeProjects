@echo off
REM Kill and restart SimpleBeacon server

echo [1/3] Killing existing Node.js server processes...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Simplebeacon Dashboard*" 2>nul
taskkill /F /IM node.exe /FI "WINDOWTITLE eq SimpleBeacon API*" 2>nul

REM Kill processes on known ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :55000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :54355 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul

ping -n 3 127.0.0.1 >nul

echo [2/3] Starting dashboard server...
cd /d "%~dp0"
start "Simplebeacon Dashboard" cmd /k "cd /d %~dp0\ai-platform && set PORT=55000 && node simplebeacon-server.cjs"

echo [3/3] Waiting for server...
:wait_loop
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr :55000 | findstr LISTENING >nul
if errorlevel 1 goto wait_loop

echo Server is ready on http://localhost:55000
pause
