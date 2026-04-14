param(
  [string]$FrontendUrl = "http://localhost:3001",
  [string]$BackendUrl = "http://localhost:8000",
  [switch]$CheckDocs,
  [switch]$CheckMonitoring,
  [switch]$Watch,
  [int]$IntervalSec = 15,
  [int]$Iterations = 0
)

$ErrorActionPreference = "Stop"

function Test-HttpStatus {
  param(
    [string]$Name,
    [string]$Url,
    [int]$ExpectedStatus = 200
  )

  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
    if ($resp.StatusCode -ne $ExpectedStatus) {
      Write-Host ("[FAIL] {0} -> {1} (expected {2})" -f $Name, $resp.StatusCode, $ExpectedStatus) -ForegroundColor Red
      return $false
    }
    Write-Host ("[OK]   {0} -> {1}" -f $Name, $resp.StatusCode) -ForegroundColor Green
    return $true
  }
  catch {
    Write-Host ("[FAIL] {0} -> {1}" -f $Name, $_.Exception.Message) -ForegroundColor Red
    return $false
  }
}

function Test-BackendHealth {
  param([string]$Url)

  try {
    $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
    if ($resp.StatusCode -ne 200) {
      Write-Host ("[FAIL] Backend health -> {0}" -f $resp.StatusCode) -ForegroundColor Red
      return $false
    }

    $payload = $resp.Content | ConvertFrom-Json
    if ($payload.status -ne "healthy") {
      Write-Host ("[FAIL] Backend health payload status: {0}" -f $payload.status) -ForegroundColor Red
      return $false
    }

    Write-Host ("[OK]   Backend health -> healthy ({0})" -f $payload.timestamp) -ForegroundColor Green
    return $true
  }
  catch {
    Write-Host ("[FAIL] Backend health -> {0}" -f $_.Exception.Message) -ForegroundColor Red
    return $false
  }
}

function Invoke-SmokeChecks {
  $allPassed = $true

  Write-Host "Running Docker smoke checks..." -ForegroundColor Cyan

  if (-not (Test-HttpStatus -Name "Frontend root" -Url $FrontendUrl -ExpectedStatus 200)) {
    $allPassed = $false
  }

  if (-not (Test-BackendHealth -Url ("{0}/health" -f $BackendUrl.TrimEnd('/')))) {
    $allPassed = $false
  }

  if ($CheckDocs) {
    if (-not (Test-HttpStatus -Name "Backend docs" -Url ("{0}/docs" -f $BackendUrl.TrimEnd('/')) -ExpectedStatus 200)) {
      $allPassed = $false
    }
  }

  if ($CheckMonitoring) {
    if (-not (Test-HttpStatus -Name "Grafana health" -Url "http://localhost:3002/api/health" -ExpectedStatus 200)) {
      $allPassed = $false
    }
    if (-not (Test-HttpStatus -Name "Prometheus health" -Url "http://localhost:9090/-/healthy" -ExpectedStatus 200)) {
      $allPassed = $false
    }
    if (-not (Test-HttpStatus -Name "Jaeger UI" -Url "http://localhost:16686" -ExpectedStatus 200)) {
      $allPassed = $false
    }
    if (-not (Test-HttpStatus -Name "Loki ready" -Url "http://localhost:3100/ready" -ExpectedStatus 200)) {
      $allPassed = $false
    }
    if (-not (Test-HttpStatus -Name "Monitoring nginx" -Url "http://localhost/" -ExpectedStatus 200)) {
      $allPassed = $false
    }
  }

  if ($allPassed) {
    Write-Host "Smoke checks passed." -ForegroundColor Green
    return $true
  }

  Write-Host "Smoke checks failed." -ForegroundColor Red
  return $false
}

if (-not $Watch) {
  if (Invoke-SmokeChecks) {
    exit 0
  }
  exit 1
}

$iteration = 0
while ($true) {
  $iteration++
  Write-Host ("\n--- Watch iteration {0} ({1}) ---" -f $iteration, (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")) -ForegroundColor Yellow
  [void](Invoke-SmokeChecks)

  if ($Iterations -gt 0 -and $iteration -ge $Iterations) {
    break
  }

  Start-Sleep -Seconds $IntervalSec
}

exit 0
