# build_frontend.ps1
# React/Tailwind build. Proje geldiğinde path'ler güncellenecek.

param(
  [string]$FrontendPath = ".\frontend",
  [string]$OutDir = ".\dist\ui"
)

$ErrorActionPreference = "Stop"

Write-Host ">> Frontend build starting..."
Push-Location $FrontendPath
npm ci
npm run build
Pop-Location

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Write-Host ">> Build çıktısını $OutDir altına kopyalayın (tooling'e göre build/dist değişebilir)."
