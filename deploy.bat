@echo off
chcp 65001 >nul
echo ==========================================
echo   SimpleBeacon Render Deploy Tool
echo ==========================================
echo.

REM Step 1: Validate and push
echo [1/3] Validating setup and pushing to GitHub...
node deploy-to-render.js
if errorlevel 1 (
    echo.
    echo FAILED: Validation or push failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Opening Render Dashboard...
echo     Change these settings in your service:
echo     - Root Directory: (blank)
echo     - Build Command: npm install
echo     - Start Command: node coming-soon/server.cjs
echo.
start https://dashboard.render.com/web-services
echo.

echo [3/3] Done! Your code is pushed to GitHub.
echo     Render should auto-deploy if enabled.
echo     If not, click "Manual Deploy" in the dashboard.
echo.
echo Your live URL will be: https://simplebeacon.onrender.com
echo.
pause
