param(
    [string]$RuntimePath = $env:VITRUM_RUNTIME_PATH
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Required = @(
    "README.md",
    "AGENTS.md",
    "package.json",
    "src\connection-owner.js",
    "src\transport.js",
    "test\connection-owner.test.js",
    "test\runtime-transport.test.js",
    "docs\ARCHITECTURE.md",
    "docs\RUNTIME_CONNECTION.md",
    "docs\ROADMAP.md",
    "docs\STATUS.md"
)
foreach ($RelativePath in $Required) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoRoot $RelativePath) -PathType Leaf)) {
        throw "missing required Node SDK file: $RelativePath"
    }
}

$NodeVersion = (& node --version).TrimStart("v")
if ([version]$NodeVersion -lt [version]"22.0.0") {
    throw "Node 22 or newer is required; found $NodeVersion"
}
if ([string]::IsNullOrWhiteSpace($RuntimePath)) {
    throw "-RuntimePath or VITRUM_RUNTIME_PATH is required; runtime tests may not be skipped"
}
$ResolvedRuntime = (Resolve-Path -LiteralPath $RuntimePath -ErrorAction Stop).Path

$PreviousRuntimePath = $env:VITRUM_RUNTIME_PATH
try {
    $env:VITRUM_RUNTIME_PATH = $ResolvedRuntime
    Push-Location $RepoRoot
    try {
        & npm.cmd run check
        if ($LASTEXITCODE -ne 0) {
            throw "npm run check failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}
finally {
    $env:VITRUM_RUNTIME_PATH = $PreviousRuntimePath
}

Write-Host "Vitrum Node SDK FH-006 transport/reconnect gate: PASS"
