try {
    $conn = Get-NetTCPConnection -LocalPort 3003 -ErrorAction Stop
    if ($conn) {
        $pid = $conn.OwningProcess
        Write-Host "Killing PID $pid on port 3003"
        Stop-Process -Id $pid -Force
    }
} catch {
    Write-Host "No process on port 3003"
}
