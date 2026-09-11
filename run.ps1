# run.ps1
# SimpleBeacon Unified Windows Environment Execution & Diagnostic Wrapper

param(
    [Parameter(Mandatory=$false, Position=0)]
    [string]$Command,
    [Parameter(Mandatory=$false, Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$RemainingArgs
)

if (-not $Command) {
    Write-Host "❌ Error: Missing command argument." -ForegroundColor Red
    Write-Host "💡 Usage: .\run.ps1 [scan | message | test] [arguments]" -ForegroundColor Yellow
    Write-Host "   Example: .\run.ps1 scan --lockfile package-lock.json" -ForegroundColor Yellow
    Exit 1
}

# 1. Resolve Python Binary Priority Logic
$PythonBin = $null
foreach ($bin in @("py", "python", "python3")) {
    $check = Get-Command $bin -ErrorAction SilentlyContinue
    if ($check) {
        # Avoid Microsoft Store empty stubs that throw Access Denied errors
        if ($check.Path -and ($check.Path -like "*WindowsApps*")) { continue }
        $PythonBin = $bin
        break
    }
}

# If none found, leave $PythonBin null so we immediately consider Docker fallback

# 2. Map Script Operational Routing Commands
$ScriptPath = $null
switch ($Command) {
    "scan"    { $ScriptPath = "node_license_analyzer.py" }
    "message" { $ScriptPath = "tools/leads_manager.py" }
    "test"    { $ScriptPath = "-m unittest discover -s tests" }
    Default   { 
        Write-Host "❌ Error: Unrecognized operational routing: '$Command'" -ForegroundColor Red
        Exit 1
    }
}

Write-Host "[*] Launching SimpleBeacon pipeline using runtime engine: '$PythonBin'..." -ForegroundColor Cyan

function Invoke-DockerFallback {
    Write-Host "`n🐳 [AUTOMATED FAILOVER] Local runtime engine blocked or missing. Attempting containerized execution..." -ForegroundColor Yellow
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        Write-Host "❌ Failover Dropped: Docker CLI not found or not running on host." -ForegroundColor Red
        Write-Host "🛠️ Manual Resolution Steps:" -ForegroundColor Green
        Write-Host "  1. Open Settings -> Apps -> App execution aliases and turn OFF 'python.exe' and 'python3.exe' toggles." -ForegroundColor White
        Write-Host "  2. Install official Python from https://python.org and add it to PATH." -ForegroundColor White
        Write-Host "  3. Alternatively, install Docker Desktop and re-run this command for immediate failover." -ForegroundColor White
        return 1
    }

    $cwd = (Get-Location).Path
    if ($Command -eq "test") {
        Write-Host "[*] Running tests inside container (python:3.11-slim)..." -ForegroundColor Cyan
        & docker run --rm -v "${cwd}:/work" -w /work python:3.11-slim python -m unittest discover -s tests
        return $LASTEXITCODE
    } else {
        Write-Host "[*] Executing target script inside container (python:3.11-slim)..." -ForegroundColor Cyan
            $dockerArgs = @('run','--rm','-v',"${cwd}:/work",'-w','/work','python:3.11-slim','python',$ScriptPath,$Command) + $RemainingArgs
            & docker @dockerArgs
        return $LASTEXITCODE
    }
}

# If we detected an MS Store stub or found no usable interpreter, prefer Docker failover immediately
if ($PythonBin) {
    $cmdCheck = Get-Command $PythonBin -ErrorAction SilentlyContinue
    if ($cmdCheck -and $cmdCheck.Path -and ($cmdCheck.Path -like "*WindowsApps*")) {
        Write-Host "⚠️ Detected Microsoft Store Python stub for '$PythonBin' — skipping local run and using Docker failover." -ForegroundColor Yellow
        $code = Invoke-DockerFallback
        exit $code
    }
} else {
    Write-Host "⚠️ No local Python interpreter detected; attempting Docker failover..." -ForegroundColor Yellow
    $code = Invoke-DockerFallback
    exit $code
}

# 3. Intercept and Execute the Commands with Safety Traps
try {
    if ($Command -eq "test") {
        $cmd = "$PythonBin -m unittest discover -s tests"
        Write-Host "[.] Executing: $cmd" -ForegroundColor Gray
        Invoke-Expression $cmd
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️ Local test run failed with exit code $LASTEXITCODE; invoking Docker failover..." -ForegroundColor Yellow
            $code = Invoke-DockerFallback
            exit $code
        }
    } else {
        $invokeArgs = @($ScriptPath) + $RemainingArgs
            Write-Host "[.] Executing: $PythonBin $($invokeArgs -join ' ')" -ForegroundColor Gray
            $invokeArgs = @($ScriptPath, $Command) + $RemainingArgs
        & $PythonBin @invokeArgs
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️ Local run failed with exit code $LASTEXITCODE; invoking Docker failover..." -ForegroundColor Yellow
            $code = Invoke-DockerFallback
            exit $code
        }
    }
} catch {
    $err = $_.Exception
    $ErrCode = $null
    try { $ErrCode = $err.HResult } catch { }
    Write-Host "`n⚠️ System Execution Interrupted!" -ForegroundColor Yellow

    # Known Windows Access Denied (0x80070005) -> HResult -2147024891
    if ($ErrCode -eq -2147024891 -or ($err.Message -like "*Access is denied*")) {
        Write-Host "❌ [0x80070005] Access Denied Error Detected!" -ForegroundColor Red
        Write-Host "💡 Microsoft Store Python app execution alias appears to be blocking execution." -ForegroundColor Yellow
        Write-Host "Attempting automated Docker failover..." -ForegroundColor Cyan
        $code = Invoke-DockerFallback
        exit $code
    } else {
        Write-Host "❌ Local run failed: $($err.Message)" -ForegroundColor Red
        Write-Host "Attempting Docker failover as a rescue run..." -ForegroundColor Cyan
        $code = Invoke-DockerFallback
        exit $code
    }
}
