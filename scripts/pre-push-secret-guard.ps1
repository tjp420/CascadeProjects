Param()
try {
  $scriptDir = Split-Path -Path $MyInvocation.MyCommand.Definition -Parent
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    Write-Error "node not found in PATH. Install Node.js to run the secret guard."
    exit 1
  }
  & $node.Path (Join-Path $scriptDir 'secret-guard.js')
  $exit = $LASTEXITCODE
  if ($exit -ne 0) {
    Write-Error "pre-push secret guard blocked the push (exit $exit)"
    exit $exit
  }
  exit 0
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
