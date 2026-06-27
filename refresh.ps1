# Dan Pena Search - one-click data refresh.
# You don't need to run this directly - just double-click "Update Site (double-click).bat".
# It downloads recent transcripts, rebuilds the search index, and publishes it so
# the live site (https://dan-pena-search.vercel.app) updates itself.

Set-Location -Path $PSScriptRoot

$LIMIT = 500   # how many recent videos to index

Write-Host ""
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host "   Dan Pena Search - refreshing the data" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path "cookies.txt")) {
    Write-Host "WARNING: cookies.txt is not in this folder." -ForegroundColor Red
    Write-Host "Without it YouTube will almost certainly block the requests." -ForegroundColor Red
    Write-Host "Re-export it with the 'Get cookies.txt LOCALLY' extension if needed." -ForegroundColor Red
    Write-Host ""
}

Write-Host "Step 1 of 3: Downloading transcripts for up to $LIMIT recent videos..."
Write-Host "             (This can take 30-60 minutes. You can minimise this window.)"
Write-Host ""
if (Test-Path "cookies.txt") {
    python ingest.py --limit $LIMIT --sleep 3 --cookiefile cookies.txt
} else {
    python ingest.py --limit $LIMIT --sleep 3
}

Write-Host ""
Write-Host "Step 2 of 3: Building the search index..."
python export_index.py
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "No videos were indexed - YouTube is probably still rate-limiting this connection." -ForegroundColor Red
    Write-Host "Nothing was changed. Wait a few hours (or until tomorrow) and double-click again -" -ForegroundColor Red
    Write-Host "it resumes from where it stopped." -ForegroundColor Red
    return
}

Write-Host ""
Write-Host "Step 3 of 3: Publishing to the live site..."
git add web/public/index.json
$changed = git status --porcelain web/public/index.json
if ($changed) {
    git commit -m "chore: refresh search index"
    git push
    Write-Host ""
    Write-Host "DONE! Pushed. The live site updates in about a minute:" -ForegroundColor Green
    Write-Host "   https://dan-pena-search.vercel.app" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Already up to date - nothing new to publish." -ForegroundColor Green
}
