@echo off
REM Start SimpleBeacon Landing Page server on port 3000
set PORT=3000

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Port 3000 already in use by PID: %%a
    echo Run stop-server.bat first, or visit http://localhost:3000
    exit /b 1
)

echo Starting landing page server on http://localhost:3000
node server.cjs
