param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectName,

  [Parameter(Mandatory = $true)]
  [string]$ResendApiKey,

  [Parameter(Mandatory = $false)]
  [string]$NotifyTo = "trevor_punt@live.com",

  [Parameter(Mandatory = $false)]
  [string]$NotifyFrom = "SimpleBeacon <noreply@simplebeacon.ai>",

  [Parameter(Mandatory = $false)]
  [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"

Write-Host "Setting Pages vars for project '$ProjectName' ($Environment)..."

# Use Pages secrets so values are available to Functions at runtime.
$NotifyTo | npx wrangler pages secret put WAITLIST_NOTIFY_TO --project-name "$ProjectName" --env "$Environment"
$NotifyFrom | npx wrangler pages secret put WAITLIST_NOTIFY_FROM --project-name "$ProjectName" --env "$Environment"
$ResendApiKey | npx wrangler pages secret put RESEND_API_KEY --project-name "$ProjectName" --env "$Environment"

Write-Host "Done. Secrets applied:"
Write-Host " - WAITLIST_NOTIFY_TO"
Write-Host " - WAITLIST_NOTIFY_FROM"
Write-Host " - RESEND_API_KEY"
Write-Host ""
Write-Host "Next: deploy the coming-soon folder and test a signup."
