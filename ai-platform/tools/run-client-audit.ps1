param(
    [Parameter(Mandatory = $true)]
    [string]$ClientPath,
    [Parameter(Mandatory = $true)]
    [string]$CompanyName,
    [string]$Assessor = "Trevor",
    [string]$SandboxRoot = "C:\Users\Trevor\AuditSandbox"
)

$ErrorActionPreference = "Stop"
$CliRoot = Join-Path $PSScriptRoot "..\packages\simplebeacon-cli"
$CliBin = Join-Path $CliRoot "bin\simplebeacon.js"
$ClientPath = (Resolve-Path $ClientPath).Path

Push-Location $ClientPath
try {
    Write-Host "Scanning $ClientPath ..."
    node $CliBin scan --path . --format json --output .simplebeacon\client-report.json --gate
    node $CliBin assess --company $CompanyName --assessor $Assessor --report .simplebeacon\client-report.json
    node (Join-Path $CliRoot "src\reporters\build-report.js") $CompanyName $Assessor .simplebeacon\client-report.json AUDIT_REPORT.md
    if (Get-Command npx -ErrorAction SilentlyContinue) {
        npx --yes md-to-pdf AUDIT_REPORT.md
        Write-Host "Done: $(Join-Path $ClientPath 'AUDIT_REPORT.pdf')"
    } else {
        Write-Host "Done: $(Join-Path $ClientPath 'AUDIT_REPORT.md') (install md-to-pdf for PDF)"
    }
} finally {
    Pop-Location
}
