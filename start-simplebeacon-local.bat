@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
set "PLATFORM=%ROOT%ai-platform"
set "ENV_FILE=%PLATFORM%\.env.v1-internal"
set "PORT=54355"
set "BASE_URL=http://localhost:%PORT%"
set "SERVER_TITLE=SimpleBeacon SERVER - keep this window open"

cd /d "%PLATFORM%"
if errorlevel 1 (
  echo Error: ai-platform folder not found at %PLATFORM%
  pause
  exit /b 1
)

if not exist "%ENV_FILE%" (
  echo Error: Missing %ENV_FILE%
  echo Copy .env.v1-internal.example to .env.v1-internal and set DASHBOARD_VAULT_PASSWORD.
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

set "STARTED_SERVER=0"
echo.
echo Restarting SimpleBeacon server on port %PORT% ^(stops any old node process^)...
node tools/kill-dashboard-ports.js
timeout /t 2 /nobreak >nul
echo Starting the server in a separate window...
echo Look for: "%SERVER_TITLE%"
echo.
start "%SERVER_TITLE%" cmd /k "title %SERVER_TITLE% && cd /d ""%PLATFORM%"" && echo. && echo SimpleBeacon local server - DO NOT CLOSE THIS WINDOW && echo Stopping here stops localhost:%PORT% && echo. && npm run staging:paywall"
set "STARTED_SERVER=1"

echo Waiting for %BASE_URL% ...
set "ATTEMPTS=0"

:wait_loop
set /a ATTEMPTS+=1
powershell -NoProfile -Command "try { $h = Invoke-WebRequest -Uri '%BASE_URL%/api/health/routes' -UseBasicParsing -TimeoutSec 3; if ($h.StatusCode -ne 200) { exit 1 }; $body = $h.Content | ConvertFrom-Json; if (-not $body.dataCleanup) { exit 1 }; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  if !ATTEMPTS! GEQ 90 (
    echo.
    echo Timed out waiting for the server.
    if "!STARTED_SERVER!"=="1" (
      echo Check the "%SERVER_TITLE%" window for npm errors.
    ) else (
      echo Nothing is listening on port %PORT%. Try closing old node windows and run this again.
    )
    pause
    exit /b 1
  )
  timeout /t 1 /nobreak >nul
  goto wait_loop
)

echo Opening sample audit report ^(same as simplebeacon.ai/sample-report^)...
powershell -NoProfile -Command "$pass = [uri]::EscapeDataString($env:VAULT_PASS); Start-Process ('%BASE_URL%/private-dashboard-vault?password=' + $pass)"

echo.
echo ========================================
echo  SimpleBeacon is running on %BASE_URL%
echo ========================================
echo.
echo SAMPLE REPORT:  %BASE_URL%/sample-report
echo FACTORY DASH:   %BASE_URL%/app  ^(after vault unlock^)
echo.
if "!STARTED_SERVER!"=="1" (
  echo KEEP OPEN:  "%SERVER_TITLE%"
  echo              ^(separate black command window^)
  echo.
  echo OK TO CLOSE: This launcher window after you read this.
) else (
  echo Server was already running before this launcher started.
  echo Keep the existing "%SERVER_TITLE%" window open while you work.
  echo You can close this launcher window now.
)
echo.
echo Closing the SERVER window stops the site ^(browser will show connection refused^).
echo.
pause
