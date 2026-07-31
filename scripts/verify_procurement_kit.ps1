$zip = 'generated/download/simplebeacon-procurement-kit.zip'
$dest = 'generated/download/tmp'
if (-not (Test-Path $zip)) { Write-Output "ZIP not found: $zip"; exit 2 }
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
Expand-Archive -Force $zip -DestinationPath $dest
$cs = Join-Path $dest 'checksums.sha256'
if (-not (Test-Path $cs)) { Write-Output 'checksums.sha256 not found'; exit 2 }
$ok = $true
Get-Content $cs | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq '') { return }
    $parts = $line -split '\s+'
    $expected = $parts[0].ToLower()
    $file = $parts[1]
    $path = Join-Path $dest $file
    if (-not (Test-Path $path)) {
        Write-Output "MISSING $file"
        $ok = $false
    } else {
        $h = (Get-FileHash -Algorithm SHA256 $path).Hash.ToLower()
        if ($h -ne $expected) {
            Write-Output "MISMATCH $file expected=$expected actual=$h"
            $ok = $false
        } else {
            Write-Output "OK $file"
        }
    }
}
if ($ok) { Write-Output 'ALL_OK'; exit 0 } else { exit 3 }
