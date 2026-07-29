#!/usr/bin/env pwsh
# Post-deploy routing validation for simplebeacon.ai
# Usage: .\scripts\verify-production.ps1 [-Domain simplebeacon.ai]

param(
    [string]$Domain = 'simplebeacon.ai',
    [string]$Email = 'test@example.com'
)

$base = "https://$Domain"
$fail = 0

function Test-Url {
    param([string]$Label, [scriptblock]$Check)
    try {
        if (& $Check) {
            Write-Host "[PASS] $Label" -ForegroundColor Green
        } else {
            Write-Host "[FAIL] $Label" -ForegroundColor Red
            $script:fail++
        }
    } catch {
        Write-Host "[FAIL] $Label - $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }
}

Write-Host "Validating $base ..." -ForegroundColor Cyan

Test-Url 'referral-capture.js returns 200 + JS content-type' {
    $r = Invoke-WebRequest -Uri "$base/js-es2018/referral-capture.js" -Method Head -UseBasicParsing
    $r.StatusCode -eq 200 -and $r.Headers['Content-Type'] -match 'javascript'
}

Test-Url 'index.html injects js-es2018 referral script' {
    $html = (Invoke-WebRequest -Uri "$base/" -UseBasicParsing).Content
    $html -match 'js-es2018/referral-capture\.js'
}

Test-Url 'referral stats API returns JSON success' {
    $json = Invoke-RestMethod -Uri "$base/api/referral/stats?email=$([uri]::EscapeDataString($Email))"
    $json.success -eq $true
}

Test-Url 'HSTS header present (SSL/TLS edge)' {
    $r = Invoke-WebRequest -Uri "$base/" -Method Head -UseBasicParsing
    $r.Headers['Strict-Transport-Security'] -match 'max-age='
}

Test-Url 'API proxy is not edge-cached (CF-Cache-Status: DYNAMIC)' {
    $r = Invoke-WebRequest -Uri "$base/api/referral/stats?email=$([uri]::EscapeDataString($Email))" -Method Head -UseBasicParsing
    $r.Headers['CF-Cache-Status'] -eq 'DYNAMIC'
}

if ($fail -eq 0) {
    Write-Host "`nAll production routing checks passed." -ForegroundColor Green
    exit 0
}

Write-Host "`n$fail check(s) failed. Re-bind custom domains or promote latest deployment in Cloudflare Pages." -ForegroundColor Red
exit 1
