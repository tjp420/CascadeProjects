@echo off
REM Start SimpleBeacon development servers (frontend + API)

echo ==========================================
echo  SimpleBeacon Development Server Starter
echo ==========================================
echo.

REM Kill only processes on specific ports to avoid collateral damage
echo [1/4] Stopping existing servers on ports 54355 and 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :54355 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
ping -n 2 127.0.0.1 >nul

REM Start the API server (port 54355) with Redis disabled
echo [2/4] Starting API server on http://localhost:54355 ...
start "SimpleBeacon API" cmd /k "cd /d C:\Users\Trevor\CascadeProjects\ai-platform && set REDIS_URL= && set ENABLE_REDIS=false && node simplebeacon-server.cjs"

REM Wait for API to be ready
echo [3/4] Waiting for API server to start...
:wait_api
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr :54355 | findstr LISTENING >nul
if errorlevel 1 goto wait_api
echo        API server is ready!

REM Start the frontend server (port 3000)
echo [4/4] Starting frontend server on http://localhost:3000 ...
start "SimpleBeacon Frontend" cmd /k "cd /d C:\Users\Trevor\CascadeProjects\coming-soon && set PORT=3000 && node server.cjs"

REM Wait for frontend
echo        Waiting for frontend server...
:wait_frontend
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr :3000 | findstr LISTENING >nul
if errorlevel 1 goto wait_frontend
echo        Frontend server is ready!

echo.
echo ==========================================
echo  All servers are running!
echo ==========================================
echo.
echo  Frontend:  http://localhost:3000
echo  API:       http://localhost:54355
echo.
echo  Open your browser to:
echo  http://localhost:3000/certificate-upload.html
echo.
pause
