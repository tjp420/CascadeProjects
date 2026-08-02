$lines = Get-Content "./.todo_counts.txt" -ErrorAction SilentlyContinue
if (-not $lines) { Write-Output "No counts file found"; exit 0 }
$objs = foreach ($line in $lines) {
    $parts = $line -split ':'
    if ($parts.Length -ge 2) {
        [pscustomobject]@{ Count = [int]$parts[1]; Name = $parts[0] }
    }
}
$objs | Sort-Object Count -Descending | Select-Object Count, Name -First 20 | Format-Table -AutoSize
