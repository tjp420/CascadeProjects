# scripts/start-mcp.ps1
# Windows Wrapper to launch the SimpleBeacon local MCP tool server

$ErrorActionPreference = "Stop"

Write-Host "[*] Checking local Node environment dependencies..." -ForegroundColor Cyan
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Node.js/npx runtime not detected on your system PATH." -ForegroundColor Red
    Write-Host "💡 Fix: Please install Node.js (v18+) from https://nodejs.org" -ForegroundColor Yellow
    Exit 1
}

Write-Host "[+] Initializing SimpleBeacon MCP Engine in offline sandbox mode..." -ForegroundColor Green
try {
    # Initialize the local stdio tool server process
    npx simplebeacon-mcp --offline
} catch {
    Write-Host "❌ Execution Interrupted: $($_.Exception.Message)" -ForegroundColor Red
    Exit 1
}
