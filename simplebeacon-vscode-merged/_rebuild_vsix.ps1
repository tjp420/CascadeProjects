$vsixPath = 'C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\simplebeacon-3.0.388-patched.vsix'
$sourceDir = 'C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\.vsix-patch-temp'

if (Test-Path $vsixPath) {
    Remove-Item $vsixPath
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($sourceDir, $vsixPath)

Write-Host "VSIX rebuilt: $vsixPath"

$zip = [System.IO.Compression.ZipFile]::OpenRead($vsixPath)
$found = $false
foreach ($e in $zip.Entries) {
    if ($e.FullName -eq 'extension/package.json') {
        Write-Host "FOUND: $($e.FullName)"
        $found = $true
    }
}
$zip.Dispose()

if (-not $found) {
    Write-Host "ERROR: extension/package.json NOT FOUND"
    exit 1
}
