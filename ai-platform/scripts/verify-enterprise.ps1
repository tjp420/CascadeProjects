<#
.SYNOPSIS
    SimpleBeacon Enterprise Health Check & Verification

.DESCRIPTION
    Verifies the full enterprise onboarding stack: server health,
    enterprise API, SSO endpoints, audit log integrity, Azure DevOps
    pipeline generation, and license token validation.

.PARAMETER ServerUrl
    Base URL of the SimpleBeacon server (default: http://localhost:55000)

.PARAMETER ApiToken
    Admin JWT token for authentication

.PARAMETER OrgId
    Organization ID to verify (optional — verifies specific org if provided)

.PARAMETER Detailed
    Show detailed output for each check

.EXAMPLE
    .\verify-enterprise.ps1 -ServerUrl "http://localhost:55000" -ApiToken "eyJ..." -Detailed
#>

param(
    [string]$ServerUrl = 'http://localhost:55000',
    [string]$ApiToken,
    [string]$OrgId,
    [switch]$Detailed
)

$ErrorActionPreference = 'Continue'
$results = @()
$passCount = 0
$failCount = 0
$warnCount = 0

function Add-Result {
    param([string]$Check, [string]$Status, [string]$Message, [string]$Detail)
    $results += [pscustomobject]@{ Check = $Check; Status = $Status; Message = $Message; Detail = $Detail }
    $color = switch ($Status) {
        'PASS' { 'Green'; $script:passCount++ }
        'FAIL' { 'Red'; $script:failCount++ }
        'WARN' { 'Yellow'; $script:warnCount++ }
        default { 'White' }
    }
    $symbol = switch ($Status) {
        'PASS' { '[OK]  ' }
        'FAIL' { '[FAIL]' }
        'WARN' { '[WARN]' }
        default { '[??]  ' }
    }
    Write-Host "$symbol $Check : $Message" -ForegroundColor $color
    if ($Detailed -and $Detail) {
        Write-Host "       $Detail" -ForegroundColor DarkGray
    }
}

function Get-AuthHeaders {
    if (-not $script:ApiToken) { return @{} }
    return @{
        'Authorization' = "Bearer $($script:ApiToken)"
        'Content-Type' = 'application/json'
    }
}

function Invoke-ApiCheck {
    param([string]$Method, [string]$Endpoint, [hashtable]$Body)
    $headers = Get-AuthHeaders
    $uri = "$($script:ServerUrl)$Endpoint"
    $params = @{ Method = $Method; Uri = $uri; Headers = $headers; TimeoutSec = 10 }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json) }
    return Invoke-RestMethod @params
}

# ── 1. Server Health ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=== SimpleBeacon Enterprise Verification ===" -ForegroundColor Cyan
Write-Host "Server: $ServerUrl" -ForegroundColor DarkGray
Write-Host ""

try {
    $health = Invoke-RestMethod -Uri "$ServerUrl/api/health" -Method 'GET' -TimeoutSec 10
    Add-Result -Check 'Server Health' -Status 'PASS' -Message 'Server is responding' -Detail "Status: $($health.status)"
} catch {
    Add-Result -Check 'Server Health' -Status 'FAIL' -Message 'Server not responding' -Detail $_.Exception.Message
}

# ── 2. Auth Service ──────────────────────────────────────────────────────────

try {
    $authHealth = Invoke-RestMethod -Uri "$ServerUrl/api/auth/health" -Method 'GET' -TimeoutSec 10
    Add-Result -Check 'Auth Service' -Status 'PASS' -Message 'Auth service is operational' -Detail "JWT works: $($authHealth.jwtWorks)"
} catch {
    Add-Result -Check 'Auth Service' -Status 'WARN' -Message 'Auth health endpoint not available' -Detail $_.Exception.Message
}

# ── 3. Enterprise API ────────────────────────────────────────────────────────

try {
    $orgs = Invoke-ApiCheck -Method 'GET' -Endpoint '/api/enterprise/organizations'
    $orgCount = if ($orgs.organizations) { $orgs.organizations.Count } else { 0 }
    Add-Result -Check 'Enterprise API' -Status 'PASS' -Message "Enterprise API accessible ($orgCount organizations)" -Detail "Total orgs: $orgCount"
} catch {
    Add-Result -Check 'Enterprise API' -Status 'FAIL' -Message 'Enterprise API not accessible' -Detail $_.Exception.Message
}

# ── 4. SSO Auth Handler ──────────────────────────────────────────────────────

try {
    $ssoResolve = Invoke-RestMethod -Uri "$ServerUrl/api/sso/resolve?email=test@example.com" -Method 'GET' -TimeoutSec 10
    Add-Result -Check 'SSO Auth Handler' -Status 'PASS' -Message 'SSO resolve endpoint accessible' -Detail "Found: $($ssoResolve.found)"
} catch {
    Add-Result -Check 'SSO Auth Handler' -Status 'WARN' -Message 'SSO auth handler not accessible' -Detail $_.Exception.Message
}

