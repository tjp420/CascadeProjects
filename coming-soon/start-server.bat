@echo off
REM Start SimpleBeacon Landing Page server on port 3001
set PORT=3001

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Port 3001 already in use by PID: %%a
    echo Run stop-server.bat first, or visit http://localhost:3001
    exit /b 1
)

echo Starting landing page server on http://localhost:3001
node server.cjs
