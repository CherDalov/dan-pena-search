# Dan Pena Search - one-click data refresh.
# You don't need to run this directly - just double-click "Update Site (double-click).bat".
# It downloads a SMALL BATCH of recent transcripts (kept low so YouTube doesn't
# flag the connection), rebuilds the search index, and publishes it so the live
# site (https://dan-pena-search.vercel.app) updates itself.
#
# Each double-click adds another batch. Run it a few times (with gaps) to build
# up to the full 500. The site improves a little after every run.

Set-Location -Path $PSScriptRoot

$LIMIT  = 500   # overall scope: the newest N videos we want to cover
$PERRUN = 75    # videos to fetch THIS run (low, to stay under YouTube's radar)
$SLEEP  = 6     # seconds between videos (gentle pacing)

Write-Host ""
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host "   Dan Pena Search - refreshing the data" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path "cookies.txt")) {
    Write-Host "WARNING: cookies.txt is not in this folder." -ForegroundColor Red
    Write-Host "Re-export it with the 'Get cookies.txt LOCALLY' extension if needed." -ForegroundColor Red
    Write-Host ""
}

Write-Host "Step 1 of 3: Downloading up to $PERRUN transcripts (gentle pace, ~10-15 min)..."
Write-Host "             Low and slow on purpose - so we don't get rate-limited again."
Write-Host ""
if (Test-Path "cookies.txt") {
    python ingest.py --limit $LIMIT --max-per-run $PERRUN --sleep $SLEEP --cookiefile cookies.txt
} else {
    python ingest.py --limit $LIMIT --max-per-run $PERRUN --sleep $SLEEP
}

Write-Host ""
Write-Host "Step 2 of 3: Building the search index..."
python export_index.py
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "No videos indexed yet - YouTube is still rate-limiting this connection." -ForegroundColor Red
    Write-Host "Nothing was changed. Wait a few hours (or until tomorrow) and double-click again." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "Step 3 of 3: Publishing to the live site..."
git add web/public/index.json
$changed = git status --porcelain web/public/index.json
if ($changed) {
    git commit -m "chore: refresh search index" | Out-Null
    git push
    Write-Host ""
    Write-Host "DONE! This batch is live in ~1 minute:" -ForegroundColor Green
    Write-Host "   https://dan-pena-search.vercel.app" -ForegroundColor Green
    Write-Host ""
    Write-Host "Want more videos covered? Just double-click again later (after a break)." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Nothing new this run - you've likely covered the recent batch already." -ForegroundColor Green
}
