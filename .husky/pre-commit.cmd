@echo off
npm run sb:hook:pre-commit
if errorlevel 1 exit /b 1
