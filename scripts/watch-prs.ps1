param(
    [int]$PollSeconds = 60,
    [string[]]$Targets
)

# Targets should be strings: "PR:branch" e.g. "871:security/remediate-deps-bump-multer-nodemailer"
if (-not $Targets -or $Targets.Count -eq 0) {
    Write-Error "Usage: watch-prs.ps1 -PollSeconds 60 -Targets '871:branch' '872:branch'"
    exit 2
}

$state = @{}
foreach ($t in $Targets) {
    $parts = $t -split ':'
    if ($parts.Count -lt 2) { continue }
    $pr = $parts[0]
    $branch = $parts[1..($parts.Count-1)] -join ':'
    $state[$pr] = @{ branch = $branch; prevRun = $null; prevMerge = $null }
}

function Get-LatestRunString($branch) {
    try {
        $raw = gh run list --branch $branch --json status,conclusion,headBranch,workflow -L 1 2>$null
        if (-not $raw) { return 'no_runs' }
        $obj = $raw | ConvertFrom-Json
        if ($null -eq $obj) { return 'no_runs' }
        if ($obj -is [System.Array]) { $r = $obj[0] } else { $r = $obj }
        if (-not $r) { return 'no_runs' }
        $wf = $r.workflow.name
        $status = $r.status
        $conclusion = $r.conclusion
        return "${wf}: ${status}/${conclusion}"
    } catch {
        return "error"
    }
}

function Get-PRMergeState($pr) {
    try {
        $raw = gh pr view $pr --json mergeStateStatus,mergeable 2>$null
        if (-not $raw) { return 'unknown' }
        $obj = $raw | ConvertFrom-Json
        $m = $obj.mergeStateStatus
        $canMerge = $obj.mergeable
        return "$m|$canMerge"
    } catch {
        return 'error'
    }
}

Write-Output "Starting PR watcher for: $($Targets -join ', ') (polling every ${PollSeconds}s)"
while ($true) {
    foreach ($pr in $state.Keys) {
        $branch = $state[$pr].branch
        $runStr = Get-LatestRunString $branch
        if ($runStr -ne $state[$pr].prevRun) {
            Write-Output "[RUN] PR #$pr ($branch) -> $runStr"
            $state[$pr].prevRun = $runStr
        }
        $mergeStr = Get-PRMergeState $pr
        if ($mergeStr -ne $state[$pr].prevMerge) {
            Write-Output "[MERGE] PR #$pr -> $mergeStr"
            $state[$pr].prevMerge = $mergeStr
            # If mergeStateStatus == 'MERGEABLE' or mergeable == 'MERGEABLE' report actionable
            # We still just print changes; consumer can interpret.
        }
    }
    Start-Sleep -Seconds $PollSeconds
}
