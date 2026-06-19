@echo off
REM ai-tools pre-commit hook for Windows
REM 1. Syntax-check all staged JS/CJS files
for /f "delims=" %%f in ('git diff --cached --name-only --diff-filter=ACM ^| findstr /E "\.js \.cjs"') do (
    echo Checking syntax: %%f
    node -c "%%f" || (
        echo Syntax error in %%f
        exit /b 1
    )
)

REM 2. Run SimpleBeacon gate scan (fail on high/critical severity)
echo Running SimpleBeacon gate scan...
npx simplebeacon scan --gate --format json || (
    echo SimpleBeacon gate scan failed. Fix blocking issues before committing.
    exit /b 1
)

REM 3. Run test suite
echo Running tests...
npm test || exit /b 1
