# ── EleNin CCG → itch.io build script ─────────────────────────
# Run:  .\build-itchio.ps1
# Output: EleNinCCG.zip ready to upload to itch.io (HTML5 project)

$projectDir = $PSScriptRoot
$outZip     = Join-Path $projectDir "EleNinCCG.zip"

# Remove old build
if (Test-Path $outZip) { Remove-Item $outZip -Force }

# Files and folders to include (everything the game needs)
$include = @(
    "index.html",
    "css",
    "js"
)

# Create a temp staging folder
$staging = Join-Path $env:TEMP "EleNinCCG_build_$(Get-Random)"
New-Item -ItemType Directory -Path $staging -Force | Out-Null

foreach ($item in $include) {
    $src = Join-Path $projectDir $item
    $dst = Join-Path $staging $item
    if (Test-Path $src -PathType Container) {
        Copy-Item $src $dst -Recurse -Force
    } else {
        Copy-Item $src $dst -Force
    }
}

# Create zip (index.html must be at zip root for itch.io)
Compress-Archive -Path "$staging\*" -DestinationPath $outZip -Force

# Cleanup staging
Remove-Item $staging -Recurse -Force

Write-Host ""
Write-Host "Build complete: $outZip" -ForegroundColor Green
Write-Host ""
Write-Host "Upload instructions:" -ForegroundColor Cyan
Write-Host "  1. Go to https://itch.io/game/new"
Write-Host "  2. Set 'Kind of project' to HTML"
Write-Host "  3. Upload EleNinCCG.zip"
Write-Host "  4. Check 'This file will be played in the browser'"
Write-Host "  5. Set viewport: 800 x 600 (or your preferred size)"
Write-Host "  6. Enable 'SharedArrayBuffer support' if needed"
Write-Host "  7. Save & publish!"
