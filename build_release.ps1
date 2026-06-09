
# Build Release Script for TagFusion

[CmdletBinding()]
param(
    [switch]$RequireSigned
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = $ScriptDir
$FrontendDir = Join-Path $RootDir 'Frontend'
$BackendRoot = Join-Path $RootDir 'Backend'
$BackendProject = Join-Path $BackendRoot 'TagFusion\TagFusion.csproj'
$PublishDir = Join-Path $BackendRoot 'TagFusion\bin\Release\net8.0-windows\win-x64\publish'
$Exe = Join-Path $PublishDir 'TagFusion.exe'
$WwwrootIndex = Join-Path $PublishDir 'wwwroot\index.html'

function Assert-LastExitCode {
    param([string]$Step)

    if ($LASTEXITCODE -ne 0) {
        throw "$Step failed with exit code $LASTEXITCODE"
    }
}

Write-Host '1. Building Frontend and syncing wwwroot...' -ForegroundColor Cyan
Push-Location $FrontendDir
try {
    npm ci
    Assert-LastExitCode 'npm ci'

    npm run build:desktop
    Assert-LastExitCode 'Frontend desktop build'
}
finally {
    Pop-Location
}

Write-Host '2. Restoring and publishing Backend...' -ForegroundColor Cyan
Push-Location $BackendRoot
try {
    dotnet restore 'TagFusion.sln'
    Assert-LastExitCode 'dotnet restore'

    dotnet publish $BackendProject -c Release -r win-x64 --self-contained true /p:ContinuousIntegrationBuild=true
    Assert-LastExitCode 'dotnet publish'
}
finally {
    Pop-Location
}

if (-not (Test-Path -LiteralPath $Exe)) {
    throw "Publish verification failed: missing $Exe"
}

if (-not (Test-Path -LiteralPath $WwwrootIndex)) {
    throw "Publish verification failed: missing $WwwrootIndex"
}

if ($env:CERT_PFX -and $env:CERT_PASS) {
    Write-Host '3. Signing release executable...' -ForegroundColor Cyan
    & (Join-Path $RootDir 'sign_release.ps1')
    Assert-LastExitCode 'sign_release.ps1'
}
elseif ($RequireSigned) {
    throw 'Code signing required, but CERT_PFX/CERT_PASS are not set.'
}
else {
    Write-Warning 'Release is unsigned. Windows SmartScreen will warn users until a code-signing certificate is used.'
}

$signature = Get-AuthenticodeSignature -LiteralPath $Exe
Write-Host "Signature status: $($signature.Status)" -ForegroundColor Yellow

Write-Host 'Build complete.' -ForegroundColor Green
Write-Host "Executable: $Exe" -ForegroundColor Green
Write-Host "Frontend payload: $WwwrootIndex" -ForegroundColor Green
