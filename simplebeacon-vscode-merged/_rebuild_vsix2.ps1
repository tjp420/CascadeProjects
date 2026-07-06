$vsixPath = 'C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\simplebeacon-3.0.388-patched.vsix'
$sourceDir = 'C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\.vsix-patch-temp'

if (Test-Path $vsixPath) {
    Remove-Item $vsixPath -Force
    Write-Host "Deleted old VSIX"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($sourceDir, $vsixPath)
Write-Host "Created new VSIX from $sourceDir"

$zip = [System.IO.Compression.ZipFile]::OpenRead($vsixPath)
Write-Host "=== VSIX Entries (first 20) ==="
$count = 0
foreach ($e in $zip.Entries) {
    Write-Host $e.FullName
    $count++
    if ($count -ge 20) { break }
}
$zip.Dispose()

# Check specifically for extension/package.json
$zip2 = [System.IO.Compression.ZipFile]::OpenRead($vsixPath)
$found = $false
foreach ($e in $zip2.Entries) {
    if ($e.FullName -eq 'extension/package.json') {
        Write-Host "FOUND extension/package.json"
        $found = $true
        break
    }
}
$zip2.Dispose()

if (-not $found) {
    Write-Host "ERROR: extension/package.json NOT FOUND"
    exit 1
}
Write-Host "VSIX is valid"
