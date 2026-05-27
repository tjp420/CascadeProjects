@echo off
echo Starting Dashboard Servers...
echo.

echo Starting API Server on port 8081...
start "API Server" cmd /c "cd /d %~dp0api && python simple_server.py"

echo Waiting for API server to start...
timeout /t 3 /nobreak >nul

echo Starting Frontend Server on port 58878...
start "Frontend Server" cmd /c "cd /d %~dp0 && python -m http.server 58878"

echo.
echo Servers started!
echo API Server: http://localhost:8081
echo Frontend: http://localhost:58878
echo.
echo Press any key to continue...
pause >nul
