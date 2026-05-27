param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectName,

  [Parameter(Mandatory = $true)]
  [string]$ResendApiKey,

  [Parameter(Mandatory = $false)]
  [string]$NotifyTo = "trevor_punt@live.com",

  [Parameter(Mandatory = $false)]
  [string]$NotifyFrom = "SimpleBeacon <onboarding@resend.dev>",

  [Parameter(Mandatory = $false)]
  [string]$Environment = "production"
)

$ErrorActionPreference = "Stop"

Write-Host "Setting Pages secrets for audit booking on '$ProjectName' ($Environment)..."

$ResendApiKey | npx wrangler pages secret put RESEND_API_KEY --project-name "$ProjectName" --env "$Environment"
$NotifyTo | npx wrangler pages secret put AUDIT_NOTIFY_TO --project-name "$ProjectName" --env "$Environment"
$NotifyTo | npx wrangler pages secret put WAITLIST_NOTIFY_TO --project-name "$ProjectName" --env "$Environment"
$NotifyFrom | npx wrangler pages secret put AUDIT_NOTIFY_FROM --project-name "$ProjectName" --env "$Environment"
$NotifyFrom | npx wrangler pages secret put WAITLIST_NOTIFY_FROM --project-name "$ProjectName" --env "$Environment"

Write-Host "Done. Deploy coming-soon/ (including functions/) and test the booking form."
