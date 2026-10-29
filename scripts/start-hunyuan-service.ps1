$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$modelRoot = Join-Path $repoRoot '3d-model\Hunyuan3D-2.1'
$python = Join-Path $modelRoot '.venv\Scripts\python.exe'
$sitePackages = Join-Path $modelRoot '.venv\Lib\site-packages'
$serviceScript = Join-Path $repoRoot '3d-model\multiview_service.py'
$secretLine = Get-Content -LiteralPath (Join-Path $repoRoot '.env') | Where-Object { $_ -match '^GENERATOR_3D_SECRET=' } | Select-Object -First 1
if (-not $secretLine) { throw 'GENERATOR_3D_SECRET is missing from .env' }
$generatorSecret = $secretLine.Substring('GENERATOR_3D_SECRET='.Length).Trim()
if ($generatorSecret.Length -lt 32) { throw 'GENERATOR_3D_SECRET must be at least 32 characters' }
if (-not (Test-Path -LiteralPath $python)) { throw "Hunyuan Python environment is missing: $python" }
if (-not (Test-Path -LiteralPath $serviceScript)) { throw "Multi-view service file is missing: $serviceScript" }

try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8082/health' -TimeoutSec 2
    if ($health.status -eq 'healthy' -and $health.capabilities.multiview -eq $true) {
        Write-Output 'Hunyuan multi-view service is already healthy on port 8082.'
        exit 0
    }
    throw 'A single-view Hunyuan service is already running on port 8082. Stop that Hunyuan process, then rerun this launcher.'
} catch {
    if ($_.Exception.Message -like '*single-view Hunyuan service*') { throw }
}

$listener = Get-NetTCPConnection -LocalPort 8082 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) { throw "Port 8082 is occupied by PID $($listener.OwningProcess). Stop the existing Hunyuan process, then rerun this launcher." }

$env:PYTHONPATH = $sitePackages
$env:PYTHONIOENCODING = 'utf-8'
$env:HF_HUB_DISABLE_XET = '1'
$env:GENERATOR_3D_SECRET = $generatorSecret
$env:HF_HOME = Join-Path $env:USERPROFILE '.cache\huggingface'
$env:HY3DGEN_MODELS = Join-Path $env:USERPROFILE '.cache\hy3dgen'
$cachePath = Join-Path $env:LOCALAPPDATA 'Temp\vastrax-hunyuan-cache'
$outLog = Join-Path $env:LOCALAPPDATA 'Temp\vastrax-hunyuan-out.log'
$errLog = Join-Path $env:LOCALAPPDATA 'Temp\vastrax-hunyuan-err.log'
$modelPath = if ($env:VASTRAX_HUNYUAN_MV_MODEL) { $env:VASTRAX_HUNYUAN_MV_MODEL } else { 'tencent/Hunyuan3D-2mv' }
$subfolder = if ($env:VASTRAX_HUNYUAN_MV_SUBFOLDER) { $env:VASTRAX_HUNYUAN_MV_SUBFOLDER } else { 'hunyuan3d-dit-v2-mv' }
$steps = if ($env:VASTRAX_HUNYUAN_MV_STEPS) { $env:VASTRAX_HUNYUAN_MV_STEPS } else { '30' }
$octreeResolution = if ($env:VASTRAX_HUNYUAN_MV_OCTREE_RESOLUTION) { $env:VASTRAX_HUNYUAN_MV_OCTREE_RESOLUTION } else { '380' }

$process = Start-Process -FilePath $python -ArgumentList @(
    $serviceScript, '--port', '8082', '--host', '0.0.0.0',
    '--model_path', $modelPath, '--subfolder', $subfolder,
    '--steps', $steps, '--octree-resolution', $octreeResolution,
    '--cache-path', $cachePath
) -WorkingDirectory $modelRoot -RedirectStandardOutput $outLog -RedirectStandardError $errLog -WindowStyle Hidden -PassThru

for ($attempt = 0; $attempt -lt 300; $attempt++) {
    Start-Sleep -Seconds 2
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8082/health' -TimeoutSec 2
        if ($health.status -eq 'healthy' -and $health.capabilities.multiview -eq $true) {
            Write-Output "Hunyuan multi-view ready on port 8082 (PID $($process.Id))."
            exit 0
        }
    } catch { }
    if ($process.HasExited) { throw "Hunyuan multi-view service exited during startup. Check $errLog" }
}
throw "Hunyuan multi-view service did not become healthy. Check $errLog"
