$ErrorActionPreference = "Stop"

$sourceRoot = "C:\Users\PC\Documents\4th Year Project"
$stagingRoot = "$env:TEMP\DQ_Zip_Staging"
$stagingDir = "$stagingRoot\4th Year Project"
$zipOutput = "C:\Users\PC\Desktop\Detective_Query_Project.zip"

Write-Host "1. Resetting staging directory..."
if (Test-Path $stagingRoot) {
    Remove-Item -Recurse -Force $stagingRoot -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

Write-Host "2. Copying source files..."
$robocopyArgs = @(
    "$sourceRoot",
    "$stagingDir",
    "/E",
    "/XD", "node_modules", ".git", "dist", "build", ".gradle", "intermediates", ".idea", "__pycache__", ".system_generated", ".tempmediaStorage",
    "/XF", "*.zip", "*.7z", "*.tar", "*.gz",
    "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"
)
& robocopy.exe @robocopyArgs
# Robocopy exit code < 8 is success
if ($LASTEXITCODE -ge 8) {
    throw "Robocopy failed with exit code $LASTEXITCODE"
}

# Explicitly purge any nested android build / cache folders that robocopy might have touched
Write-Host "3. Cleaning nested cache / build folders..."
Get-ChildItem -Path $stagingDir -Recurse -Directory | Where-Object { 
    $_.Name -in @('build', '.gradle', 'intermediates', 'desugar_graph', 'dexBuilderDebug', 'transforms', 'node_modules', '.git') 
} | ForEach-Object {
    Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
}

Write-Host "4. Creating standard Windows ZIP file..."
if (Test-Path $zipOutput) {
    Remove-Item -Force $zipOutput
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stagingRoot, $zipOutput)

Write-Host "5. Cleaning up staging..."
Remove-Item -Recurse -Force $stagingRoot -ErrorAction SilentlyContinue

Write-Host "6. Verifying zip file..."
$zipFile = Get-Item $zipOutput
Write-Host "=========================================="
Write-Host "ZIP SUCCESS!"
Write-Host "File: $($zipFile.FullName)"
Write-Host "Size: $([math]::Round($zipFile.Length / 1MB, 2)) MB"

$archive = [System.IO.Compression.ZipFile]::OpenRead($zipOutput)
Write-Host "Total files inside zip: $($archive.Entries.Count)"
Write-Host "Sample files inside:"
$archive.Entries | Select-Object -First 10 | ForEach-Object { Write-Host "  $($_.FullName)" }
$archive.Dispose()
Write-Host "=========================================="
