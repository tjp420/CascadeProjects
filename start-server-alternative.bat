@echo off
echo Starting Alternative AI Platform Server...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Try alternative server if main one fails
echo Trying main server first...
node ai-platform\gguf-dashboard-server.js
if %errorlevel% neq 0 (
    echo.
    echo Main server failed, trying enhanced server...
    node enhanced-gguf-server.js
    if %errorlevel% neq 0 (
        echo.
        echo Enhanced server failed, trying simple server...
        node simple-gguf-server.js
        if %errorlevel% neq 0 (
            echo.
            echo ERROR: All servers failed to start
            pause
            exit /b 1
        )
    )
)
