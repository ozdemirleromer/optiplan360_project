param(
    [Parameter(Mandatory = $true)]
    [string]$XlsxPath,
    [double]$TimeoutSec = 60,
    [double]$OptimizeTimeoutSec = 12,
    [ValidateSet("button", "menu", "f5", "auto")]
    [string]$OptimizeTrigger = "button",
    [switch]$SkipPreflight,
    [switch]$SkipUiMap,
    [switch]$SkipOptimize,
    [string]$ReportDir = "logs\\optiplan_professional",
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

if (-not (Test-Path $XlsxPath)) {
    throw "XLSX bulunamadi: $XlsxPath"
}
$xlsxFull = (Resolve-Path $XlsxPath).Path

if (-not $PythonPath) {
    $venvPython = Join-Path $projectRoot "backend\\.venv\\Scripts\\python.exe"
    if (Test-Path $venvPython) {
        $PythonPath = $venvPython
    } else {
        $PythonPath = "python"
    }
}

if ([System.IO.Path]::IsPathRooted($ReportDir)) {
    $reportRoot = $ReportDir
} else {
    $reportRoot = Join-Path $projectRoot $ReportDir
}
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$jsonReport = Join-Path $reportRoot "professional_run_$stamp.json"
$metaReport = Join-Path $reportRoot "professional_run_$stamp.meta.json"
$consoleLog = Join-Path $reportRoot "professional_run_$stamp.log"

$args = @(
    "scripts/optiplan_professional_run.py",
    "--xlsx", $xlsxFull,
    "--timeout", "$TimeoutSec",
    "--optimize-timeout", "$OptimizeTimeoutSec",
    "--optimize-trigger", $OptimizeTrigger,
    "--report-json", $jsonReport
)

if ($SkipPreflight) { $args += "--skip-preflight" }
if ($SkipUiMap) { $args += "--skip-ui-map" }
if ($SkipOptimize) { $args += "--skip-optimize" } else { $args += "--run-optimize" }
$env:PYTHONWARNINGS = "ignore"
$pythonInvokeArgs = @("-W", "ignore") + $args

Write-Host "OPTIPLAN PROFESSIONAL RUN"
Write-Host "  XLSX : $xlsxFull"
Write-Host "  PY   : $PythonPath"
Write-Host "  LOG  : $consoleLog"
Write-Host "  JSON : $jsonReport"

$start = Get-Date
$prevErr = $ErrorActionPreference
if ([System.IO.Path]::IsPathRooted($ReportDir)) {
    $reportRootForTmp = $ReportDir
} else {
    $reportRootForTmp = Join-Path $projectRoot $ReportDir
}
$stdoutTmp = Join-Path $reportRootForTmp "professional_run_$stamp.stdout.log"
$stderrTmp = Join-Path $reportRootForTmp "professional_run_$stamp.stderr.log"
try {
    $ErrorActionPreference = "Continue"
    $proc = Start-Process `
        -FilePath $PythonPath `
        -ArgumentList $pythonInvokeArgs `
        -NoNewWindow `
        -Wait `
        -PassThru `
        -RedirectStandardOutput $stdoutTmp `
        -RedirectStandardError $stderrTmp
    $exitCode = $proc.ExitCode

    $combined = New-Object System.Collections.Generic.List[string]
    if (Test-Path $stdoutTmp) {
        $stdoutLines = Get-Content $stdoutTmp
        foreach ($line in $stdoutLines) {
            Write-Host $line
            $combined.Add($line)
        }
    }
    if (Test-Path $stderrTmp) {
        $stderrLines = Get-Content $stderrTmp | Where-Object {
            $_ -notlike "*32-bit application should be automated using 32-bit Python*" -and
            $_ -notlike "*pywinauto\\application.py:1085: UserWarning:*" -and
            $_ -notlike "*warnings.warn(*"
        }
        foreach ($line in $stderrLines) {
            Write-Host $line
            $combined.Add($line)
        }
    }

    $combinedText = ($combined -join [Environment]::NewLine)
    Set-Content -Path $consoleLog -Value $combinedText -Encoding UTF8
}
finally {
    $ErrorActionPreference = $prevErr
    if (Test-Path $stdoutTmp) { Remove-Item $stdoutTmp -Force -ErrorAction SilentlyContinue }
    if (Test-Path $stderrTmp) { Remove-Item $stderrTmp -Force -ErrorAction SilentlyContinue }
    if ($null -ne $prevNativeErrPref) {
        $PSNativeCommandUseErrorActionPreference = $prevNativeErrPref
    }
}
$end = Get-Date

$metaPayload = [ordered]@{
    started_at = $start.ToString("s")
    ended_at = $end.ToString("s")
    duration_sec = [math]::Round(($end - $start).TotalSeconds, 3)
    exit_code = $exitCode
    python = $PythonPath
    xlsx = $xlsxFull
    command = @($PythonPath) + $pythonInvokeArgs
    report_json = $jsonReport
    console_log = $consoleLog
}
$metaPayload | ConvertTo-Json -Depth 8 | Set-Content -Path $metaReport -Encoding UTF8

Write-Host "RAPORLAR:"
Write-Host "  - $jsonReport"
Write-Host "  - $metaReport"
Write-Host "  - $consoleLog"

exit $exitCode
