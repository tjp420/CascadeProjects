<#
.SYNOPSIS
    SimpleBeacon Enterprise Onboarding Orchestrator

.DESCRIPTION
    Registers corporate clients via the SimpleBeacon enterprise API.
    Supports full onboarding, trial provisioning, seat management,
    and Azure DevOps pipeline configuration generation.

.PARAMETER Action
    The onboarding action to perform: onboard, trial, add-seat, remove-seat,
    list-orgs, org-details, azure-devops, or verify.

.PARAMETER ServerUrl
    Base URL of the SimpleBeacon server (default: http://localhost:55000)

.PARAMETER ApiToken
    Admin JWT token for authentication

.PARAMETER CompanyName
    Company name for onboarding/trial

.PARAMETER AdminEmail
    Admin email for the organization

.PARAMETER ContactName
    Optional contact name

.PARAMETER Seats
    Number of seats (default: 10 for onboard, 5 for trial)

.PARAMETER ContractValue
    Contract value in USD

.PARAMETER ContractMonths
    Contract period in months (default: 12)

.PARAMETER AzureDevOpsOrgUrl
    Azure DevOps organization URL

.PARAMETER OrgId
    Organization ID for seat/org operations

.PARAMETER SeatEmail
    Email for seat operations

.PARAMETER ProjectPath
    Project path for Azure DevOps pipeline

.EXAMPLE
    .\enterprise-onboard.ps1 -Action onboard -CompanyName "Acme Corp" -AdminEmail "admin@acme.com" -Seats 25 -ContractValue 25000 -ApiToken "eyJ..."
    
.EXAMPLE
    .\enterprise-onboard.ps1 -Action trial -CompanyName "Acme Corp" -AdminEmail "admin@acme.com" -ApiToken "eyJ..."
    
.EXAMPLE
    .\enterprise-onboard.ps1 -Action azure-devops -OrgId "acme-corp-a1b2c3" -ProjectPath "$(Build.SourcesDirectory)" -ApiToken "eyJ..."
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('onboard','trial','add-seat','remove-seat','list-orgs','org-details','azure-devops','verify')]
    [string]$Action,

    [string]$ServerUrl = 'http://localhost:55000',
    [string]$ApiToken,
    [string]$CompanyName,
    [string]$AdminEmail,
    [string]$ContactName,
    [int]$Seats,
    [int]$ContractValue,
    [int]$ContractMonths = 12,
    [string]$AzureDevOpsOrgUrl,
    [string]$OrgId,
    [string]$SeatEmail,
    [string]$ProjectPath,
    [string]$Notes
)

$ErrorActionPreference = 'Stop'

function Get-AuthHeaders {
    if (-not $script:ApiToken) {
        throw 'ApiToken is required for this action'
    }
    return @{
        'Authorization' = "Bearer $($script:ApiToken)"
        'Content-Type' = 'application/json'
    }
}

function Invoke-EnterpriseApi {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body
    )
    $headers = Get-AuthHeaders
    $uri = "$($script:ServerUrl)/api/enterprise$Endpoint"
    
    Write-Host "[enterprise] $Method $uri" -ForegroundColor Cyan
    
    $params = @{
        Method = $Method
        Uri = $uri
        Headers = $headers
    }
    
    if ($Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 10)
    }
    
    try {
        $response = Invoke-RestMethod @params
        return $response
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $errorMessage = $_.ErrorDetails.Message
        Write-Host "[enterprise] ERROR ($statusCode): $errorMessage" -ForegroundColor Red
        throw
    }
}

