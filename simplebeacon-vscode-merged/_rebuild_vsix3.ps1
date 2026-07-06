$vsixPath = 'C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\simplebeacon-3.0.388-patched.vsix'
$sourceDir = 'C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\.vsix-patch-temp'

if (Test-Path $vsixPath) {
    Remove-Item $vsixPath -Force
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$fs = New-Object System.IO.FileStream($vsixPath, [System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)

function Add-Entries($dir, $prefix) {
    foreach ($item in Get-ChildItem $dir) {
        $entryName = if ($prefix) { "$prefix/$($item.Name)" } else { $item.Name }
        if ($item.PSIsContainer) {
            # Add directory entry (empty)
            $dirEntry = $zip.CreateEntry($entryName + '/')
            Add-Entries $item.FullName $entryName
        } else {
            $entry = $zip.CreateEntry($entryName)
            $src = New-Object System.IO.FileStream($item.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read)
            $dst = $entry.Open()
            $src.CopyTo($dst)
            $src.Dispose()
            $dst.Dispose()
        }
    }
}

Add-Entries $sourceDir ''

$zip.Dispose()
$fs.Dispose()

Write-Host "VSIX rebuilt with forward slashes"

# Verify
$z = [System.IO.Compression.ZipFile]::OpenRead($vsixPath)
$found = $false
foreach ($e in $z.Entries) {
    if ($e.FullName -eq 'extension/package.json') {
        Write-Host "FOUND: $($e.FullName)"
        $found = $true
    }
}
$z.Dispose()

if (-not $found) {
    Write-Host "ERROR: extension/package.json NOT FOUND"
    exit 1
}
Write-Host "VSIX is valid"
