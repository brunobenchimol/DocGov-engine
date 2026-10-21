param(
    [string]$DestinationDirectory
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo = "brunobenchimol/DocGov-engine"
$assetName = "docgov-engine-win-x64.exe"

# 1. Resolucao resiliente do diretorio de instalacao
$targetDir = ""
if ($DestinationDirectory) {
    $targetDir = $DestinationDirectory
} elseif ($args.Count -gt 0) {
    $targetDir = $args[0]
} elseif ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot "..\package.json"))) {
    $targetDir = Join-Path $PSScriptRoot "..\bin"
} else {
    $targetDir = Join-Path $env:LOCALAPPDATA "docgov\bin"
}

if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
}

$dest = Join-Path $targetDir "docgov-engine.exe"
$resolvedDest = [System.IO.Path]::GetFullPath($dest)
$url = "https://github.com/$repo/releases/latest/download/$assetName"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "Instalador do docgov-engine (Windows x64)" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ("Origem:  " + $url) -ForegroundColor Gray
Write-Host ("Destino: " + $resolvedDest) -ForegroundColor Gray
Write-Host ""
Write-Host "Iniciando download..." -ForegroundColor Yellow

# 2. Download resiliente com Fail-Fast estrito
$downloadOk = $false
$curlExe = Get-Command "curl.exe" -ErrorAction SilentlyContinue
if ($curlExe) {
    try {
        & curl.exe -fL "$url" -o "$resolvedDest"
        if ($LASTEXITCODE -eq 0 -and (Test-Path $resolvedDest)) {
            $downloadOk = $true
        }
    } catch {
        $downloadOk = $false
    }
}

if (-not $downloadOk) {
    Write-Host "curl.exe falhou ou indisponivel. Tentando via Invoke-WebRequest..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri $url -OutFile $resolvedDest -UseBasicParsing
        $downloadOk = (Test-Path $resolvedDest)
    } catch {
        throw ("ERRO FATAL: Falha ao baixar docgov-engine de " + $url + ". Detalhes: " + $_)
    }
}

# 3. Sanity check do binario baixado
if (-not (Test-Path $resolvedDest)) {
    throw ("ERRO FATAL: O arquivo de destino nao foi gerado em " + $resolvedDest)
}

$fileSize = (Get-Item $resolvedDest).Length
$minExpectedBytes = 50 * 1024 * 1024 # 50 MB
if ($fileSize -lt $minExpectedBytes) {
    Remove-Item -Force $resolvedDest -ErrorAction SilentlyContinue
    $sizeMb = [math]::Round($fileSize / 1MB, 2)
    throw ("ERRO FATAL: Binario baixado corrompido ou incompleto: " + $sizeMb + " MB. Minimo esperado: 50 MB.")
}

# 4. Validacao funcional imediata (--version)
try {
    $versionOutput = (& $resolvedDest --version 2>&1).Trim()
    if ($versionOutput -notmatch "docgov-engine\s+v") {
        throw ("Saida inesperada na checagem de versao: " + $versionOutput)
    }
} catch {
    throw ("ERRO FATAL: O binario baixado em " + $resolvedDest + " nao respondeu ao teste com --version. Detalhes: " + $_)
}

Write-Host ""
Write-Host ("[OK] Sucesso! " + $versionOutput + " instalado e validado.") -ForegroundColor Green
Write-Host ("Localizacao: " + $resolvedDest) -ForegroundColor Green
Write-Host ""
Write-Host "Dicas de Configuracao:" -ForegroundColor Cyan
Write-Host "  1. Para usar diretamente no terminal, certifique-se de que a pasta abaixo esta no seu PATH:" -ForegroundColor Gray
$targetFolder = [System.IO.Path]::GetDirectoryName($resolvedDest)
Write-Host ("     " + $targetFolder) -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Para configurar no Claude Desktop ou Antigravity MCP (claude_desktop_config.json):" -ForegroundColor Gray
$jsonPath = $resolvedDest.Split([char]92) -join "\\"
Write-Host "     `"docgov-engine`": {" -ForegroundColor DarkGray
Write-Host ("       `"command`": `"" + $jsonPath + "`",") -ForegroundColor DarkGray
Write-Host "       `"args`": []" -ForegroundColor DarkGray
Write-Host "     }" -ForegroundColor DarkGray
Write-Host ""
