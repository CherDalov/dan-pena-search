#!/usr/bin/env bash
# Patient, low-traffic ingest using cookies.
# YouTube's caption-text endpoint is IP-throttled, and every request while
# throttled resets the cooldown. So: rest a long stretch making ZERO requests,
# then attempt a slow cookie-authenticated ingest. Repeat with long gaps.
cd "C:/Projects/Dan Pena" || exit 1
LOG=ingest.log
echo "=== cookie runner start $(date) ===" >> "$LOG"

REST=1500   # 25 min of total silence before each attempt (lets the IP decay)

for i in $(seq 1 5); do
  echo "--- resting ${REST}s before attempt $i $(date) ---" >> "$LOG"
  sleep "$REST"

  echo "--- attempt $i $(date) ---" >> "$LOG"
  python ingest.py --cookiefile cookies.txt --sleep 6 >> "$LOG" 2>&1

  OK=$(python - <<'PY'
import sqlite3
try:
    c = sqlite3.connect("search.db")
    print(c.execute("SELECT COUNT(*) FROM videos WHERE status='ok'").fetchone()[0])
except Exception:
    print(0)
PY
)
  echo "indexed ok=$OK after attempt $i" >> "$LOG"
  if [ "$OK" -ge 30 ]; then
    echo "=== healthy index reached (ok=$OK); building index.json ===" >> "$LOG"
    python export_index.py >> "$LOG" 2>&1
    break
  fi
done
echo "=== cookie runner done $(date) ===" >> "$LOG"
