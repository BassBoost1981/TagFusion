# Setup portable Python environment for AiApiServer (inside this folder → USB-portable).
# Portables Python-venv im AiApiServer-Ordner anlegen und Abhängigkeiten installieren.
#
# Usage / Nutzung:
#   powershell -ExecutionPolicy Bypass -File setup_env.ps1
#   powershell -ExecutionPolicy Bypass -File setup_env.ps1 -BasePython "C:\path\to\python.exe"
param(
    [string]$BasePython = "$env:LOCALAPPDATA\Programs\Python\Python310\python.exe"
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$venv = Join-Path $here 'venv'
$req  = Join-Path $here 'requirements.txt'

if (-not (Test-Path $BasePython)) { throw "Basis-Python nicht gefunden: $BasePython" }
if (-not (Test-Path $req))        { throw "requirements.txt nicht gefunden: $req" }

Write-Host "Basis-Python : $BasePython"
& $BasePython --version
Write-Host "venv-Ziel    : $venv"

if (-not (Test-Path (Join-Path $venv 'Scripts\python.exe'))) {
    Write-Host "Erstelle venv ..."
    & $BasePython -m venv $venv
}
$vpy = Join-Path $venv 'Scripts\python.exe'

Write-Host "pip aktualisieren ..."
& $vpy -m pip install --upgrade pip

Write-Host "Abhängigkeiten installieren ..."
& $vpy -m pip install -r $req

# requirements.txt nutzt --extra-index-url; das erzwingt NICHT die CUDA-Variante von torch
# (pip zieht dann die CPU-Version von PyPI). Torch-Trio explizit vom cu128-Index nachziehen.
# requirements.txt's --extra-index-url does not force the CUDA torch build — reinstall the trio
# from the cu128 index so the GPU build wins (large download).
Write-Host "Torch mit CUDA (cu128) erzwingen ..."
& $vpy -m pip uninstall -y torch torchvision torchaudio
& $vpy -m pip install --index-url https://download.pytorch.org/whl/cu128 torch torchvision torchaudio

Write-Host "`n=== Verifikation ==="
& $vpy -c "import flask; print('flask', flask.__version__)"
& $vpy -c "import torch; print('torch', torch.__version__, '| cuda available:', torch.cuda.is_available())"
Write-Host "Fertig. venv-Python: $vpy"