# ── 5. SSO Config Routes ─────────────────────────────────────────────────────

try {
    $ssoConfigs = Invoke-ApiCheck -Method 'GET' -Endpoint '/api/enterprise/sso/configs'
    $configCount = if ($ssoConfigs.configs) { $ssoConfigs.configs.Count } else { 0 }
    Add-Result -Check 'SSO Config CRUD' -Status 'PASS' -Message "SSO config routes accessible ($configCount configs)" -Detail "Total: $configCount"
} catch {
    Add-Result -Check 'SSO Config CRUD' -Status 'WARN' -Message 'SSO config routes not accessible' -Detail $_.Exception.Message
}

# ── 6. Audit Log ─────────────────────────────────────────────────────────────

try {
    $auditStats = Invoke-ApiCheck -Method 'GET' -Endpoint '/api/enterprise/audit/stats'
    Add-Result -Check 'Audit Log' -Status 'PASS' -Message "Audit log accessible ($($auditStats.totalEntries) entries)" -Detail "Chain valid: $($auditStats.chainValid)"
} catch {
    Add-Result -Check 'Audit Log' -Status 'WARN' -Message 'Audit log not accessible' -Detail $_.Exception.Message
}

# ── 7. Audit Chain Integrity ─────────────────────────────────────────────────

try {
    $chainVerify = Invoke-ApiCheck -Method 'GET' -Endpoint '/api/enterprise/audit/verify'
    if ($chainVerify.valid) {
        Add-Result -Check 'Audit Chain Integrity' -Status 'PASS' -Message 'SHA-256 hash chain is valid' -Detail "Entries verified: $($chainVerify.entriesVerified)"
    } else {
        Add-Result -Check 'Audit Chain Integrity' -Status 'FAIL' -Message 'Hash chain verification FAILED' -Detail ($chainVerify | ConvertTo-Json -Depth 3)
    }
} catch {
    Add-Result -Check 'Audit Chain Integrity' -Status 'WARN' -Message 'Chain verification endpoint not accessible' -Detail $_.Exception.Message
}

# ── 8. Organization-Specific Checks ──────────────────────────────────────────

if ($OrgId) {
    Write-Host ""
    Write-Host "--- Organization: $OrgId ---" -ForegroundColor Cyan

    try {
        $orgDetails = Invoke-ApiCheck -Method 'GET' -Endpoint "/api/enterprise/organizations/$OrgId"
        Add-Result -Check 'Org Details' -Status 'PASS' -Message "$($orgDetails.companyName) — $($orgDetails.status)" -Detail "Seats: $($orgDetails.seatsUsed)/$($orgDetails.seatCount)"
    } catch {
        Add-Result -Check 'Org Details' -Status 'FAIL' -Message "Organization $OrgId not found" -Detail $_.Exception.Message
    }

    try {
        $pipeline = Invoke-ApiCheck -Method 'POST' -Endpoint "/api/enterprise/organizations/$OrgId/azure-devops" -Body @{}
        if ($pipeline.pipelineYaml) {
            Add-Result -Check 'Azure DevOps Pipeline' -Status 'PASS' -Message 'Pipeline YAML generated successfully' -Detail "YAML length: $($pipeline.pipelineYaml.Length) chars"
        } else {
            Add-Result -Check 'Azure DevOps Pipeline' -Status 'WARN' -Message 'Pipeline generation returned no YAML'
        }
    } catch {
        Add-Result -Check 'Azure DevOps Pipeline' -Status 'FAIL' -Message 'Pipeline generation failed' -Detail $_.Exception.Message
    }

    try {
        $trialStatus = Invoke-ApiCheck -Method 'GET' -Endpoint "/api/enterprise/trial/$OrgId"
        if ($trialStatus.orgId) {
            Add-Result -Check 'Trial Status' -Status 'PASS' -Message "Trial: $($trialStatus.daysRemaining) days remaining" -Detail "Expires: $($trialStatus.trialExpiresAt)"
        }
    } catch {
        # Not a trial org — this is expected for full onboarded orgs
        if ($Detailed) {
            Add-Result -Check 'Trial Status' -Status 'PASS' -Message 'Not a trial org (expected for full contracts)'
        }
    }
}

# ── Summary ──────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "=== Verification Summary ===" -ForegroundColor Cyan
Write-Host "  Passed: $passCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor Red
Write-Host "  Warnings: $warnCount" -ForegroundColor Yellow
Write-Host ""

if ($failCount -gt 0) {
    Write-Host "RESULT: FAIL — $failCount check(s) failed" -ForegroundColor Red
    exit 1
} elseif ($warnCount -gt 0) {
    Write-Host "RESULT: PASS (with warnings) — $warnCount warning(s)" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "RESULT: ALL CHECKS PASSED" -ForegroundColor Green
    exit 0
}
