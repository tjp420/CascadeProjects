@echo off
setlocal EnableDelayedExpansion

set PORT=54449

echo Finding process on port %PORT%...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
    set PID=%%a
    echo Found PID: !PID!
    echo Killing process !PID!...
    taskkill /PID !PID! /F >nul 2>&1
    if !errorlevel! equ 0 (
        echo Successfully killed process !PID! on port %PORT%
    ) else (
        echo Failed to kill process !PID!. Try running as Administrator.
    )
    goto :done
)

echo No process found listening on port %PORT%

:done
endlocal
pause
