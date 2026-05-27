# Simplebeacon consolidation — bulk removal script
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Remove-IfExists($path) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
        Write-Host "Removed: $path"
    }
}

function Remove-Files($pattern) {
    Get-ChildItem -Path $root -Filter $pattern -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
        ForEach-Object {
            Remove-Item -Force $_.FullName
            Write-Host "Removed: $($_.FullName)"
        }
}

Write-Host "=== Phase 1: GGUF components ==="
Remove-IfExists "data-central\ai-tools\ai-models\uploads"
Remove-IfExists "data-central"
@(
    "gguf-operational-dashboard.html",
    "gguf-health-monitor.js",
    "gguf-status-check.js",
    "gguf-enhancements-test.html",
    "gguf_mock_data_optimization.py",
    "gguf_optimization_final_report.json",
    "gguf_mock_data_optimization_docs.json",
    "fix-server-export.js"
) | ForEach-Object { Remove-IfExists $_ }

Remove-IfExists "src\core\GGUFRoadmapAnalyzer.js"
Remove-IfExists "src\core\GGUFIssueAnalyzer.js"
Remove-IfExists "src\core\GGUFFixEngine.js"
Remove-IfExists "src\api\gguf-issues-api.js"
Remove-IfExists "src\web\api\gguf-analysis.js"
Remove-IfExists "src\web\components\gguf-analysis-panel.js"
Remove-IfExists "src\web\services\gguf-data-service.js"
Remove-IfExists "web\css\gguf-enhancements.css"
Remove-IfExists "web\data\gguf-mock-analysis-sample.json"
Remove-IfExists "web\scripts\gguf-analysis-page.js"
Remove-IfExists "web\scripts\gguf-enhanced-features.js"
Remove-IfExists "data\roadmap\gguf-roadmap-data.json"
Remove-IfExists "data\mock\gguf-mock-analysis-report.json"
Remove-IfExists "docs\roadmap-reports\gguf-roadmap-report-2026-05-21.json"

Get-ChildItem -Path $root -Filter "GGUF*.md" -File | Remove-Item -Force
Get-ChildItem -Path "$root\docs" -Filter "GGUF*.md" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path $root -Filter "gguf-*.html" -File -ErrorAction SilentlyContinue | Remove-Item -Force
Get-ChildItem -Path "$root\src\web" -Filter "gguf*" -File -ErrorAction SilentlyContinue | Remove-Item -Force

Write-Host "=== Phase 1b: Legacy servers ==="
@(
    "unified-server.js",
    "complete-server.js",
    "enhanced-auth-server.js",
    "simple-server.js"
) | ForEach-Object { Remove-IfExists $_ }

Write-Host "=== Phase 2: Cascade dashboards ==="
$dashboardDirs = @(
    "web\components\ai-tools",
    "web\components\analytics",
    "web\components\api",
    "web\components\assets-library",
    "web\components\billing-system",
    "web\components\code-generation",
    "web\components\code-templates",
    "web\components\coverage-reports",
    "web\components\database",
    "web\components\debt-analytics",
    "web\components\debt-calculator",
    "web\components\debt-reduction",
    "web\components\devtools",
    "web\components\help",
    "web\components\issue-resolution",
    "web\components\merger-tool",
    "web\components\project-reports",
    "web\components\quality",
    "web\components\security",
    "web\components\settings",
    "web\components\support",
    "web\components\ai-analysis",
    "web\components\ai-roadmap",
    "web\components\analysis",
    "web\components\code-upload",
    "web\components\codegen",
    "web\components\upload",
    "web\components\chat-interface",
    "web\components\optimization",
    "web\components\patterns",
    "web\components\roadmap"
)
$dashboardDirs | ForEach-Object { Remove-IfExists $_ }

Write-Host "=== Phase 2b: AI system analyzers ==="
Remove-IfExists "src\ai-system"
Remove-IfExists "development-roadmap"

Write-Host "=== Phase 3: Data & adapters ==="
Remove-IfExists "data\mock"
Remove-IfExists "src\adapters"
Remove-IfExists "src\core\DatabaseAdapter.js"

Write-Host "=== Phase 3b: Legacy web pages ==="
@(
    "web\ai-tools-test.html",
    "web\ai-tools.html",
    "web\assessment-portal.html",
    "web\code-upload.html",
    "web\dashboard-new.html",
    "web\dashboard.html",
    "web\test-gguf-integration.html",
    "web\unified-dashboard-enhanced.html",
    "web\unified-dashboard.html"
) | ForEach-Object { Remove-IfExists $_ }
Remove-IfExists "web\marketing"

Write-Host "=== Phase 3c: Root ad-hoc test scripts ==="
Get-ChildItem -Path $root -Filter "test-*.js" -File |
    Where-Object { $_.Name -notmatch 'test-utils' } |
    Remove-Item -Force

Write-Host "=== Phase 4: Cascade server routes ==="
@(
    "server\api\ai\AIRoadmapRoutes.js",
    "server\api\roadmap\RoadmapRoutes.js",
    "server\middleware\analysisMiddleware.js",
    "server\middleware\statusProtection.js"
) | ForEach-Object { Remove-IfExists $_ }

Write-Host "=== Done ==="
