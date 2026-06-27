# Dan Peña Search

A transcript search engine for the [Dan Peña YouTube channel](https://www.youtube.com/@trilliondollarman),
modeled on [hexsearch.io](https://hexsearch.io/). Type a word or phrase and jump
straight to the exact moment in a video where Dan said it.

**Live:** https://dan-pena-search.vercel.app

## How it works

```
yt-dlp + captions  ──►  ingest.py  ──►  search.db (SQLite FTS5)
                                              │
                                       export_index.py
                                              │
                                              ▼
                                  web/public/index.json
                                              │
                                  web/ (Vite + React)  ──►  Vercel (static)
                                  instant client-side search (MiniSearch)
```

- **`ingest.py`** lists the channel and pulls each video's timestamped YouTube
  caption track into a SQLite FTS5 index. Resumable and throttle-aware.
- **`export_index.py`** flattens the index into `web/public/index.json`.
- **`web/`** is a Vite + React + Tailwind site that loads that JSON and searches
  it entirely in the browser — exact-phrase and all-words modes, highlighted
  quotes, timestamps, and inline playback from the matched second.
- Hosted on **Vercel**; pushing a new `index.json` to GitHub auto-redeploys.

The channel has ~4,900 videos, so by default we index the **most recent 500**
(`--limit 500`) to keep the client-side index fast. Raise it later, or move to a
hosted search backend (Meilisearch/Typesense) for the full catalog.

## Quickstart — the website (local dev)

```bash
cd web
npm install
npm run dev      # http://localhost:5173
```

## Populate / refresh the real data

YouTube throttles caption requests by IP, and datacenter IPs (CI) are blocked
hard — so run this **locally**, with cookies, from your normal connection.

1. Export your YouTube cookies to `cookies.txt` in this folder (use the
   "Get cookies.txt LOCALLY" browser extension while logged in). It's gitignored.
2. Run the refresh (indexes recent 500, rebuilds the index, pushes → auto-deploy):
   ```powershell
   ./refresh.ps1
   ```
   It's **resumable** — if YouTube throttles mid-run, just run it again later and
   it continues where it left off, then commits `web/public/index.json` so Vercel
   redeploys with the new data.

See [DEPLOY.md](DEPLOY.md) for hosting, scheduling, and the GitHub Action.

## Files

| Path | Purpose |
|------|---------|
| `ingest.py` | scrape channel + fetch captions → SQLite FTS5 (`--limit`, `--cookiefile`, `--proxy`) |
| `export_index.py` | build `web/public/index.json` from the DB |
| `refresh.ps1` | one-shot local refresh: ingest → export → commit/push |
| `web/` | the React search site (deployed to Vercel) |
| `vercel.json` | root build config (builds `web/` from repo root) |
| `app.py` | optional local Flask UI over the same SQLite index |
| `.github/workflows/refresh-index.yml` | manual GitHub Action to refresh in CI |

Unofficial, fan-built. All playback links out to YouTube.
