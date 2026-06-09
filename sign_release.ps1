# Sign the published TagFusion.exe with a code-signing certificate.
#
# Usage:
#   $env:CERT_PFX  = "C:\path\to\cert.pfx"
#   $env:CERT_PASS = "your_pfx_password"
#   .\sign_release.ps1
#
# The script is idempotent — safe to re-run after each build.
# It uses signtool.exe from the Windows 10/11 SDK; install it once via:
#   winget install Microsoft.WindowsSDK.10.0.22621
#
# Without a real cert the build is unsigned and Windows SmartScreen will
# show "Windows protected your PC" the first time a user runs the .exe.

$ErrorActionPreference = 'Stop'

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublishDir  = Join-Path $ScriptDir "Backend\TagFusion\bin\Release\net8.0-windows\win-x64\publish"
$Exe         = Join-Path $PublishDir "TagFusion.exe"
$TimestampUrl = 'http://timestamp.digicert.com'

if (-not (Test-Path $Exe)) {
    Write-Error "TagFusion.exe not found at $Exe. Run .\build_release.ps1 first."
    exit 1
}

if (-not $env:CERT_PFX -or -not $env:CERT_PASS) {
    Write-Error "Set CERT_PFX (path to .pfx) and CERT_PASS (password) before running."
    exit 1
}
if (-not (Test-Path $env:CERT_PFX)) {
    Write-Error "Certificate file not found: $env:CERT_PFX"
    exit 1
}

# Find signtool.exe — newest first
$signtool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin' -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match 'x64\\signtool\.exe$' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1

if (-not $signtool) {
    Write-Error "signtool.exe not found. Install Windows 10/11 SDK (winget install Microsoft.WindowsSDK.10.0.22621)."
    exit 1
}

Write-Host "Signing $Exe ..." -ForegroundColor Cyan
& $signtool.FullName sign `
    /fd SHA256 `
    /tr $TimestampUrl `
    /td SHA256 `
    /f $env:CERT_PFX `
    /p $env:CERT_PASS `
    $Exe
if ($LASTEXITCODE -ne 0) {
    Write-Error "signtool failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Verifying signature..." -ForegroundColor Cyan
& $signtool.FullName verify /pa $Exe
if ($LASTEXITCODE -ne 0) {
    Write-Error "Signature verification failed."
    exit $LASTEXITCODE
}

Write-Host "OK: TagFusion.exe is now code-signed." -ForegroundColor Green
