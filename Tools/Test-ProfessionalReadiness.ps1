<#
.SYNOPSIS
Creates or scans a large image test dataset and writes a performance report.

.EXAMPLE
.\Tools\Test-ProfessionalReadiness.ps1 -DatasetPath "\\ugreen-nas\share\TagFusionTest" -CreateSynthetic -Count 10000

.EXAMPLE
.\Tools\Test-ProfessionalReadiness.ps1 -DatasetPath ".tmp\synthetic-images" -CreateSynthetic -Count 1000 -ExifSampleCount 25
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DatasetPath,

    [ValidateRange(1, 1000000)]
    [int]$Count = 10000,

    [ValidateRange(1, 10000)]
    [int]$Subfolders = 20,

    [switch]$CreateSynthetic,

    [ValidateRange(0, 10000)]
    [int]$ExifSampleCount = 100,

    [string]$ReportPath
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path

if (-not $ReportPath) {
    $reportDir = Join-Path $repoRoot '.tmp\professional-readiness'
    $ReportPath = Join-Path $reportDir ("performance-{0:yyyyMMdd-HHmmss}.json" -f (Get-Date))
}

$resolvedDatasetPath = if (Test-Path -LiteralPath $DatasetPath) {
    (Resolve-Path -LiteralPath $DatasetPath).Path
}
else {
    $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($DatasetPath)
}

if (-not (Test-Path -LiteralPath $resolvedDatasetPath)) {
    if (-not $CreateSynthetic) {
        throw "Dataset path does not exist: $resolvedDatasetPath. Pass -CreateSynthetic to create it."
    }

    [void][System.IO.Directory]::CreateDirectory($resolvedDatasetPath)
}

$supportedExtensions = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
@('.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp', '.webp', '.gif') | ForEach-Object {
    [void]$supportedExtensions.Add($_)
}

$createdFiles = 0
$createElapsedMs = 0L

if ($CreateSynthetic) {
    $pngBytes = [Convert]::FromBase64String(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
    )

    $createTimer = [System.Diagnostics.Stopwatch]::StartNew()
    for ($i = 1; $i -le $Count; $i++) {
        $bucket = (($i - 1) % $Subfolders) + 1
        $folder = Join-Path $resolvedDatasetPath ("set_{0:D3}" -f $bucket)
        [void][System.IO.Directory]::CreateDirectory($folder)

        $name = switch ($i % 8) {
            0 { "image ${i} with spaces.png" }
            1 { "image-${i}-uppercase.PNG" }
            2 { "image-${i}-hyphen-name.png" }
            3 { "image_${i}_underscore_name.png" }
            4 { "image.${i}.dotted.name.png" }
            5 { "image-${i}-long-name-for-listing-and-sorting-tests.png" }
            6 { "IMAGE-${i}-case-test.png" }
            default { "image-${i}.png" }
        }

        $filePath = Join-Path $folder $name
        [System.IO.File]::WriteAllBytes($filePath, $pngBytes)
        $createdFiles++

        if (($i % 1000) -eq 0) {
            Write-Progress -Activity 'Creating synthetic dataset' -Status "$i / $Count" -PercentComplete (($i / $Count) * 100)
        }
    }

    Write-Progress -Activity 'Creating synthetic dataset' -Completed
    $createTimer.Stop()
    $createElapsedMs = $createTimer.ElapsedMilliseconds
}

$enumerationTimer = [System.Diagnostics.Stopwatch]::StartNew()
$files = @([System.IO.Directory]::EnumerateFiles(
    $resolvedDatasetPath,
    '*',
    [System.IO.SearchOption]::AllDirectories
) | Where-Object {
    $supportedExtensions.Contains([System.IO.Path]::GetExtension($_))
})
$enumerationTimer.Stop()

$extensionSummary = $files |
    Group-Object { [System.IO.Path]::GetExtension($_).ToLowerInvariant() } |
    Sort-Object Count -Descending |
    ForEach-Object {
        [ordered]@{
            extension = $_.Name
            count = $_.Count
        }
    }

$exifTool = Join-Path $repoRoot 'Tools\exiftool.exe'
$exifReport = [ordered]@{
    available = Test-Path -LiteralPath $exifTool
    sampleRequested = $ExifSampleCount
    sampleRead = 0
    elapsedMs = $null
    exitCode = $null
    skippedReason = $null
}

if (-not $exifReport.available) {
    $exifReport.skippedReason = 'Tools\exiftool.exe not found'
}
elseif ($ExifSampleCount -eq 0) {
    $exifReport.skippedReason = 'ExifSampleCount is 0'
}
elseif ($files.Count -eq 0) {
    $exifReport.skippedReason = 'No supported image files found'
}
else {
    $sample = $files | Select-Object -First ([Math]::Min($ExifSampleCount, $files.Count))
    $argFile = Join-Path ([System.IO.Path]::GetTempPath()) ("tagfusion-exiftool-{0:N}.args" -f [Guid]::NewGuid())
    $argLines = @('-j', '-Keywords', '-XMP:Subject', '-XMP:Rating') + $sample

    try {
        Set-Content -LiteralPath $argFile -Value $argLines -Encoding UTF8
        $exifTimer = [System.Diagnostics.Stopwatch]::StartNew()
        $null = & $exifTool -@ $argFile 2>&1
        $exifTimer.Stop()

        $exifReport.sampleRead = $sample.Count
        $exifReport.elapsedMs = $exifTimer.ElapsedMilliseconds
        $exifReport.exitCode = $LASTEXITCODE
    }
    finally {
        if (Test-Path -LiteralPath $argFile) {
            Remove-Item -LiteralPath $argFile -Force
        }
    }
}

$enumerationFilesPerSecond = if ($enumerationTimer.Elapsed.TotalSeconds -gt 0) {
    [Math]::Round($files.Count / $enumerationTimer.Elapsed.TotalSeconds, 2)
}
else {
    $files.Count
}

$report = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    datasetPath = $resolvedDatasetPath
    createdSynthetic = [bool]$CreateSynthetic
    createdFiles = $createdFiles
    createElapsedMs = $createElapsedMs
    filesFound = $files.Count
    enumerationElapsedMs = $enumerationTimer.ElapsedMilliseconds
    enumerationFilesPerSecond = $enumerationFilesPerSecond
    extensions = $extensionSummary
    exifTool = $exifReport
}

$reportDirectory = Split-Path -Parent $ReportPath
if ($reportDirectory) {
    [void][System.IO.Directory]::CreateDirectory($reportDirectory)
}

$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $ReportPath -Encoding UTF8

Write-Host "Dataset: $resolvedDatasetPath"
Write-Host "Files found: $($files.Count)"
Write-Host "Enumeration: $($enumerationTimer.ElapsedMilliseconds) ms ($enumerationFilesPerSecond files/s)"
if ($exifReport.elapsedMs -ne $null) {
    Write-Host "ExifTool sample: $($exifReport.sampleRead) files in $($exifReport.elapsedMs) ms (exit $($exifReport.exitCode))"
}
else {
    Write-Host "ExifTool sample skipped: $($exifReport.skippedReason)"
}
Write-Host "Report: $ReportPath"
