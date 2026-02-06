
# Build Release Script for TagFusion

$RootDir = Get-Location
$FrontendDir = Join-Path $RootDir "Frontend"
$BackendDir = Join-Path $RootDir "Backend\TagFusion"
$PublishDir = Join-Path $BackendDir "bin\Release\net8.0-windows\win-x64\publish"

Write-Host "1. Building Frontend..." -ForegroundColor Cyan
Set-Location $FrontendDir
npm install
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed!"
    exit 1
}

Write-Host "2. Preparing Backend wwwroot..." -ForegroundColor Cyan
$WwwRootDir = Join-Path $BackendDir "wwwroot"
if (Test-Path $WwwRootDir) {
    Remove-Item $WwwRootDir -Recurse -Force
}
New-Item -ItemType Directory -Path $WwwRootDir -Force | Out-Null
Copy-Item -Path (Join-Path $FrontendDir "dist\*") -Destination $WwwRootDir -Recurse

Write-Host "3. Publishing Backend..." -ForegroundColor Cyan
Set-Location $BackendDir
dotnet publish -c Release -r win-x64 --self-contained
if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend publish failed!"
    exit 1
}

Write-Host "4. Finalizing..." -ForegroundColor Cyan
# Copy wwwroot to the publish directory as well, because single-file doesn't bundle static files by default unless embedded
$PublishWwwRoot = Join-Path $PublishDir "wwwroot"
if (Test-Path $PublishWwwRoot) {
    Remove-Item $PublishWwwRoot -Recurse -Force
}
Copy-Item -Path $WwwRootDir -Destination $PublishWwwRoot -Recurse

Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "Executable is located at: $PublishDir\TagFusion.exe" -ForegroundColor Green
Write-Host "Make sure the 'wwwroot' folder is next to the .exe when moving it." -ForegroundColor Yellow
