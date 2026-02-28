# PowerShell script to install node modules and run frontend dev server
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")
$frontendPath = Join-Path $projectRoot "frontend"

Push-Location $frontendPath
if (-Not (Test-Path -Path "node_modules")) {
    npm install
}

# Clean previous Vite listeners in the common port range
$ports = 3001..3010
$connections = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $ports -contains $_.LocalPort }
$pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
if ($pids) {
    $pids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}

# Run npm dev or start
try {
    npm run dev -- --host 127.0.0.1 --strictPort --port 3001
} catch {
    npm start
}
Pop-Location