function Invoke-Onboard {
    if (-not $CompanyName) { throw '-CompanyName is required for onboard action' }
    if (-not $AdminEmail) { throw '-AdminEmail is required for onboard action' }
    
    $body = @{
        companyName = $CompanyName
        adminEmail = $AdminEmail
        seats = if ($Seats -gt 0) { $Seats } else { 10 }
        contractPeriodMonths = $ContractMonths
    }
    if ($ContactName) { $body.contactName = $ContactName }
    if ($ContractValue -gt 0) { $body.contractValue = $ContractValue }
    if ($AzureDevOpsOrgUrl) { $body.azureDevOpsOrgUrl = $AzureDevOpsOrgUrl }
    if ($Notes) { $body.notes = $Notes }
    
    $result = Invoke-EnterpriseApi -Method 'POST' -Endpoint '/onboard' -Body $body
    
    Write-Host ""
    Write-Host "=== Enterprise Onboarding Complete ===" -ForegroundColor Green
    Write-Host "Organization ID:  $($result.orgId)" -ForegroundColor Yellow
    Write-Host "Company:          $($result.companyName)"
    Write-Host "Admin Email:      $($result.adminEmail)"
    Write-Host "API Key:          $($result.apiKey)" -ForegroundColor Yellow
    Write-Host "Seats:            $($result.seatsUsed) / $($result.seatCount) provisioned"
    Write-Host "Expires:          $($result.expiresAt)"
    Write-Host ""
    Write-Host "Admin License Token:" -ForegroundColor Yellow
    Write-Host $result.adminLicenseToken
    Write-Host ""
    Write-Host "Provisioned Emails:" -ForegroundColor Cyan
    $result.provisionedEmails | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "  1. Distribute license tokens to team members"
    Write-Host "  2. Generate Azure DevOps pipeline:"
    Write-Host "     .\enterprise-onboard.ps1 -Action azure-devops -OrgId '$($result.orgId)' -ApiToken `"$ApiToken`""
    Write-Host "  3. Configure SSO:"
    Write-Host "     Navigate to Admin > SSO Configuration in dashboard"
    Write-Host ""
    
    return $result
}

function Invoke-Trial {
    if (-not $CompanyName) { throw '-CompanyName is required for trial action' }
    if (-not $AdminEmail) { throw '-AdminEmail is required for trial action' }
    
    $body = @{
        companyName = $CompanyName
        adminEmail = $AdminEmail
        seatCount = if ($Seats -gt 0) { $Seats } else { 5 }
    }
    if ($ContactName) { $body.contactName = $ContactName }
    
    $result = Invoke-EnterpriseApi -Method 'POST' -Endpoint '/trial' -Body $body
    
    Write-Host ""
    Write-Host "=== Enterprise Trial Provisioned ===" -ForegroundColor Green
    Write-Host "Organization ID:  $($result.orgId)" -ForegroundColor Yellow
    Write-Host "Company:          $($result.companyName)"
    Write-Host "Trial Duration:   $($result.trialDurationDays) days"
    Write-Host "Trial Expires:    $($result.trialExpiresAt)"
    Write-Host "API Key:          $($result.apiKey)" -ForegroundColor Yellow
    Write-Host "Seats:            $($result.seatsUsed) / $($result.seatCount) provisioned"
    Write-Host ""
    Write-Host "Admin License Token:" -ForegroundColor Yellow
    Write-Host $result.adminLicenseToken
    Write-Host ""
    Write-Host "Upgrade to full contract:" -ForegroundColor Cyan
    Write-Host "  .\enterprise-onboard.ps1 -Action onboard -CompanyName '$CompanyName' -AdminEmail '$AdminEmail' -Seats 25 -ContractValue 25000 -ApiToken `"$ApiToken`""
    Write-Host ""
    
    return $result
}

function Invoke-AddSeat {
    if (-not $OrgId) { throw '-OrgId is required for add-seat action' }
    if (-not $SeatEmail) { throw '-SeatEmail is required for add-seat action' }
    
    $body = @{ email = $SeatEmail }
    $result = Invoke-EnterpriseApi -Method 'POST' -Endpoint "/organizations/$OrgId/seats" -Body $body
    
    Write-Host ""
    Write-Host "=== Seat Added ===" -ForegroundColor Green
    Write-Host "Email:            $($result.email)"
    Write-Host "License Token:    $($result.licenseToken)" -ForegroundColor Yellow
    Write-Host "Seats:            $($result.seatsUsed) / $($result.seatCount) ($($result.seatsRemaining) remaining)"
    Write-Host ""
    
    return $result
}

