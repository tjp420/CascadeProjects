# PowerShell script to create Agent Zero desktop shortcut
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Agent Zero - Local Ollama.lnk")
$Shortcut.TargetPath = "msedge.exe"
$Shortcut.Arguments = "--new-window http://localhost:32795"
$Shortcut.WorkingDirectory = "$env:USERPROFILE"
$Shortcut.Description = "Agent Zero with Local Ollama - Ultimate AI Freedom"
$Shortcut.Save()

Write-Host "Desktop shortcut created successfully!" -ForegroundColor Green
Write-Host "Shortcut location: $env:USERPROFILE\Desktop\Agent Zero - Local Ollama.lnk" -ForegroundColor Yellow
