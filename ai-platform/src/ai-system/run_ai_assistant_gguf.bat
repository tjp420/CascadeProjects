@echo off
chcp 65001 >nul
echo ========================================
   AI-Powered Development Assistant with GGUF
========================================
echo.
echo Starting AI-powered development assistant with GGUF support...
echo.
echo Tip: Configure API key for cloud AI or use GGUF for local AI
echo    Run: python setup_api_key.py
echo.
echo Your AI Platform with GGUF is ready! Choose your tool below:
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
:menu
echo.
echo ========================================
   AI-Powered Development Assistant with GGUF
========================================
echo.
echo Choose your AI-powered tool:
echo 1. AI Development Assistant (Cloud AI)
echo 2. AI Development Assistant (GGUF Local AI)
echo 3. AI Blob System (Cloud AI)
echo 4. AI Blob System (GGUF Local AI)
echo 5. System Configuration
echo 0. Exit
echo.
echo ========================================

set /p choice="Choose an option (0-5): "

if "%choice%"=="1" (
    echo.
    echo Starting AI Development Assistant (Cloud AI)...
    set AI_PROVIDER=openai
    python ai_launcher_simple.py
) else if "%choice%"=="2" (
    echo.
    echo Starting AI Development Assistant (GGUF Local AI)...
    set AI_PROVIDER=gguf
    python ai_launcher_simple.py
) else if "%choice%"=="3" (
    echo.
    echo Starting AI Blob System (Cloud AI)...
    set AI_PROVIDER=openai
    python ai_blob_system_final.py
) else if "%choice%"=="4" (
    echo.
    echo Starting AI Blob System (GGUF Local AI)...
    set AI_PROVIDER=gguf
    python ai_blob_system_final.py
) else if "%choice%"=="5" (
    echo.
    echo System Configuration
    echo.
    echo AI Service Status:
    python -c "from ai_service_enhanced import is_enhanced_ai_available; print('AI Available' if is_enhanced_ai_available() else 'AI Not Available')"
    echo.
    echo GGUF Service Status:
    python -c "try: from gguf_service import is_gguf_available; print('GGUF Available' if is_gguf_available() else 'GGUF Not Available') except: print('GGUF Service Not Available')"
    echo.
    echo API Key Configuration:
    if exist .env (
        echo .env file found
        echo API Key configured for cloud AI
    ) else (
        echo .env file not found
        echo Please create .env with your API key
        echo See REAL_AI_SETUP_GUIDE.md for instructions
    )
    echo.
    echo GGUF Model Status:
    if exist blobs\sha256-dde5aa3fc5ffc17176b5e8bdc82f587b24b2678c6c66101bf7da77af9f7ccdff (
        echo GGUF model found: unbreakable-oracle.gguf (1.88GB)
    ) else (
        echo GGUF model not found
        echo Place GGUF model in blobs directory
    )
) else if "%choice%"=="0" (
    echo.
    echo Goodbye!
    goto :end
) else (
    echo.
    echo Invalid choice: %choice%
    echo.
    echo Please choose 0, 1, 2, 3, 4, or 5
    goto :menu
)

echo.
echo Thank you for using AI-Powered Development Assistant with GGUF!
pause
goto :menu

:end
echo.
