@echo off
echo ========================================
   AI-Powered Development Assistant & Blob System
========================================
echo.
echo Starting AI-powered development assistant and blob system...
echo.

REM Change to the correct directory
cd /d "%~dp0"

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    echo Please install Python and try again
    pause
    exit /b 1
)

REM Show menu options
echo.
echo ========================================
echo 🤖 AI-Powered Development Assistant & Blob System
echo ========================================
echo.
echo Choose your AI-powered tool:
echo 1. 🤖 AI Development Assistant
echo 2. 🤖 AI Blob System
echo 3. ⚙️ System Configuration
echo 0. ❌ Exit
echo.
echo ========================================

set /p choice="Choose an option (0-3): "

if "%choice%"=="1" (
    echo.
    echo 🚀 Starting AI Development Assistant...
    python ai_launcher_real.py
) else if "%choice%"=="2" (
    echo.
    echo 🤖 Starting AI Blob System...
    python ai_blob_system.py
) else if "%choice%"=="3" (
    echo.
    echo ⚙️ System Configuration
    echo.
    echo 📊 AI Service Status:
    python -c "from ai_service import is_ai_available; print('✅ AI Available' if is_ai_available() else '❌ AI Not Available')"
    echo.
    echo 🔑 API Key Configuration:
    if exist .env (
        echo ✅ .env file found
        echo 📝 API Key configured
    ) else (
        echo ❌ .env file not found
        echo 📝 Please create .env with your API key
        echo 📝 See REAL_AI_SETUP_GUIDE.md for instructions
    )
) else if "%choice%"=="0" (
    echo.
    echo 👋 Goodbye!
) else (
    echo.
    echo ❌ Invalid choice: %choice%
    echo.
    echo Please choose 0, 1, 2, or 3
    goto :start
)

if "%choice%"=="0" goto :end

echo.
echo Thank you for using AI-Powered Development Assistant & Blob System!
pause

:start
goto :start

:end
echo.
