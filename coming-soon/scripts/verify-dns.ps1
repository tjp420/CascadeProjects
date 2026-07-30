#!/usr/bin/env pwsh
# SimpleBeacon DNS deliverability verification
# Usage: .\scripts\verify-dns.ps1

param(
    [string]$Domain = 'simplebeacon.ai',
    [string]$DkimSelector = 'resend._domainkey'
)

function Test-HasTxtRecord {
    param([string]$Name)

    # Always query Cloudflare DoH first (authoritative, no stale cache)
    try {
        $dohUrl = "https://cloudflare-dns.com/dns-query?name=$Name&type=TXT"
        $dohResponse = Invoke-RestMethod -Uri $dohUrl -Headers @{ 'Accept' = 'application/dns-json' } -TimeoutSec 10
        $values = @()
        if ($dohResponse.Answer) {
            foreach ($answer in $dohResponse.Answer) {
                $data = [string]$answer.data
                # DoH wraps TXT values in double quotes — strip them
                $data = $data -replace '^"', '' -replace '"$', ''
                $values += $data
            }
        }
        if ($values.Count -gt 0) {
            return @{ exists = $true; values = $values }
        }
    } catch {
        # DoH failed, fall through to local resolver
    }

    # Fallback: local resolver (may have stale cache)
    try {
        $answers = @(Resolve-DnsName -Name $Name -Type TXT -ErrorAction Stop)
        $values = @()
        foreach ($answer in $answers) {
            if ($null -eq $answer.Strings) { continue }
            if ($answer.Strings -is [array]) {
                $values += ($answer.Strings -join '')
            } else {
                $values += [string]$answer.Strings
            }
        }
        return @{ exists = $values.Count -gt 0; values = $values }
    } catch {
        return @{ exists = $false; values = @() }
    }
}

$allOk = $true

Write-Host "`n[Email Compliance DNS Setup] Domain: $Domain" -ForegroundColor Cyan
Write-Host "Selector: $DkimSelector`n" -ForegroundColor DarkGray

# 1. SPF record
$spfName = $Domain
$spf = Test-HasTxtRecord $spfName
if (-not $spf.exists) {
    Write-Host "[FAIL] No SPF TXT record found for $spfName" -ForegroundColor Red
    $allOk = $false
} else {
    $spfRecord = $spf.values | Where-Object { $_ -match '^v=spf1' } | Select-Object -First 1
    if (-not $spfRecord) {
        Write-Host "[FAIL] SPF record exists for $spfName but does not start with v=spf1" -ForegroundColor Red
        $allOk = $false
    } elseif ($spfRecord -notmatch 'include:(send\.|spf\.)?resend\.com') {
        Write-Host "[FAIL] SPF record is missing include:resend.com (or include:send.resend.com)" -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Host "[PASS] SPF record OK for $spfName" -ForegroundColor Green
        Write-Host "       $spfRecord" -ForegroundColor Gray
    }
}

# 2. DMARC record
$dmarcName = "_dmarc.$Domain"
$dmarc = Test-HasTxtRecord $dmarcName
if (-not $dmarc.exists) {
    Write-Host "[FAIL] No DMARC TXT record found for $dmarcName" -ForegroundColor Red
    $allOk = $false
} else {
    $dmarcRecord = $dmarc.values | Where-Object { $_ -match '^v=DMARC1' } | Select-Object -First 1
    if (-not $dmarcRecord) {
        Write-Host "[FAIL] DMARC record exists for $dmarcName but does not start with v=DMARC1" -ForegroundColor Red
        $allOk = $false
    } elseif ($dmarcRecord -notmatch 'p=reject') {
        Write-Host "[WARN] DMARC record is not using p=reject (current policy may be softer)" -ForegroundColor Yellow
    } else {
        Write-Host "[PASS] DMARC record OK for $dmarcName" -ForegroundColor Green
        Write-Host "       $dmarcRecord" -ForegroundColor Gray
    }
}

# 3. DKIM record (selector provided by Resend; default resend._domainkey)
$dkimName = "$DkimSelector.$Domain"
$dkim = Test-HasTxtRecord $dkimName
if (-not $dkim.exists) {
    Write-Host "[FAIL] No DKIM TXT record found for $dkimName" -ForegroundColor Red
    Write-Host "       Add the TXT record exactly as shown in your Resend dashboard." -ForegroundColor Gray
    $allOk = $false
} else {
    $dkimRecord = $dkim.values | Where-Object { $_ -match '^v=DKIM1|^k=rsa' } | Select-Object -First 1
    if (-not $dkimRecord) {
        Write-Host "[FAIL] DKIM record exists for $dkimName but does not look like a valid DKIM key" -ForegroundColor Red
        $allOk = $false
    } else {
        Write-Host "[PASS] DKIM record found for $dkimName" -ForegroundColor Green
    }
}

if ($allOk) {
    Write-Host "`nAll DNS deliverability records are present." -ForegroundColor Green
    Write-Host "Next: node tools/probe-email.cjs --dry-run" -ForegroundColor DarkGray
    Write-Host "      node tools/probe-email.cjs --to you@co.com --send`n" -ForegroundColor DarkGray
    exit 0
} else {
    Write-Host "`nOne or more DNS records are missing or misconfigured." -ForegroundColor Red
    Write-Host "Fix DNS in Cloudflare, then re-run this script before probe-email.`n" -ForegroundColor DarkGray
    exit 1
}
