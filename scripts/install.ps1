$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo = "brunobenchimol/docgov-docx-engine"
$assetName = "docgov-docx-windows-x64.exe"
$binDir = if ($args.Count -gt 0) { $args[0] } else { Join-Path $PSScriptRoot "..\bin" }
if (!(Test-Path $binDir)) { New-Item -ItemType Directory -Force -Path $binDir | Out-Null }
$dest = Join-Path $binDir "docgov-docx.exe"

$url = "https://github.com/$repo/releases/latest/download/$assetName"
Write-Host "Baixando docgov-docx para Windows de $url ..." -ForegroundColor Cyan
curl.exe -fL $url -o $dest
Write-Host "Download concluído com sucesso: $dest" -ForegroundColor Green

