@echo off
echo Diagnosing Server Issues...
echo.

REM Check Node.js
echo Checking Node.js installation...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed
    pause
    exit /b 1
) else (
    echo Node.js is installed
)

echo.

REM Check if server files exist
echo Checking server files...
if exist "gguf-dashboard-server.js" (
    echo Found: gguf-dashboard-server.js
) else (
    echo ERROR: gguf-dashboard-server.js not found
)

if exist "enhanced-gguf-server.js" (
    echo Found: enhanced-gguf-server.js
) else (
    echo WARNING: enhanced-gguf-server.js not found
)

if exist "simple-gguf-server.js" (
    echo Found: simple-gguf-server.js
) else (
    echo WARNING: simple-gguf-server.js not found
)

echo.

REM Check if ai-platform directory exists
echo Checking ai-platform directory...
if exist "ai-platform\web" (
    echo Found: ai-platform\web directory
) else (
    echo WARNING: ai-platform\web directory not found
)

echo.

REM Check installed packages
echo Checking installed packages...
npm list express
npm list ws
npm list path
npm list fs

echo.

REM Check if port 54355 is in use
echo Checking if port 54355 is in use...
netstat -an | findstr :54355
if %errorlevel% equ 0 (
    echo WARNING: Port 54355 is already in use
    echo Try closing other applications using this port
) else (
    echo Port 54355 is available
)

echo.

REM Test Node.js syntax
echo Testing server file syntax...
node -c gguf-dashboard-server.js
if %errorlevel% equ 0 (
    echo gguf-dashboard-server.js syntax is OK
) else (
    echo ERROR: gguf-dashboard-server.js has syntax errors
)

echo.
echo Diagnosis complete. Review the output above.
pause
