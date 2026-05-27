param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Paths,
    [string]$Dir,
    [string]$Out = "simplebeacon-diagnostic-bundle.json"
)

$ErrorActionPreference = "Stop"
$Script = Join-Path $PSScriptRoot "prepare-diagnostic-bundle.js"
$OutPath = Join-Path (Get-Location) $Out

if ($Dir) {
    node $Script --dir (Resolve-Path $Dir).Path --out $OutPath
    exit $LASTEXITCODE
}

if (-not $Paths -or $Paths.Count -eq 0) {
    Write-Host "Usage:"
    Write-Host "  .\prepare-diagnostic-bundle.ps1 -Dir C:\path\to\server\config"
    Write-Host "  .\prepare-diagnostic-bundle.ps1 file1.json file2.env -Out bundle.json"
    exit 1
}

$resolved = @()
for ($i = 0; $i -lt $Paths.Count; $i++) {
    if ($Paths[$i] -eq '-Out') {
        if ($i + 1 -lt $Paths.Count) { $OutPath = Join-Path (Get-Location) $Paths[$i + 1] }
        continue
    }
    if ($i -gt 0 -and $Paths[$i - 1] -eq '-Out') { continue }
    $resolved += (Resolve-Path $Paths[$i]).Path
}

node $Script @resolved --out $OutPath
exit $LASTEXITCODE
