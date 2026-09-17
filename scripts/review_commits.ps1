$branch = & git rev-parse --abbrev-ref HEAD
Write-Output "Branch: $branch"
Write-Output "Status:"
& git status -sb

$upstream = $null
try { $upstream = & git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null } catch { }

if ($upstream) {
    Write-Output "Upstream: $upstream"
    Write-Output "Commits ahead of upstream:"
    & git --no-pager log --decorate --pretty=format:'%h %ad %s' --date=short $upstream..HEAD
} else {
    Write-Output "No upstream configured for this branch. Showing recent local commits:"
    & git --no-pager log --decorate -n 50 --pretty=format:'%h %ad %s' --date=short HEAD
}
