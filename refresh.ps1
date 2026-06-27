# Local index refresh: ingest new videos, rebuild index.json, push to git.
# Use this with Windows Task Scheduler for reliable auto-ingest from your home
# IP (datacenter IPs in CI get throttled by YouTube much harder).
#
# Example scheduled task (daily at 7am):
#   schtasks /Create /SC DAILY /TN "DanPenaSearch" /ST 07:00 ^
#     /TR "powershell -ExecutionPolicy Bypass -File \"C:\Projects\Dan Pena\refresh.ps1\""

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# Index the most recent N videos (the channel has ~4,900; this keeps the
# client-side index fast). Raise/remove --limit later to widen coverage.
$LIMIT = 500

Write-Host "==> Ingesting up to $LIMIT recent videos..."
# Use cookies if present (most reliable from this machine; bypasses login throttle).
# Resumable: if YouTube throttles, just run this script again later to continue.
if (Test-Path "cookies.txt") {
    python ingest.py --limit $LIMIT --sleep 3 --cookiefile cookies.txt
} else {
    python ingest.py --limit $LIMIT --sleep 3
}

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
