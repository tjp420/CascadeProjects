@echo off
REM Start SimpleBeacon MCP HTTP Server on port 54355
setlocal enabledelayedexpansion

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :54355 ^| findstr LISTENING') do (
    echo Port 54355 already in use by PID: %%a
    echo Run stop-mcp-server.bat first, or visit http://localhost:54355
    exit /b 1
)

echo Starting MCP HTTP server on http://localhost:54355
echo Mode: Air-gapped (all scans run locally, zero network activity)
node mcp-http-server.cjs
