@echo off
cd /d "%~dp0"
set PORT=57040
node serve.cjs
pause
