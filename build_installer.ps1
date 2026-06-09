[CmdletBinding()]
param(
    [switch]$RequireSigned,
    [switch]$SkipWebView2Download
)

# Build a Windows installer for TagFusion.
#
# Prerequisites:
#   - Inno Setup installed (winget install JRSoftware.InnoSetup)
#   - .\build_release.ps1 already run (publish output present)
#
# Output: installer\Output\TagFusion-Setup-1.0.0.exe

$ErrorActionPreference = 'Stop'

$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallerDir = Join-Path $ScriptDir 'installer'
$PublishDir  = Join-Path $ScriptDir 'Backend\TagFusion\bin\Release\net8.0-windows\win-x64\publish'
$Exe         = Join-Path $PublishDir 'TagFusion.exe'
$WebView2Url = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703'
$WebView2Out = Join-Path $InstallerDir 'MicrosoftEdgeWebview2Setup.exe'

if (-not (Test-Path -LiteralPath $Exe)) {
    Write-Error "Publish output missing. Run .\build_release.ps1 first."
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $PublishDir 'wwwroot\index.html'))) {
    Write-Error "Publish output is incomplete: wwwroot\index.html is missing."
    exit 1
}

$signature = Get-AuthenticodeSignature -LiteralPath $Exe
if ($signature.Status -ne 'Valid') {
    if ($RequireSigned) {
        Write-Error "TagFusion.exe is not signed or signature is invalid: $($signature.Status)"
        exit 1
    }

    Write-Warning "TagFusion.exe is not signed or signature is invalid: $($signature.Status)"
}

# Locate ISCC.exe (Inno Setup compiler)
$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
    $candidates = @(
        'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
        'C:\Program Files\Inno Setup 6\ISCC.exe'
    )
    $iscc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $iscc) {
        Write-Error "Inno Setup not found. Install via: winget install JRSoftware.InnoSetup"
        exit 1
    }
}

# Download WebView2 bootstrapper if missing (~2 MB) — bundled into the installer
if (-not (Test-Path $WebView2Out)) {
    if ($SkipWebView2Download) {
        Write-Error "WebView2 bootstrapper missing: $WebView2Out"
        exit 1
    }

    Write-Host "Downloading WebView2 Evergreen Bootstrapper..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $WebView2Url -OutFile $WebView2Out
}

Write-Host "Compiling installer..." -ForegroundColor Cyan
$isccPath = if ($iscc.Source) { $iscc.Source } else { [string]$iscc }
Push-Location $InstallerDir
try {
    & $isccPath 'TagFusion.iss'
    if ($LASTEXITCODE -ne 0) {
        Write-Error "ISCC compilation failed (exit $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}

$installer = Get-ChildItem (Join-Path $InstallerDir 'Output') -Filter 'TagFusion-Setup-*.exe' |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if (-not $installer) {
    Write-Error "Installer compilation completed, but no TagFusion-Setup-*.exe was found."
    exit 1
}

Write-Host "Installer built successfully." -ForegroundColor Green
$installer | Format-Table Name, Length, LastWriteTime
