# PowerShell script to install node modules and run frontend server.
# If Vite fails with child-process restrictions (spawn EPERM), fallback to
# serving the prebuilt dist/ bundle via Python.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue) {
    $PSNativeCommandUseErrorActionPreference = $false
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$frontendPath = Join-Path $projectRoot "frontend"
$fallbackServerScript = Join-Path $scriptDir "serve_frontend_dist.py"
$bindHost = "127.0.0.1"
$preferredPort = 3001
$port = $preferredPort

Push-Location $frontendPath
try {
    if (-Not (Test-Path -Path "node_modules")) {
        npm install
    }

    # Clean previous listeners in the common frontend port range.
    $ports = 3001..3010
    $connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }
    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    if ($pids) {
        $pids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    }

    # If preferred port is still occupied, pick first free fallback port.
    foreach ($candidatePort in $ports) {
        $inUse = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $candidatePort }
        if (-not $inUse) {
            $port = $candidatePort
            break
        }
    }
    if ($port -ne $preferredPort) {
        Write-Warning "Port $preferredPort dolu. Frontend portu $port olarak ayarlandi."
    }

    Write-Host "Frontend dev server baslatiliyor (Vite): http://$($bindHost):$port" -ForegroundColor Cyan
    $viteOutput = cmd /d /c "npm run dev -- --host $bindHost --strictPort --port $port 2>&1"
    $viteExitCode = $LASTEXITCODE

    if ($viteExitCode -eq 0) {
        return
    }

    $viteText = ($viteOutput | Out-String)
    Write-Host $viteText

    $isSpawnEperm = $viteText -match "spawn EPERM"
    if (-not $isSpawnEperm) {
        throw "Frontend dev server acilamadi (exit code: $viteExitCode)."
    }

    if (-not (Test-Path -Path ".\dist\index.html")) {
        throw "Vite acilamadi ve fallback icin frontend/dist/index.html bulunamadi."
    }

    if (-not (Test-Path -Path $fallbackServerScript)) {
        throw "Fallback sunucu scripti bulunamadi: $fallbackServerScript"
    }

    Write-Warning "Vite spawn EPERM hatasi verdi. Dist static fallback devreye aliniyor."
    Write-Host "Frontend static fallback: http://$($bindHost):$port" -ForegroundColor Yellow

    python $fallbackServerScript --directory ".\dist" --host $bindHost --port $port
} finally {
    Pop-Location
}
