# Dan Pena Search - one-click data refresh.
# You don't need to run this directly - just double-click "Update Site (double-click).bat".
# It downloads transcripts in batches (kept small and slow so YouTube doesn't
# flag the connection), publishes each batch so the live site
# (https://dan-pena-search.vercel.app) updates right away, rests, and repeats
# until every video on the channel is in. Close the window to stop; the next
# double-click picks up where it left off.

Set-Location -Path $PSScriptRoot

$LIMIT  = 10000 # overall scope: the whole channel (~5,000 videos in Oct 2026)
$PERRUN = 300   # videos to fetch per batch (bounded so we stay under YouTube's radar)
$SLEEP  = 12    # seconds between videos (extra-gentle pacing)
$REST_MINUTES     = 90   # break between batches
$THROTTLE_MINUTES = 240  # first break when YouTube limits us; doubles each time, up to 12 hours
$ERROR_MINUTES    = 30   # break after an unexpected error, before trying again
$MAX_FAILURES     = 5    # unexpected errors in a row before giving up
$TASK = "Dan Pena Search - keep filling"  # optional sign-in task that restarts this
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

# Only one copy at a time, whoever starts it (a double-click or the sign-in task).
$mutex = New-Object System.Threading.Mutex($false, "Local\DanPenaSearchRefresh")
try { $owned = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $owned = $true }
if (-not $owned) {
    Write-Host "The Dan Pena Search update is already running in another window." -ForegroundColor Yellow
    return
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
$failures = 0
$finalPass = $false  # last round: retry videos that came back without captions
while ($true) {
    $batch++
    # picked up fresh each batch, so a newly exported cookies.txt is used without a restart
    $extraArgs = @()
    if (Test-Path "cookies.txt") { $extraArgs += @("--cookiefile", "cookies.txt") }
    if ($finalPass) { $extraArgs += @("--retry-missing") }

    Write-Host ""
    if ($finalPass) {
        Write-Host "Batch ${batch}: one more try for videos that had no captions..."
    } else {
        Write-Host "Batch ${batch}: downloading up to $PERRUN transcripts (gentle pace, about 2 hours)..."
    }
    python ingest.py --limit $LIMIT --max-per-run $PERRUN --sleep $SLEEP @extraArgs
    $result = $LASTEXITCODE
    Write-Log "batch $batch finished (code $result)"

    if ($result -notin @($ALL_DONE, $MORE_LEFT, $THROTTLED, $LIST_FAILED)) {
        $failures++
        if ($failures -ge $MAX_FAILURES) {
            Write-Host ""
            Write-Host "It failed $MAX_FAILURES times in a row - see the messages above. Stopping." -ForegroundColor Red
            Write-Log "stopped after $MAX_FAILURES failures in a row"
            break
        }
        Write-Log "unexpected code $result, failure $failures of $MAX_FAILURES"
        Wait-Minutes $ERROR_MINUTES "Something went wrong (code $result) - see the messages above."
        continue
    }
    $failures = 0

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
        if (-not $finalPass) {
            # a "no captions" result can be a hiccup rather than a video that has none
            $finalPass = $true
            Write-Log "all videos tried; retrying the ones without captions"
            continue
        }
        Write-Host ""
        Write-Host "DONE! Every video on the channel is on the site:" -ForegroundColor Green
        Write-Host "   https://dan-pena-search.vercel.app" -ForegroundColor Green
        Write-Log "all done"
        # the sign-in task, if it was set up, has done its job
        schtasks /Delete /TN $TASK /F *> $null
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
