@echo off
echo Starting Enhanced AI Platform Server...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Install required modules if not present
echo Checking required modules...
npm list express >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Express.js...
    npm install express
)

npm list ws >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing WebSocket...
    npm install ws
)

echo.
echo Starting Enhanced Server on http://localhost:8000
echo Press Ctrl+C to stop the server
echo.

REM Start the enhanced server (this one is working)
node enhanced-gguf-server.js

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Enhanced server failed to start
    pause
    exit /b 1
)

echo.
echo Enhanced server started successfully!
echo Access the dashboard at: http://localhost:8000/dashboard-new.html
pause
