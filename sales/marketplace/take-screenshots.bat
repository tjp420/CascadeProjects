@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "take-screenshots.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo Script exited with error %ERRORLEVEL%
)
endlocal
pause
