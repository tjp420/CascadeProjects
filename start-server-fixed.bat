@echo off
echo Starting AI Platform Server (Fixed Version)...
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
echo Checking and installing required modules...
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
echo Starting main server on http://localhost:54355
echo Press Ctrl+C to stop the server
echo.

REM Start the main server
node ai-platform\gguf-dashboard-server.js

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Main server failed to start
    echo Trying enhanced server on port 8000...
    node enhanced-gguf-server.js
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Enhanced server also failed
        echo Trying simple server...
        node simple-gguf-server.js
        if %errorlevel% neq 0 (
            echo.
            echo ERROR: All servers failed to start
            echo Please check the error messages above
            pause
            exit /b 1
        )
    )
)

echo.
echo Server started successfully!
pause
