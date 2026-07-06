$vsixPath = 'C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\simplebeacon-3.0.388-patched.vsix'

Add-Type -AssemblyName System.IO.Compression.FileSystem
$z = [System.IO.Compression.ZipFile]::OpenRead($vsixPath)

Write-Host "=== Checking for extension/package.json ==="
$found = $false
foreach ($e in $z.Entries) {
    if ($e.FullName -eq 'extension/package.json') {
        Write-Host "FOUND: $($e.FullName)"
        $found = $true
    }
}

if (-not $found) {
    Write-Host "NOT FOUND - listing first 10 entries:"
    $count = 0
    foreach ($e in $z.Entries) {
        Write-Host $e.FullName
        $count++
        if ($count -ge 10) { break }
    }
}

$z.Dispose()
