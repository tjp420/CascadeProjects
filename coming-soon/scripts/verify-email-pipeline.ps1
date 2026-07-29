#!/usr/bin/env pwsh
# Resend activation pipeline: DNS gate -> email probe
# Usage: .\scripts\verify-email-pipeline.ps1 [-To you@example.com] [-Send]

param(
    [string]$Domain = 'simplebeacon.ai',
    [string]$To = '',
    [switch]$Send
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

try {
    Write-Host "=== Resend Activation Pipeline ===" -ForegroundColor Cyan

    Write-Host "`n[1/2] DNS safety gate..." -ForegroundColor Cyan
    & "$PSScriptRoot\verify-dns.ps1" -Domain $Domain
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nPipeline halted at DNS gate." -ForegroundColor Red
        exit 1
    }

    Write-Host "`n[2/2] Email probe..." -ForegroundColor Cyan
    $probeArgs = @('tools/probe-email.cjs')
    if ($Send) {
        if (-not $To) {
            Write-Host "[FAIL] -Send requires -To you@example.com" -ForegroundColor Red
            exit 1
        }
        $probeArgs += @('--to', $To, '--send')
    } else {
        $probeArgs += '--dry-run'
    }

    node @probeArgs
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
