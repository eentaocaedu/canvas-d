[CmdletBinding()]
param(
  [ValidatePattern('^(latest|v?\d+\.\d+\.\d+)$')]
  [string]$Version = 'latest',

  [switch]$Silent,

  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$repo = 'eentaocaedu/canvas-d'
$tempRoot = $null

if ($env:OS -ne 'Windows_NT') {
  throw 'O instalador do Canvas D esta disponivel apenas para Windows.'
}

# PowerShell 5.1 pode nao habilitar TLS 1.2 por padrao em instalacoes antigas.
[Net.ServicePointManager]::SecurityProtocol =
  [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$headers = @{
  'Accept' = 'application/vnd.github+json'
  'User-Agent' = 'Canvas-D-Installer'
  'X-GitHub-Api-Version' = '2022-11-28'
}

$normalizedVersion = $Version.TrimStart('v')
$releaseUri = if ($normalizedVersion -eq 'latest') {
  "https://api.github.com/repos/$repo/releases/latest"
} else {
  "https://api.github.com/repos/$repo/releases/tags/v$normalizedVersion"
}

Write-Host 'Canvas D Installer' -ForegroundColor Cyan
Write-Host 'Consultando a release oficial no GitHub...'

try {
  $release = Invoke-RestMethod -Uri $releaseUri -Headers $headers
} catch {
  throw "Nao foi possivel consultar a release '$Version'. $($_.Exception.Message)"
}

$asset = @($release.assets) |
  Where-Object { $_.name -match '^Canvas[ .]D[ .]Setup[ .]\d+\.\d+\.\d+\.exe$' } |
  Select-Object -First 1

if (-not $asset) {
  throw "A release $($release.tag_name) nao possui um instalador Windows reconhecido."
}

$expectedHash = $null
$assetDigest = [string]$asset.digest
if ($assetDigest -match '^sha256:([0-9a-fA-F]{64})$') {
  $expectedHash = $Matches[1].ToUpperInvariant()
} else {
  $hashInNotes = [regex]::Match([string]$release.body, '(?i)SHA-256.{0,24}?([0-9a-f]{64})')
  if ($hashInNotes.Success) {
    $expectedHash = $hashInNotes.Groups[1].Value.ToUpperInvariant()
  }
}

if (-not $expectedHash) {
  throw "A release $($release.tag_name) nao possui um SHA-256 verificavel. O download foi interrompido."
}

$sizeMb = [math]::Round([double]$asset.size / 1MB, 2)
Write-Host "Versao: $($release.tag_name)" -ForegroundColor Green
Write-Host "Arquivo: $($asset.name) ($sizeMb MB)"
Write-Host "SHA-256 esperado: $expectedHash"

if ($CheckOnly) {
  Write-Host 'Verificacao remota concluida. Nenhum arquivo foi baixado.' -ForegroundColor Green
  return
}

$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$tempRoot = [IO.Path]::GetFullPath((Join-Path $tempBase ("canvas-d-installer-" + [guid]::NewGuid().ToString('N'))))
if (-not $tempRoot.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'O diretorio temporario calculado nao e seguro.'
}

$installerPath = Join-Path $tempRoot $asset.name

try {
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

  Write-Host 'Baixando o instalador oficial...'
  Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -Headers $headers -OutFile $installerPath

  $actualHash = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actualHash -ne $expectedHash) {
    throw "Falha de integridade. Esperado: $expectedHash. Recebido: $actualHash."
  }

  Write-Host 'Integridade confirmada.' -ForegroundColor Green
  Write-Host $(if ($Silent) { 'Instalando em modo silencioso...' } else { 'Abrindo o instalador...' })

  $process = if ($Silent) {
    Start-Process -FilePath $installerPath -ArgumentList '/S' -Wait -PassThru
  } else {
    Start-Process -FilePath $installerPath -Wait -PassThru
  }

  if ($process.ExitCode -ne 0) {
    throw "O instalador terminou com o codigo $($process.ExitCode)."
  }

  Write-Host "Canvas D $($release.tag_name) instalado com sucesso." -ForegroundColor Green
} finally {
  if ($tempRoot -and (Test-Path -LiteralPath $tempRoot)) {
    $resolvedTemp = [IO.Path]::GetFullPath($tempRoot)
    if ($resolvedTemp.StartsWith($tempBase, [StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -LiteralPath $resolvedTemp -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

