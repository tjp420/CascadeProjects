@echo off
echo [lint-assets] Running pre-commit encoding ^& path lint...
node .simplebeacon\qa\lint-assets.cjs
if errorlevel 1 (
  echo [lint-assets] Asset hygiene lint failed. Commit aborted.
  exit /b 1
)
echo [lint-assets] Asset hygiene lint passed.
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
npm run sb:hook:pre-commit
if errorlevel 1 exit /b 1
echo [SimpleBeacon] Pre-commit passed
