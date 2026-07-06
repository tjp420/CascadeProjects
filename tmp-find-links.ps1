$files = Get-ChildItem 'c:\Users\Trevor\CascadeProjects\coming-soon\public' -Filter '*.html'
foreach ($f in $files) {
  $content = Get-Content $f.FullName -Raw
  if ($content -match 'href="127\.0\.0\.1|href="http://127\.0\.0\.1|href="http://localhost|href="/coming-soon/') {
    Write-Host $f.Name
  }
}
