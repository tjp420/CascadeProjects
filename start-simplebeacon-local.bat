@echo off
REM SimpleBeacon Local Server Starter (convenience wrapper)
REM This is the file referenced by the dashboard error message

echo Starting SimpleBeacon local server...
cd /d "%~dp0"
call start-dashboard.bat