function Invoke-RemoveSeat {
    if (-not $OrgId) { throw '-OrgId is required for remove-seat action' }
    if (-not $SeatEmail) { throw '-SeatEmail is required for remove-seat action' }
    
    $encodedEmail = [uri]::EscapeDataString($SeatEmail)
    $result = Invoke-EnterpriseApi -Method 'DELETE' -Endpoint "/organizations/$OrgId/seats/$encodedEmail"
    
    Write-Host ""
    Write-Host "=== Seat Removed ===" -ForegroundColor Green
    Write-Host "Email:            $SeatEmail"
    Write-Host "Seats:            $($result.seatsUsed) / $($result.seatCount)"
    Write-Host ""
    
    return $result
}

function Invoke-ListOrgs {
    $result = Invoke-EnterpriseApi -Method 'GET' -Endpoint '/organizations'
    
    Write-Host ""
    Write-Host "=== Enterprise Organizations ===" -ForegroundColor Green
    Write-Host "Total: $($result.organizations.Count)" -ForegroundColor Cyan
    Write-Host ""
    
    foreach ($org in $result.organizations) {
        $status = if ($org.status -eq 'trial') { 'TRIAL' } elseif ($org.status -eq 'active') { 'ACTIVE' } else { $org.status.ToUpper() }
        $statusColor = if ($org.status -eq 'trial') { 'Yellow' } else { 'Green' }
        
        Write-Host "  [$status] $($org.companyName)" -ForegroundColor $statusColor
        Write-Host "    Org ID:       $($org.orgId)"
        Write-Host "    Admin:        $($org.adminEmail)"
        Write-Host "    Seats:        $($org.seatsUsed) / $($org.seatCount)"
        if ($org.contractValue) { Write-Host "    Contract:     `$$($org.contractValue) ($($org.contractPeriodMonths) months)" }
        if ($org.expiresAt) { Write-Host "    Expires:      $($org.expiresAt)" }
        Write-Host ""
    }
    
    return $result
}

function Invoke-OrgDetails {
    if (-not $OrgId) { throw '-OrgId is required for org-details action' }
    
    $result = Invoke-EnterpriseApi -Method 'GET' -Endpoint "/organizations/$OrgId"
    
    Write-Host ""
    Write-Host "=== Organization Details ===" -ForegroundColor Green
    Write-Host "Org ID:           $($result.orgId)"
    Write-Host "Company:          $($result.companyName)"
    Write-Host "Status:           $($result.status)"
    Write-Host "Admin:            $($result.adminEmail)"
    Write-Host "Seats:            $($result.seatsUsed) / $($result.seatCount)"
    if ($result.contractValue) { Write-Host "Contract Value:   `$$($result.contractValue)" }
    Write-Host "Created:          $($result.createdAt)"
    Write-Host "Expires:          $($result.expiresAt)"
    if ($result.trial) {
        Write-Host "Trial Expires:    $($result.trialExpiresAt)"
    }
    Write-Host ""
    Write-Host "Provisioned Members:" -ForegroundColor Cyan
    if ($result.provisionedEmails -and $result.provisionedEmails.Count -gt 0) {
        $result.provisionedEmails | ForEach-Object { Write-Host "  - $_" }
    } else {
        Write-Host "  (none)"
    }
    Write-Host ""
    
    return $result
}

