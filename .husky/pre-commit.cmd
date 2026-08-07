@echo off
echo [lint-assets] Running pre-commit encoding ^& path lint...
node .simplebeacon\qa\lint-assets.cjs
if errorlevel 1 (
  echo [lint-assets] Asset hygiene lint failed. Commit aborted.
  exit /b 1
)
echo [lint-assets] Asset hygiene lint passed.
echo [env-guard] Running production environment safety check...
node .simplebeacon\qa\env-production-guard.cjs
if errorlevel 1 (
  echo [env-guard] Production safety check failed! Commit aborted.
  exit /b 1
)
echo [env-guard] Production safety check passed.
echo [gitleaks] Running staged-files secret scan...
node .simplebeacon\qa\pre-commit-gitleaks.cjs
if errorlevel 1 (
  echo [gitleaks] Secrets detected in staged files! Commit aborted.
  exit /b 1
)
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
