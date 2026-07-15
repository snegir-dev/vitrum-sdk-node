$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Required = @("README.md", "AGENTS.md", "docs\ARCHITECTURE.md", "docs\ROADMAP.md", "docs\STATUS.md")
foreach ($RelativePath in $Required) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $RelativePath) -PathType Leaf)) {
        throw "missing required Node SDK document: $RelativePath"
    }
}
Write-Host "Vitrum Node SDK: DOCS-ONLY"
