@echo off
echo Starting AI Platform Server...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo.
echo Starting canonical dashboard server on http://localhost:54355
echo Entry: ai-platform\gguf-dashboard-server.js (root launcher delegates here too)
echo Press Ctrl+C to stop the server
echo.

REM Start the canonical server (same as: node gguf-dashboard-server.js from repo root)
node ai-platform\gguf-dashboard-server.js
