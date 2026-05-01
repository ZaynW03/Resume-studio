$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$tessdataDir = Join-Path $repoRoot 'backend\tessdata'

$packages = @(
  @{ Id = 'tschoonj.GTKForWindows'; Name = 'GTK3 Runtime' },
  @{ Id = 'tesseract-ocr.tesseract'; Name = 'Tesseract OCR' },
  @{ Id = 'oschwartz10612.Poppler'; Name = 'Poppler' }
)

Write-Host 'Installing Windows system dependencies for Resume Studio...'

foreach ($pkg in $packages) {
  Write-Host "-> $($pkg.Name)"
  winget install -e --id $pkg.Id --accept-source-agreements --accept-package-agreements --silent
}

New-Item -ItemType Directory -Force -Path $tessdataDir | Out-Null
$systemTessdataDir = 'C:\Program Files\Tesseract-OCR\tessdata'
$baseLangs = @('eng.traineddata', 'osd.traineddata')
foreach ($lang in $baseLangs) {
  $src = Join-Path $systemTessdataDir $lang
  $dst = Join-Path $tessdataDir $lang
  if (Test-Path $src) {
    Copy-Item -LiteralPath $src -Destination $dst -Force
  }
}
$chiSimPath = Join-Path $tessdataDir 'chi_sim.traineddata'
Write-Host '-> Chinese OCR data (chi_sim)'
Invoke-WebRequest `
  -Uri 'https://github.com/tesseract-ocr/tessdata_fast/raw/main/chi_sim.traineddata' `
  -OutFile $chiSimPath

$candidatePaths = @(
  'C:\Program Files\GTK3-Runtime Win64\bin',
  'C:\Program Files\Tesseract-OCR'
)

$popplerRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
if (Test-Path $popplerRoot) {
  $popplerBin = Get-ChildItem $popplerRoot -Directory -Filter 'oschwartz10612.Poppler_*' |
    ForEach-Object {
      Get-ChildItem $_.FullName -Directory -Filter 'poppler-*' -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName 'Library\bin' }
    } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1

  if ($popplerBin) {
    $candidatePaths += $popplerBin
  }
}

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$parts = @()
if ($userPath) {
  $parts = $userPath -split ';' | Where-Object { $_ }
}

foreach ($path in $candidatePaths) {
  if ((Test-Path $path) -and -not ($parts -contains $path)) {
    $parts += $path
    Write-Host "Added to PATH: $path"
  }
}

[Environment]::SetEnvironmentVariable('Path', (($parts | Select-Object -Unique) -join ';'), 'User')
[Environment]::SetEnvironmentVariable('TESSDATA_PREFIX', $tessdataDir, 'User')

Write-Host ''
Write-Host 'Done. Restart your terminal or restart start.bat, then open:'
Write-Host '  http://localhost:8000/api/diagnostics'
