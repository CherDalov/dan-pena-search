# Local index refresh: ingest new videos, rebuild index.json, push to git.
# Use this with Windows Task Scheduler for reliable auto-ingest from your home
# IP (datacenter IPs in CI get throttled by YouTube much harder).
#
# Example scheduled task (daily at 7am):
#   schtasks /Create /SC DAILY /TN "DanPenaSearch" /ST 07:00 ^
#     /TR "powershell -ExecutionPolicy Bypass -File \"C:\Projects\Dan Pena\refresh.ps1\""

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "==> Ingesting new videos..."
python ingest.py --sleep 3

Write-Host "==> Exporting index.json..."
python export_index.py

Write-Host "==> Committing if changed..."
git add web/public/index.json
$changed = git status --porcelain web/public/index.json
if ($changed) {
    git commit -m "chore: refresh search index"
    git push
    Write-Host "Index updated and pushed (Vercel will redeploy)."
} else {
    Write-Host "No index changes."
}
