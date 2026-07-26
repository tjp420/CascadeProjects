$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$root = $root.ProviderPath
$stg = Join-Path $root 'vsix-staging'
if (Test-Path $stg) { Remove-Item -LiteralPath $stg -Recurse -Force }
New-Item -ItemType Directory -Path $stg | Out-Null

# Copy minimal runtime files
Copy-Item -LiteralPath (Join-Path $root 'package.json') -Destination $stg -Force
Copy-Item -LiteralPath (Join-Path $root 'README.md') -Destination $stg -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath (Join-Path $root 'LICENSE') -Destination $stg -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath (Join-Path $root 'icon.png') -Destination $stg -Force -ErrorAction SilentlyContinue

if (Test-Path (Join-Path $root 'out')) { Copy-Item -LiteralPath (Join-Path $root 'out') -Destination $stg -Recurse -Force }
if (Test-Path (Join-Path $root 'media')) { Copy-Item -LiteralPath (Join-Path $root 'media') -Destination $stg -Recurse -Force }
if (Test-Path (Join-Path $root 'resources')) { Copy-Item -LiteralPath (Join-Path $root 'resources') -Destination $stg -Recurse -Force }
if (Test-Path (Join-Path $root 'sidebar.html')) { Copy-Item -LiteralPath (Join-Path $root 'sidebar.html') -Destination $stg -Force }

# Ensure node_modules for vsce exists or use npx which installs
Set-Location -LiteralPath $stg
$pkg = (Get-Content (Join-Path $root 'package.json') | ConvertFrom-Json)
$outName = "simplebeacon-$($pkg.version).staged.vsix"
Write-Host "Packaging VSIX to $outName"
& npx --yes @vscode/vsce package --out (Join-Path $root $outName)

Write-Host "Done. VSIX created at:" (Join-Path $root $outName)
