@echo off
REM SimpleBeacon License Token Generator Launcher
REM Usage: generate-token.bat [options]
REM   --tier <tier>       : executive | instant | euai | universal
REM   --email <email>     : customer email address
REM   --project <name>    : project name
REM   --client <name>     : client name
REM   --days <n>          : expiry in days
REM   --setup             : create .env configuration file
REM   --verify <token>    : verify an existing token
REM
REM Example: generate-token.bat --tier executive --email alice@example.com --project "My App" --days 90

set "SCRIPT_DIR=%~dp0"
node "%SCRIPT_DIR%generate-license-token.cjs" %*
