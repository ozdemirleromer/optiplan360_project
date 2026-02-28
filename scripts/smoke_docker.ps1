param(
  [string]$FrontendUrl = "http://localhost:3001",
  [string]$BackendUrl = "http://localhost:8080",
  [switch]$CheckDocs
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

if ($allPassed) {
  Write-Host "Smoke checks passed." -ForegroundColor Green
  exit 0
}

Write-Host "Smoke checks failed." -ForegroundColor Red
exit 1
