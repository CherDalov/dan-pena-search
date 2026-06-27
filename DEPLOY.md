# Deploying & keeping it fresh

This project has two halves:

- **`web/`** — the static React site (Vite). This is what gets hosted on Vercel.
- **Python pipeline** (`ingest.py` → `export_index.py`) — builds the data file
  `web/public/index.json` that the site searches. This runs on a schedule, not
  on Vercel.

The site is fully static + client-side search, so hosting is cheap/free and
there is no server to run.

---

## 1. Deploy the site to Vercel

### Option A — GitHub + Vercel (recommended)

Enables automatic redeploys whenever the index is refreshed.

1. Create a GitHub repo and push this project:
   ```bash
   git remote add origin https://github.com/<you>/dan-pena-search.git
   git push -u origin main
   ```
2. In Vercel: **Add New… → Project → Import** the repo.
3. Set **Root Directory = `web`** (important — the app lives in a subfolder).
   Framework preset auto-detects as **Vite**; build `npm run build`, output `dist`.
4. **Deploy.** Done.

### Option B — Vercel CLI (fastest, no GitHub needed)

```bash
cd web
vercel          # first run: log in + link the project
vercel --prod   # deploy to production
```

With this option, re-run `vercel --prod` (or let the local refresh script push
to a connected Git repo) after each index refresh.

---

## 2. Keep the index fresh (auto-ingest)

New uploads only appear after the index is rebuilt. Pick one:

### Option A — Local scheduled task (most reliable)

YouTube throttles datacenter IPs hard, so running from your own machine is the
most dependable. Use the included [`refresh.ps1`](refresh.ps1) with Windows Task
Scheduler:

```bat
schtasks /Create /SC DAILY /TN "DanPenaSearch" /ST 07:00 ^
  /TR "powershell -ExecutionPolicy Bypass -File \"C:\Projects\Dan Pena\refresh.ps1\""
```

It ingests new videos, rebuilds `index.json`, and (if you used Option A above)
pushes to Git so Vercel redeploys.

### Option B — GitHub Action (hands-off)

[`.github/workflows/refresh-index.yml`](.github/workflows/refresh-index.yml)
runs daily and on demand. Because CI uses datacenter IPs, you may need to add a
repo secret to avoid throttling:

- **`YT_COOKIES`** — contents of a Netscape `cookies.txt` exported while logged
  into YouTube (use a browser extension like "Get cookies.txt"). Most effective.
- **`YT_PROXY`** — a residential/rotating proxy URL.

The job is incremental (the DB is cached between runs), so it only fetches the
handful of new videos each day, keeping request volume — and block risk — low.

---

## Notes

- The first full index build should be done **locally** (`python ingest.py`)
  from your home IP, then committed. CI/local refreshes after that are cheap.
- `index.json` is the only generated file that's committed; `search.db` is
  ignored locally and cached in CI.
- If `index.json` ever gets large enough to slow first load, switch the site to
  fetch a gzipped index or move to a hosted search service (Meilisearch/Typesense).
