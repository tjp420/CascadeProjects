@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "PLATFORM=%ROOT%ai-platform"
set "ENV_FILE=%PLATFORM%\.env.v1-internal"
set "PORT=54355"
set "BASE_URL=http://localhost:%PORT%"
set "SERVER_TITLE=SimpleBeacon SERVER - keep this window open"

if not exist "%PLATFORM%" (
  echo Error: ai-platform folder not found at %PLATFORM%
  pause
  exit /b 1
)

if not exist "%ENV_FILE%" (
  echo Error: Missing %ENV_FILE%
  echo Copy ai-platform\.env.v1-internal.example to .env.v1-internal and set DASHBOARD_VAULT_PASSWORD.
  pause
  exit /b 1
)

set "VAULT_PASS="
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENV_FILE%") do (
  if /I "%%a"=="DASHBOARD_VAULT_PASSWORD" set "VAULT_PASS=%%b"
)

if not defined VAULT_PASS (
  echo Error: DASHBOARD_VAULT_PASSWORD is not set in .env.v1-internal
  pause
  exit /b 1
)

for /f "tokens=* delims= " %%a in ("!VAULT_PASS!") do set "VAULT_PASS=%%a"

cd /d "%PLATFORM%"

echo Checking SimpleBeacon on %BASE_URL% ...
set "ATTEMPTS=0"

:wait_health
set /a ATTEMPTS+=1
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '%BASE_URL%/api/health' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto server_ok

if !ATTEMPTS! GEQ 5 (
  echo.
  echo Server is not running on port %PORT%.
  echo.
  choice /C YN /M "Start the server now (opens a separate SERVER window)"
  if errorlevel 2 (
    echo Run start-simplebeacon-local.bat when you are ready, then try this again.
    pause
    exit /b 1
  )
  echo Starting server...
  start "%SERVER_TITLE%" cmd /k "title %SERVER_TITLE% && cd /d ""%PLATFORM%"" && echo SimpleBeacon local server - DO NOT CLOSE && npm run staging:paywall"
  set "ATTEMPTS=0"
)

timeout /t 2 /nobreak >nul
goto wait_health

:server_ok
echo Unlocking private vault session...
powershell -NoProfile -Command "$pass = [uri]::EscapeDataString('%VAULT_PASS%'); Start-Process ('%BASE_URL%/private-dashboard-vault?password=' + $pass)"

echo Opening factory dashboard...
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "Start-Process '%BASE_URL%/app'"

echo.
echo ========================================
echo  Private localhost
echo ========================================
echo  Vault unlock:  %BASE_URL%/private-dashboard-vault
echo  Dashboard:     %BASE_URL%/app
echo  Analyze:       %BASE_URL%/app#/analyze
echo.
echo Keep the SERVER window open while you work.
echo To restart with latest code: start-simplebeacon-local.bat
echo.
pause
