<#
.SYNOPSIS
  Enterprise onboarding helper script for SimpleBeacon.

.DESCRIPTION
  Provisions a new enterprise organization, generates API keys, provisions
  admin seats, and optionally outputs the Azure DevOps pipeline template.

.PARAMETER CompanyName
  Name of the enterprise company to onboard.

.PARAMETER AdminEmail
  Email address of the enterprise admin user.

.PARAMETER Seats
  Number of seats to provision (default: 10).

.PARAMETER ContactName
  Optional name of the primary contact person.

.PARAMETER ContractValue
  Optional contract value in dollars (e.g. 25000).

.PARAMETER ContractMonths
  Contract duration in months (default: 12).

.PARAMETER AzureDevOpsOrg
  Optional Azure DevOps organization URL.

.PARAMETER Trial
  Switch to provision a 30-day trial instead of a full contract.

.PARAMETER ApiBaseUrl
  Base URL of the SimpleBeacon API server (default: http://localhost:54800).

.EXAMPLE
  .\scripts\enterprise-onboard.ps1 -CompanyName "Acme Corp" -AdminEmail "admin@acme.com" -Seats 25 -ContractValue 25000
.EXAMPLE
  .\scripts\enterprise-onboard.ps1 -CompanyName "Acme Corp" -AdminEmail "admin@acme.com" -Trial
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$CompanyName,

  [Parameter(Mandatory = $true)]
  [string]$AdminEmail,

  [int]$Seats = 10,
  [string]$ContactName,
  [int]$ContractValue,
  [int]$ContractMonths = 12,
  [string]$AzureDevOpsOrg,
  [switch]$Trial,
  [string]$ApiBaseUrl = 'http://localhost:54800'
)

$ErrorActionPreference = 'Stop'

Write-Host ""
$sep = '=' * 50
Write-Host $sep -ForegroundColor Cyan
if ($Trial) {
  Write-Host "  SimpleBeacon Enterprise Trial Onboarding" -ForegroundColor Cyan
} else {
  Write-Host "  SimpleBeacon Enterprise Onboarding" -ForegroundColor Cyan
}
Write-Host $sep -ForegroundColor Cyan
Write-Host ""

# -- Build request body --
$body = @{
  companyName = $CompanyName
  adminEmail = $AdminEmail
  seatCount = $Seats
  contactName = $ContactName
  contractValue = $ContractValue
  contractPeriodMonths = $ContractMonths
  azureDevOpsOrgUrl = $AzureDevOpsOrg
}

$endpoint = if ($Trial) { '/api/enterprise/trial' } else { '/api/enterprise/onboard' }
$url = "$ApiBaseUrl/api/enterprise$($endpoint -replace '/api/enterprise', '')"
$url = "$ApiBaseUrl$endpoint"

Write-Host "[Request] POST $url" -ForegroundColor DarkGray
Write-Host "  Company:    $CompanyName" -ForegroundColor DarkGray
Write-Host "  Admin:      $AdminEmail" -ForegroundColor DarkGray
Write-Host "  Seats:      $Seats" -ForegroundColor DarkGray
if ($Trial) {
  Write-Host "  Mode:       Trial (30 days)" -ForegroundColor DarkGray
} else {
  Write-Host "  Contract:   $ContractMonths months" -ForegroundColor DarkGray
  if ($ContractValue) {
    Write-Host "  Value:      `$$ContractValue" -ForegroundColor DarkGray
  }
}
Write-Host ""

# -- Send onboarding request --
try {
  $jsonBody = $body | ConvertTo-Json -Depth 5
  $response = Invoke-RestMethod -Uri $url -Method Post -Body $jsonBody -ContentType 'application/json' -TimeoutSec 30

  Write-Host "[PASS] Organization provisioned successfully" -ForegroundColor Green
  Write-Host ""
  Write-Host "  Org ID:           $($response.orgId)" -ForegroundColor White
  Write-Host "  Company:          $($response.companyName)" -ForegroundColor White
  Write-Host "  Admin Email:      $($response.adminEmail)" -ForegroundColor White
  Write-Host "  API Key:          $($response.apiKey)" -ForegroundColor Yellow
  Write-Host "  Seats Used:       $($response.seatsUsed) / $($response.seatCount)" -ForegroundColor White
  Write-Host "  Admin License:    $($response.adminLicenseToken)" -ForegroundColor Yellow
  Write-Host "  Expires:          $($response.expiresAt)" -ForegroundColor White
  Write-Host ""

  # -- Generate Azure DevOps pipeline config --
  if (-not $Trial -and $response.orgId) {
    Write-Host "[Azure DevOps] Generating pipeline template..." -ForegroundColor Yellow
    try {
      $azBody = @{ projectPath = '$(Build.SourcesDirectory)' } | ConvertTo-Json
      $azResponse = Invoke-RestMethod -Uri "$ApiBaseUrl/api/enterprise/organizations/$($response.orgId)/azure-devops" -Method Post -Body $azBody -ContentType 'application/json' -TimeoutSec 15

      $pipelineDir = Join-Path $PSScriptRoot "..\enterprise-configs"
      if (-not (Test-Path $pipelineDir)) { New-Item -ItemType Directory -Path $pipelineDir -Force | Out-Null }
      $pipelineFile = Join-Path $pipelineDir "$($response.orgId)-azure-pipelines.yml"
      $azResponse.pipelineYaml | Set-Content $pipelineFile -Encoding UTF8

      Write-Host "  [PASS] Pipeline template saved to: $pipelineFile" -ForegroundColor Green
      Write-Host ""
      Write-Host "  Setup Instructions:" -ForegroundColor Cyan
      foreach ($step in $azResponse.instructions) {
        Write-Host "    $step" -ForegroundColor DarkGray
      }
      Write-Host ""
    } catch {
      Write-Host "  [WARN] Could not generate Azure DevOps config: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
  }

  # -- Summary --
  Write-Host $sep -ForegroundColor Cyan
  Write-Host "  Onboarding Complete!" -ForegroundColor Green
  Write-Host "  Org ID: $($response.orgId)" -ForegroundColor Cyan
  Write-Host "  API Key: $($response.apiKey)" -ForegroundColor Cyan
  Write-Host $sep -ForegroundColor Cyan

  if ($Trial) {
    Write-Host ""
    Write-Host "  Next steps:" -ForegroundColor Yellow
    Write-Host "    1. Distribute license tokens to your team" -ForegroundColor White
    Write-Host "    2. Install the VS Code extension: code --install-extension simplebeacon.simplebeacon-vscode" -ForegroundColor White
    Write-Host "    3. Run your first scan: npx simplebeacon scan --path . --gate" -ForegroundColor White
    Write-Host "    4. Upgrade to full contract before trial expires" -ForegroundColor White
  }
  Write-Host ""

} catch {
  Write-Host ""
  Write-Host "[FAIL] Onboarding request failed: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails) {
    Write-Host "  Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
  }
  Write-Host ""
  Write-Host "  Ensure the SimpleBeacon server is running at $ApiBaseUrl" -ForegroundColor DarkYellow
  exit 1
}
