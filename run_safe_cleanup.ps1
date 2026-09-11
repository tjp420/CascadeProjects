$root = 'C:\Users\user\CascadeProjects'
Set-Location -Path $root
$targets = @('targets', 'node_modules_host', '.artifacts', 'dist', 'build', 'coverage', '.eslintcache', '.tsbuildinfo')
$deleted = 0
foreach ($p in $targets) {
    $full = Join-Path $root $p
    if (Test-Path $full) {
        try {
            Write-Host "Deleting: $full"
            Remove-Item -LiteralPath $full -Recurse -Force -ErrorAction Stop
            $deleted++
        } catch {
            Write-Host ("Failed to delete {0}: {1}" -f $full, $_.Exception.Message) -ForegroundColor Yellow
        }
    } else {
        Write-Host "Not present: $p"
    }
}
Write-Host "`nDeleted $deleted target(s)."
