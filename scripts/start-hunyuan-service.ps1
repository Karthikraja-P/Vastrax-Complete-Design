$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$modelRoot = Join-Path $repoRoot '3d-model\Hunyuan3D-2.1'
$python = Join-Path $modelRoot '.venv\Scripts\python.exe'
$sitePackages = Join-Path $modelRoot '.venv\Lib\site-packages'
$secretLine = Get-Content -LiteralPath (Join-Path $repoRoot '.env') | Where-Object { $_ -match '^GENERATOR_3D_SECRET=' } | Select-Object -First 1
if (-not $secretLine) { throw 'GENERATOR_3D_SECRET is missing from .env' }
$generatorSecret = $secretLine.Substring('GENERATOR_3D_SECRET='.Length).Trim()
if ($generatorSecret.Length -lt 32) { throw 'GENERATOR_3D_SECRET must be at least 32 characters' }
if (-not (Test-Path -LiteralPath $python)) { throw "Hunyuan Python environment is missing: $python" }

try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8082/health' -TimeoutSec 2
    if ($health.status -eq 'healthy') {
        Write-Output 'Hunyuan3D is already healthy on port 8082.'
        exit 0
    }
} catch { }

$env:PYTHONPATH = $sitePackages
$env:GENERATOR_3D_SECRET = $generatorSecret
$env:HF_HOME = Join-Path $env:USERPROFILE '.cache\huggingface'
$cachePath = Join-Path $env:LOCALAPPDATA 'Temp\vastrax-hunyuan-cache'
$outLog = Join-Path $env:LOCALAPPDATA 'Temp\vastrax-hunyuan-out.log'
$errLog = Join-Path $env:LOCALAPPDATA 'Temp\vastrax-hunyuan-err.log'

$process = Start-Process -FilePath $python -ArgumentList @(
    'api_server.py', '--port', '8082', '--host', '0.0.0.0',
    '--low_vram_mode', '--cache-path', $cachePath
) -WorkingDirectory $modelRoot -RedirectStandardOutput $outLog -RedirectStandardError $errLog -WindowStyle Hidden -PassThru

for ($attempt = 0; $attempt -lt 90; $attempt++) {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8082/health' -TimeoutSec 2
        if ($health.status -eq 'healthy') {
            Write-Output "Hunyuan3D ready on port 8082 (launcher PID $($process.Id))."
            exit 0
        }
    } catch { }
    if ($process.HasExited) { throw "Hunyuan3D exited during startup. Check $errLog" }
}
throw "Hunyuan3D did not become healthy. Check $errLog"
