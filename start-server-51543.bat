@echo off
echo Starting Website Server for Port 51543...
echo =====================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if required modules are installed
echo Checking required modules...
npm list express >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing Express.js...
    npm install express
)

npm list cors >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing CORS...
    npm install cors
)

npm list ws >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing WebSocket...
    npm install ws
)

echo.
echo Starting Website Server on http://localhost:51543
echo Press Ctrl+C to stop the server
echo.

REM Start the server
node server-51543.js

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Server failed to start
    echo Check the error message above for details
    pause
    exit /b 1
)

echo.
echo Server started successfully!
echo Access the website at: http://localhost:51543
pause
