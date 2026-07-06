$files = Get-ChildItem 'c:\Users\Trevor\CascadeProjects\coming-soon\public' -Filter '*.html' -Recurse
foreach ($f in $files) {
  $lines = Get-Content $f.FullName
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -match '127\.0\.0\.1|localhost:') {
      Write-Host "$(($f.FullName)):$(($i+1)): $($line)"
    }
  }
}
