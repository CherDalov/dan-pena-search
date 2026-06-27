#!/usr/bin/env bash
# Patient background ingest: waits out YouTube's throttle, then makes repeated
# polite, resumable passes until the (capped) index is populated.
cd "C:/Projects/Dan Pena" || exit 1
LOG=ingest.log
echo "=== runner start $(date) ===" >> "$LOG"

# initial cooldown so YouTube's throttle has time to lift
sleep 300

for i in $(seq 1 8); do
  echo "--- pass $i $(date) ---" >> "$LOG"
  python ingest.py --limit 60 --sleep 4 >> "$LOG" 2>&1
  # stop early once we have a healthy index
  OK=$(python - <<'PY'
import sqlite3
try:
    c=sqlite3.connect("search.db")
    print(c.execute("SELECT COUNT(*) FROM videos WHERE status='ok'").fetchone()[0])
except Exception:
    print(0)
PY
)
  echo "indexed ok=$OK after pass $i" >> "$LOG"
  if [ "$OK" -ge 40 ]; then
    echo "=== target reached (ok=$OK) ===" >> "$LOG"
    break
  fi
  sleep 240
done
echo "=== runner done $(date) ===" >> "$LOG"
