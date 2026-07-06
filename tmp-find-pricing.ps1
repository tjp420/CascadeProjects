$lines = Get-Content 'c:\Users\Trevor\CascadeProjects\coming-soon\public\pricing.html'
for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  if ($line -match '127\.0\.0\.1|localhost:') {
    Write-Host "$(($i+1)): $($line)"
  }
}