function Invoke-AzureDevOps {
    if (-not $OrgId) { throw '-OrgId is required for azure-devops action' }
    
    $body = @{}
    if ($ProjectPath) { $body.projectPath = $ProjectPath }
    
    $result = Invoke-EnterpriseApi -Method 'POST' -Endpoint "/organizations/$OrgId/azure-devops" -Body $body
    
    Write-Host ""
    Write-Host "=== Azure DevOps Pipeline Generated ===" -ForegroundColor Green
    Write-Host "Organization:     $($result.orgId)"
    Write-Host "API Key:          $($result.apiKey)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Pipeline YAML:" -ForegroundColor Cyan
    Write-Host $result.pipelineYaml
    Write-Host ""
    Write-Host "Setup Instructions:" -ForegroundColor Cyan
    $result.instructions | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
    
    # Save YAML to file
    $yamlPath = "simplebeacon-pipeline-$OrgId.yml"
    $result.pipelineYaml | Out-File -FilePath $yamlPath -Encoding utf8
    Write-Host "Pipeline YAML saved to: $yamlPath" -ForegroundColor Yellow
    Write-Host ""
    
    return $result
}

function Invoke-Verify {
    Write-Host ""
    Write-Host "=== Enterprise Onboarding Verification ===" -ForegroundColor Green
    Write-Host "Server: $ServerUrl" -ForegroundColor Cyan
    Write-Host ""
    
    # Check server health
    try {
        $healthResponse = Invoke-RestMethod -Uri "$ServerUrl/api/health" -Method 'GET' -TimeoutSec 10
        Write-Host "[OK] Server health check passed" -ForegroundColor Green
        Write-Host "     Status: $($healthResponse.status)"
    } catch {
        Write-Host "[FAIL] Server health check failed" -ForegroundColor Red
        Write-Host "       Error: $($_.Exception.Message)"
        return @{ healthy = $false }
    }
    
    # Check enterprise API availability
    try {
        $headers = Get-AuthHeaders
        $orgsResponse = Invoke-RestMethod -Uri "$ServerUrl/api/enterprise/organizations" -Method 'GET' -Headers $headers -TimeoutSec 10
        Write-Host "[OK] Enterprise API accessible" -ForegroundColor Green
        Write-Host "     Organizations: $($orgsResponse.organizations.Count)"
    } catch {
        Write-Host "[FAIL] Enterprise API not accessible" -ForegroundColor Red
        Write-Host "       Error: $($_.Exception.Message)"
        return @{ healthy = $false }
    }
    
    # Check SSO endpoint
    try {
        $ssoResponse = Invoke-RestMethod -Uri "$ServerUrl/api/sso/resolve?email=test@example.com" -Method 'GET' -TimeoutSec 10
        Write-Host "[OK] SSO endpoint accessible" -ForegroundColor Green
        Write-Host "     SSO resolve: $($ssoResponse.found)"
    } catch {
        Write-Host "[WARN] SSO endpoint not accessible" -ForegroundColor Yellow
        Write-Host "       Error: $($_.Exception.Message)"
    }
    
    # Check audit log
    try {
        $auditResponse = Invoke-RestMethod -Uri "$ServerUrl/api/enterprise/audit/stats" -Method 'GET' -Headers $headers -TimeoutSec 10
        Write-Host "[OK] Audit log accessible" -ForegroundColor Green
        Write-Host "     Total entries: $($auditResponse.totalEntries)"
        Write-Host "     Chain valid: $($auditResponse.chainValid)"
    } catch {
        Write-Host "[WARN] Audit log not accessible" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Verification complete." -ForegroundColor Green
    Write-Host ""
    
    return @{ healthy = $true }
}

# ── Main Execution ───────────────────────────────────────────────────────────

$script:ServerUrl = $ServerUrl
$script:ApiToken = $ApiToken

switch ($Action) {
    'onboard'      { Invoke-Onboard }
    'trial'        { Invoke-Trial }
    'add-seat'     { Invoke-AddSeat }
    'remove-seat'  { Invoke-RemoveSeat }
    'list-orgs'    { Invoke-ListOrgs }
    'org-details'  { Invoke-OrgDetails }
    'azure-devops' { Invoke-AzureDevOps }
    'verify'       { Invoke-Verify }
}
