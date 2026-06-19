@echo off
npx simplebeacon scan --gate --fail-on high
if errorlevel 1 exit /b 1
