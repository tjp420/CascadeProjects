$ssh=Join-Path $env:USERPROFILE '.ssh'
if(-not (Test-Path $ssh)){ New-Item -ItemType Directory -Path $ssh | Out-Null }
if(-not (Test-Path '.env.production')){ Write-Output 'ENV_NOT_FOUND' } else {
  $dest=Join-Path $ssh 'simplebeacon-production.env'
  Move-Item -Path '.env.production' -Destination $dest -Force
  Write-Output "MOVED_ENV:$dest"
}
$gitignore = '.gitignore'
$linesToAdd = @('.env.production','tmp-prepush-leak.js','.outbound/')
foreach($l in $linesToAdd){
  if(-not (Test-Path $gitignore)){ '' | Out-File -FilePath $gitignore -Encoding utf8 }
  $content = Get-Content $gitignore -ErrorAction SilentlyContinue
  if($content -notcontains $l){ Add-Content -Path $gitignore -Value $l } else { Write-Output "IGNORED_ALREADY:$l" }
}
if(Test-Path 'tmp-prepush-leak.js'){ Remove-Item -Path 'tmp-prepush-leak.js' -Force; Write-Output 'REMOVED_TMP' } else { Write-Output 'TMP_NOT_FOUND' }
Write-Output '--- .gitignore tail ---'
Get-Content $gitignore | Select-Object -Last 20 | ForEach-Object { Write-Output $_ }
