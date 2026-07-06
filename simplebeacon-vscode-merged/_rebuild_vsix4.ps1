$ErrorActionPreference = 'Stop'
$vsixPath = 'C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\simplebeacon-3.0.388-patched.vsix'
$sourceDir = 'C:\Users\Trevor\CascadeProjects\simplebeacon-vscode-merged\.vsix-patch-temp'

if (Test-Path $vsixPath) {
    Remove-Item $vsixPath -Force
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$fs = New-Object System.IO.FileStream($vsixPath, [System.IO.FileMode]::CreateNew)
$zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)

try {
    $files = Get-ChildItem -Path $sourceDir -Recurse -File
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($sourceDir.Length + 1).Replace('\', '/')
        $entry = $zip.CreateEntry($relativePath)
        $src = New-Object System.IO.FileStream($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read)
        $dst = $entry.Open()
        $src.CopyTo($dst)
        $src.Dispose()
        $dst.Dispose()
    }
    Write-Host "Added $($files.Count) files"
} finally {
    $zip.Dispose()
    $fs.Dispose()
}

Write-Host "VSIX rebuilt with forward slashes"
