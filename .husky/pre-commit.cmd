@echo off
echo [SimpleBeacon] Running staged secrets gate...
call npm run sb:hook:secrets-gate
if errorlevel 1 exit /b 1

echo [SimpleBeacon] Syntax-checking staged JS/CJS files...
for /f "delims=" %%f in ('git diff --cached --name-only --diff-filter=ACM') do (
  echo %%f | findstr /E /R "\.js \.cjs" >nul
  if not errorlevel 1 (
    node -c "%%f" || (
      echo [SimpleBeacon] Syntax error in %%f
      exit /b 1
    )
  )
)
echo [SimpleBeacon] Running gate scan...
call npx simplebeacon scan --gate --fail-on high --config ai-platform/.simplebeacon/config.json
if errorlevel 1 exit /b 1
echo [SimpleBeacon] Pre-commit passed
