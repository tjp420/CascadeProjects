Param(
    [switch]$BuildOnly,
    [switch]$InstallOnly,
    [string]$OutputDir = ".\dist\vsix"
)

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$extDir = Join-Path $root "simplebeacon-vscode-merged"
if (-not (Test-Path $extDir)) {
    Write-Error "Extension directory $extDir not found. Run this from the repo root."
    exit 1
}

if ($BuildOnly -and $InstallOnly) {
    Write-Error "Cannot pass both -BuildOnly and -InstallOnly"
    exit 1
}

# Read package.json version
$pkgJsonPath = Join-Path $extDir 'package.json'
if (-not (Test-Path $pkgJsonPath)) {
    Write-Error "package.json not found in extension directory"
    exit 1
}
$pkg = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
$version = $pkg.version -replace '[^0-9a-zA-Z.\-]',''

# Prepare output
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$vsixFile = Join-Path (Resolve-Path $OutputDir) ("simplebeacon-vscode-" + $version + ".vsix")

function Package-VSIX {
    Push-Location $extDir
    try {
        Write-Host "Packaging extension from $extDir -> $vsixFile"
        # Use npx vsce to package; npx will fetch vsce if not installed
        $args = @('vsce','package','--out',$vsixFile)
        $proc = Start-Process -FilePath 'npx' -ArgumentList $args -NoNewWindow -Wait -PassThru
        if ($proc.ExitCode -ne 0) {
            throw "vsce packaging failed with exit code $($proc.ExitCode)"
        }
    } finally {
        Pop-Location
    }
}

function Install-VSIX {
    param([string]$PathToVsix)
    if (-not (Test-Path $PathToVsix)) { throw "VSIX not found at $PathToVsix" }

    # Check for 'code' CLI
    $codeCmd = Get-Command code -ErrorAction SilentlyContinue
    if (-not $codeCmd) {
        Write-Warning "'code' CLI not found in PATH. Attempting to call common install path for Windows. If this fails, install 'code' CLI from the command palette: 'Shell Command: Install 'code' command in PATH' or add code to PATH."
    }

    Write-Host "Installing VSIX: $PathToVsix"
    $installArgs = @('--install-extension', $PathToVsix, '--force')
    $proc = Start-Process -FilePath 'code' -ArgumentList $installArgs -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
    if ($proc -and $proc.ExitCode -ne 0) { Write-Warning "code --install-extension returned exit code $($proc.ExitCode)" }
}

function Restart-VSCode {
    Write-Host "Restarting VS Code (if running)"
    $p = Get-Process -Name 'Code' -ErrorAction SilentlyContinue
    if ($p) {
        $p | ForEach-Object { Stop-Process -Id $_.Id -Force }
        Start-Sleep -Seconds 1
    } else {
        Write-Host "No running VS Code process found. Starting a new instance."
    }

    # Start code (may be in PATH)
    try {
        Start-Process 'code'
    } catch {
        Write-Warning "Failed to start 'code' from PATH. If you use VS Code Insiders or a non-standard installation, start the editor manually."
    }
}

if (-not $InstallOnly) {
    Package-VSIX
}

if (-not $BuildOnly) {
    Install-VSIX -PathToVsix $vsixFile
    Restart-VSCode
}

Write-Host "Done. VSIX available at: $vsixFile"