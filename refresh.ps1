# Dan Pena Search - one-click data refresh.
# You don't need to run this directly - just double-click "Update Site (double-click).bat".
# It downloads transcripts in batches (kept small and slow so YouTube doesn't
# flag the connection), publishes each batch so the live site
# (https://dan-pena-search.vercel.app) updates right away, rests, and repeats
# until every video on the channel is in. Close the window to stop; the next
# double-click picks up where it left off.

Set-Location -Path $PSScriptRoot

$LIMIT  = 10000 # overall scope: the whole channel (~5,400 videos in Oct 2026)
$PERRUN = 300   # videos to fetch per batch (bounded so we stay under YouTube's radar)
$SLEEP  = 12    # seconds between videos (extra-gentle pacing)
$REST_MINUTES     = 90   # break between batches
$THROTTLE_MINUTES = 240  # first break when YouTube limits us; doubles each time, up to 12 hours
$LOG = Join-Path $PSScriptRoot "refresh.log"

# ingest.py exit codes
$ALL_DONE = 0; $MORE_LEFT = 2; $THROTTLED = 3; $LIST_FAILED = 4

function Write-Log([string]$Message) {
    Add-Content -Path $LOG -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  $Message"
}

function Wait-Minutes([int]$Minutes, [string]$Why) {
    $until = (Get-Date).AddMinutes($Minutes)
    Write-Host ""
    Write-Host "$Why Resting until $($until.ToString('ddd h:mm tt')), then continuing on its own." -ForegroundColor Cyan
    Write-Host "Leave this window open. Closing it stops the update; double-click again to resume."
    Start-Sleep -Seconds ($Minutes * 60)
}

# Keep the PC from going to sleep while this window is open (released when it closes).
try {
    Add-Type -Namespace DanPenaSearch -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
    [DanPenaSearch.Power]::SetThreadExecutionState([uint32]2147483649) | Out-Null  # ES_CONTINUOUS | ES_SYSTEM_REQUIRED
} catch {
    Write-Host "(Could not keep the PC awake - set Sleep to Never while this runs.)"
}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Yellow
Write-Host "   Dan Pena Search - adding videos to the site" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Yellow
Write-Log "started"

$batch = 0
$throttleWait = $THROTTLE_MINUTES
while ($true) {
    $batch++
    # picked up fresh each batch, so a newly exported cookies.txt is used without a restart
    $cookieArgs = @()
    if (Test-Path "cookies.txt") { $cookieArgs = @("--cookiefile", "cookies.txt") }

    Write-Host ""
    Write-Host "Batch ${batch}: downloading up to $PERRUN transcripts (gentle pace, about 2 hours)..."
    python ingest.py --limit $LIMIT --max-per-run $PERRUN --sleep $SLEEP @cookieArgs
    $result = $LASTEXITCODE
    Write-Log "batch $batch finished (code $result)"

    if ($result -notin @($ALL_DONE, $MORE_LEFT, $THROTTLED, $LIST_FAILED)) {
        Write-Host ""
        Write-Host "Something went wrong (code $result) - see the messages above. Stopping." -ForegroundColor Red
        Write-Log "stopped: unexpected code $result"
        break
    }

    # publish whatever this batch added, even if YouTube cut it short
    Write-Host ""
    Write-Host "Publishing to the live site..."
    python export_index.py
    if ($LASTEXITCODE -eq 0) {
        if (-not (Test-Path "node_modules")) {
            Write-Host "First-time setup: installing helper..."
            npm install | Out-Null
        }
        node scripts/load_turso.mjs
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Publishing failed - see the messages above. It will be retried after the next batch." -ForegroundColor Red
            Write-Log "publish failed"
        }
    }

    if ($result -eq $ALL_DONE) {
        Write-Host ""
        Write-Host "DONE! Every video on the channel is on the site:" -ForegroundColor Green
        Write-Host "   https://dan-pena-search.vercel.app" -ForegroundColor Green
        Write-Log "all done"
        break
    }
    if ($result -eq $MORE_LEFT) {
        $throttleWait = $THROTTLE_MINUTES
        Wait-Minutes $REST_MINUTES "Batch $batch is live."
    } else {
        Wait-Minutes $throttleWait "YouTube is limiting this connection for now."
        $throttleWait = [Math]::Min($throttleWait * 2, 720)
    }
}
