@echo off
REM Start SimpleBeacon MCP HTTP Server on port 3002
setlocal enabledelayedexpansion

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3002 ^| findstr LISTENING') do (
    echo Port 3002 already in use by PID: %%a
    echo Run stop-mcp-server.bat first, or visit http://localhost:3002
    exit /b 1
)

echo Starting MCP HTTP server on http://localhost:3002
echo Mode: Air-gapped (all scans run locally, zero network activity)
node mcp-http-server.cjs
