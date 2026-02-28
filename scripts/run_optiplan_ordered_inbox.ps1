param(
    [string]$RuleFile,
    [string]$InboxDir,
    [string]$ProcessingDir,
    [string]$ProcessedDir,
    [string]$FailedDir,
    [switch]$Once,
    [double]$PollSec = 5,
    [int]$MaxFiles = 0,
    [double]$StableSeconds = 2,
    [double]$TimeoutSec = 60,
    [double]$OptimizeTimeoutSec = 12,
    [switch]$SkipPreflight,
    [switch]$NoPreflightOnce,
    [switch]$SkipUiMap,
    [switch]$SkipOptimize,
    [switch]$Quick,
    [switch]$DryRun,
    [string]$ReportDir = "logs\\optiplan_queue",
    [string]$PythonPath
)

$ErrorActionPreference = "Stop"
$prevNativeErrPref = $null
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $prevNativeErrPref = $PSNativeCommandUseErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $false
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $projectRoot

if (-not $PythonPath) {
    $venvPython = Join-Path $projectRoot "backend\\.venv\\Scripts\\python.exe"
    if (Test-Path $venvPython) {
        $PythonPath = $venvPython
    } else {
        $PythonPath = "python"
    }
}

$args = @(
    "scripts/optiplan_ordered_inbox_runner.py",
    "--poll-sec", "$PollSec",
    "--max-files", "$MaxFiles",
    "--stable-seconds", "$StableSeconds",
    "--timeout", "$TimeoutSec",
    "--optimize-timeout", "$OptimizeTimeoutSec",
    "--report-dir", $ReportDir
)

if ($RuleFile) { $args += @("--rule-file", $RuleFile) }
if ($InboxDir) { $args += @("--inbox-dir", $InboxDir) }
if ($ProcessingDir) { $args += @("--processing-dir", $ProcessingDir) }
if ($ProcessedDir) { $args += @("--processed-dir", $ProcessedDir) }
if ($FailedDir) { $args += @("--failed-dir", $FailedDir) }
if ($Once) { $args += "--once" }
if ($SkipPreflight) { $args += "--skip-preflight" }
if ($NoPreflightOnce) { $args += "--no-preflight-once" }
if ($SkipUiMap) { $args += "--skip-ui-map" }
if ($SkipOptimize) { $args += "--skip-optimize" }
if ($Quick) { $args += "--quick" }
if ($DryRun) { $args += "--dry-run" }

$env:PYTHONWARNINGS = "ignore"
$pythonInvokeArgs = @("-W", "ignore") + $args
try {
    & $PythonPath @pythonInvokeArgs
    exit $LASTEXITCODE
}
finally {
    if ($null -ne $prevNativeErrPref) {
        $PSNativeCommandUseErrorActionPreference = $prevNativeErrPref
    }
}
