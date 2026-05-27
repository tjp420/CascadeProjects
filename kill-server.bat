@echo off
echo Stopping any running Node.js processes...
echo.

REM Kill all Node.js processes
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js processes stopped
) else (
    echo No Node.js processes found running
)

echo.
echo Checking if port 54355 is still in use...
timeout /t 2 >nul
netstat -an | findstr :54355
if %errorlevel% equ 0 (
    echo Port 54355 is still in use (connections in TIME_WAIT state)
    echo This is normal after closing connections
) else (
    echo Port 54355 is now free
)

echo.
echo Server processes stopped. You can now restart the server.
pause
