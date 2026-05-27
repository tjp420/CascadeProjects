@echo off
echo 🚀 Starting AI Coding Intelligence Dashboard Server...
echo.
echo ⚠️  IMPORTANT: Use Node.js Server for ES6 Modules!
echo.
echo 📡 Server Options:
echo.
echo 1. Node.js Server (RECOMMENDED - Proper ES6 Module Support)
echo 2. Python Server (Fixed - May have issues with some modules)
echo 3. Simple Node.js Server (Guaranteed to work)
echo.
set /p choice="Choose server option (1-3): "

if "%choice%"=="1" (
    echo 🟢 Starting Node.js server with proper ES6 module support...
    echo 📡 Server will run on: http://localhost:8000
    echo 🎯 Dashboard URL: http://localhost:8000/index.html
    echo 📚 Documentation: http://localhost:8000/documentation_portal.html
    echo.
    echo 🛑 Press Ctrl+C to stop the server
    echo.
    node server.js
) else if "%choice%"=="2" (
    echo 🐍 Starting Python server with ES6 module support...
    echo 📡 Server will run on: http://localhost:8000
    echo 🎯 Dashboard URL: http://localhost:8000/index.html
    echo 📚 Documentation: http://localhost:8000/documentation_portal.html
    echo.
    echo 🛑 Press Ctrl+C to stop the server
    echo.
    python simple_server.py
) else if "%choice%"=="3" (
    echo � Starting Simple Node.js server (guaranteed to work)...
    echo 📡 Server will run on: http://localhost:8000
    echo 🎯 Dashboard URL: http://localhost:8000/index.html
    echo 📚 Documentation: http://localhost:8000/documentation_portal.html
    echo.
    echo 🛑 Press Ctrl+C to stop the server
    echo.
    node server_simple.js
) else (
    echo ❌ Invalid choice. Please run the script again.
)

pause
