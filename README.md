# Dan Peña Search

A transcript search engine for the [Dan Peña YouTube channel](https://www.youtube.com/@trilliondollarman),
modeled on [hexsearch.io](https://hexsearch.io/). Type a word or phrase and jump
straight to the exact moment in a video where Dan said it.

It works by pulling each video's YouTube caption track (which is already
timestamped), chunking it into readable segments, and indexing those in a SQLite
FTS5 full-text index. The web UI searches that index and deep-links into YouTube
at the right second.

## Setup

```bash
pip install -r requirements.txt
```

## 1. Build the index

```bash
python ingest.py
```

This lists every video on the channel and pulls captions for each one. It's
**resumable** — if it stops (e.g. YouTube throttles the IP), just run it again
and it continues where it left off. New uploads are picked up on re-runs too.

Useful flags:

| Flag | What it does |
|------|--------------|
| `--limit N` | only the N most recent videos (good for a quick test) |
| `--sleep N` | base seconds to wait between videos (politeness; default 2) |
| `--cookies-from-browser chrome` | authenticate with your browser's YouTube cookies — **the most effective way to avoid throttling**. The browser must be **fully closed** first (Windows locks the cookie database while it's open). Works with `chrome`, `edge`, `firefox`, `brave`. |
| `--retry-missing` | re-check videos previously found to have no captions |

### If you get throttled (HTTP 429 / "IpBlocked")

YouTube rate-limits anonymous caption requests. Two fixes:

1. **Use cookies** (recommended): fully close Chrome, then
   `python ingest.py --cookies-from-browser chrome`.
2. **Wait and resume**: the throttle is temporary. Wait ~30–60 min and re-run
   `python ingest.py` (optionally with a larger `--sleep 5`). Progress is saved.

## 2. Run the search site

```bash
python app.py
```

Open http://127.0.0.1:5000

- **Exact phrase** (default): finds where a phrase was said verbatim.
- **All words**: matches videos containing every word, in any order.
- Each result shows the quote with the match highlighted, a timestamp, an inline
  play button (plays from that second), and an "open on YouTube" link.

## Files

| File | Purpose |
|------|---------|
| `ingest.py` | scrape channel + fetch captions + build the SQLite FTS5 index |
| `app.py` | Flask search UI |
| `search.db` | the generated index (created by `ingest.py`) |

## Notes & next steps

- **Captions only** for now. A handful of videos may have no caption track (e.g.
  brand-new premieres). To cover those, transcribe their audio with Whisper /
  `faster-whisper` and insert the segments the same way `ingest.py` does.
- **Keeping it fresh**: schedule `python ingest.py` (e.g. daily) to index new
  uploads automatically.
- **Going production**: swap SQLite FTS5 for Meilisearch/Typesense for instant,
  typo-tolerant search-as-you-type, add paging, and deploy behind a small host.
- Unofficial, fan-built. All playback links out to YouTube.
