"""
Ingest pipeline for the Dan Pena transcript search engine.

1. Lists every video on the channel with yt-dlp (no API key needed).
2. Pulls the YouTube caption track for each video via yt-dlp's network layer
   (free, already timestamped, and far more block-resistant than scraping
   timedtext directly -- especially with browser cookies).
3. Chunks the transcript into readable, timestamped segments.
4. Stores everything in a SQLite FTS5 full-text index.

Resumable. Videos already indexed are skipped. A genuine "no captions" is
recorded as such; a transient 429 / IP throttle is NOT -- the loop backs off
and, if still blocked, stops so you can simply re-run later to continue.

Usage:
    python ingest.py                              # ingest the whole channel
    python ingest.py --limit 20                   # only the 20 most recent
    python ingest.py --cookies-from-browser chrome  # auth via your browser (best anti-block)
    python ingest.py --sleep 3                     # seconds between videos (politeness)
    python ingest.py --retry-missing              # retry videos previously found captionless
"""

import argparse
import random
import sqlite3
import sys
import time

import yt_dlp

CHANNEL_URL = "https://www.youtube.com/@trilliondollarman/videos"
DB_PATH = "search.db"

# Chunking targets: flush a segment once it reaches either limit.
MAX_CHARS = 280
MAX_SECONDS = 30

# Preference order for caption languages.
LANG_CANDIDATES = ["en", "en-US", "en-orig", "en-GB", "a.en"]

# Backoff when throttled: a single gentle retry, then stop. We deliberately
# avoid a burst of rapid retries so we don't dig the IP deeper into a block.
BACKOFF = [60]


class Throttled(Exception):
    """Transient block (HTTP 429 / IP throttle). Retry later, do NOT mark missing."""


class NoCaptions(Exception):
    """Video genuinely has no usable caption track."""


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS videos (
            id          TEXT PRIMARY KEY,
            title       TEXT,
            url         TEXT,
            status      TEXT,           -- ok | no_transcript
            n_segments  INTEGER DEFAULT 0,
            ingested_at REAL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS segments USING fts5(
            video_id UNINDEXED,
            start    UNINDEXED,         -- seconds (float) into the video
            text,
            tokenize = 'porter unicode61'
        );
        """
    )
    conn.commit()


def make_ydl(args, flat: bool) -> yt_dlp.YoutubeDL:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "ignoreerrors": True,
        "extractor_retries": 1,
        # we only want captions, never video formats; don't fail when a
        # logged-in (cookie) session reports no downloadable format.
        "ignore_no_formats_error": True,
    }
    if flat:
        opts["extract_flat"] = True
    if args.cookies_from_browser:
        opts["cookiesfrombrowser"] = (args.cookies_from_browser,)
    if args.cookiefile:
        opts["cookiefile"] = args.cookiefile
    if args.proxy:
        opts["proxy"] = args.proxy
    return yt_dlp.YoutubeDL(opts)


def is_throttle(exc: Exception) -> bool:
    s = str(exc).lower()
    return any(
        k in s
        for k in ("429", "too many requests", "sign in to confirm", "rate")
    )


def list_channel_videos(ydl: yt_dlp.YoutubeDL, limit: int | None) -> list[dict]:
    if limit:
        ydl.params["playlistend"] = limit
    info = ydl.extract_info(CHANNEL_URL, download=False)
    entries = (info or {}).get("entries") or []
    out = []
    for e in entries:
        if e and e.get("id"):
            out.append(
                {
                    "id": e["id"],
                    "title": e.get("title") or "(untitled)",
                    "url": e.get("url") or f"https://www.youtube.com/watch?v={e['id']}",
                }
            )
    return out


def pick_caption_url(info: dict) -> str | None:
    """Find the best en json3 caption URL: prefer manual subs, then auto-captions."""
    for source in (info.get("subtitles") or {}, info.get("automatic_captions") or {}):
        for lang in LANG_CANDIDATES:
            for fmt in source.get(lang, []):
                if fmt.get("ext") == "json3" and fmt.get("url"):
                    return fmt["url"]
    return None


def fetch_segments(ydl: yt_dlp.YoutubeDL, vid: str) -> list[tuple[float, str]]:
    """Return [(start_seconds, text)] snippets, or raise NoCaptions / Throttled."""
    url = f"https://www.youtube.com/watch?v={vid}"
    try:
        info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        if is_throttle(e):
            raise Throttled(str(e)) from e
        raise NoCaptions(str(e)) from e
    if not info:
        raise NoCaptions("no info")

    cap_url = pick_caption_url(info)
    if not cap_url:
        raise NoCaptions("no en caption track")

    try:
        raw = ydl.urlopen(cap_url).read()
    except Exception as e:  # noqa: BLE001 - yt-dlp raises several network types
        if is_throttle(e):
            raise Throttled(str(e)) from e
        raise NoCaptions(str(e)) from e

    import json

    data = json.loads(raw.decode("utf-8", "replace"))
    snippets: list[tuple[float, str]] = []
    for ev in data.get("events", []):
        segs = ev.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).replace("\n", " ").strip()
        if text:
            snippets.append((ev.get("tStartMs", 0) / 1000.0, text))
    if not snippets:
        raise NoCaptions("empty caption track")
    return snippets


def chunk(snippets: list[tuple[float, str]]) -> list[tuple[float, str]]:
    """Group consecutive caption lines into readable, timestamped chunks."""
    chunks: list[tuple[float, str]] = []
    buf: list[str] = []
    chunk_start: float | None = None

    def flush():
        nonlocal buf, chunk_start
        if buf and chunk_start is not None:
            text = " ".join(" ".join(buf).split())
            if text:
                chunks.append((chunk_start, text))
        buf = []
        chunk_start = None

    for start, text in snippets:
        if chunk_start is None:
            chunk_start = start
        buf.append(text)
        if sum(len(x) for x in buf) >= MAX_CHARS or (start - chunk_start) >= MAX_SECONDS:
            flush()
    flush()
    return chunks


def store_ok(conn, v, chunks):
    conn.execute("DELETE FROM segments WHERE video_id = ?", (v["id"],))
    conn.executemany(
        "INSERT INTO segments (video_id, start, text) VALUES (?, ?, ?)",
        [(v["id"], s, t) for s, t in chunks],
    )
    conn.execute(
        "INSERT OR REPLACE INTO videos (id, title, url, status, n_segments, ingested_at)"
        " VALUES (?, ?, ?, 'ok', ?, ?)",
        (v["id"], v["title"], v["url"], len(chunks), time.time()),
    )
    conn.commit()


def store_missing(conn, v):
    conn.execute(
        "INSERT OR REPLACE INTO videos (id, title, url, status, n_segments, ingested_at)"
        " VALUES (?, ?, ?, 'no_transcript', 0, ?)",
        (v["id"], v["title"], v["url"], time.time()),
    )
    conn.commit()


def ingest(args) -> None:
    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    print(f"Listing videos from {CHANNEL_URL} ...")
    lister = make_ydl(args, flat=True)
    videos = list_channel_videos(lister, args.limit)
    print(f"Found {len(videos)} videos.\n")

    done = {r[0] for r in conn.execute("SELECT id FROM videos WHERE status='ok'")}
    skip_missing = set()
    if not args.retry_missing:
        skip_missing = {
            r[0] for r in conn.execute("SELECT id FROM videos WHERE status='no_transcript'")
        }

    ydl = make_ydl(args, flat=False)
    new_ok = new_missing = processed = 0
    pending = [v for v in videos if v["id"] not in done and v["id"] not in skip_missing]
    print(f"{len(pending)} videos to process "
          f"({len(done)} already indexed).\n")

    for i, v in enumerate(pending, 1):
        label = v["title"][:55]
        # polite throttle between videos
        if i > 1:
            time.sleep(args.sleep + random.uniform(0, args.sleep))

        segments = None
        for attempt in range(len(BACKOFF) + 1):
            try:
                segments = fetch_segments(ydl, v["id"])
                break
            except Throttled:
                if attempt < len(BACKOFF):
                    wait = BACKOFF[attempt]
                    print(f"   ...throttled, backing off {wait}s")
                    time.sleep(wait)
                else:
                    segments = "THROTTLED"
            except NoCaptions:
                segments = None
                break

        if segments == "THROTTLED":
            print(
                f"\nStill throttled by YouTube after backoff. Stopping cleanly.\n"
                f"Progress is saved -- re-run later to continue"
                + (" " if args.cookies_from_browser else
                   ", ideally with --cookies-from-browser chrome to reduce blocks")
                + "."
            )
            break

        if segments:
            chunks = chunk(segments)
            store_ok(conn, v, chunks)
            new_ok += 1
            print(f"[{i}/{len(pending)}] OK  {len(chunks):4d} segs  {label}")
        else:
            store_missing(conn, v)
            new_missing += 1
            print(f"[{i}/{len(pending)}] --  no captions  {label}")

        processed += 1
        if args.max_per_run and processed >= args.max_per_run:
            print(
                f"\nReached this run's cap of {args.max_per_run} videos "
                f"(keeping request volume low). Run again later to continue."
            )
            break

    total_ok = conn.execute("SELECT COUNT(*) FROM videos WHERE status='ok'").fetchone()[0]
    total_segs = conn.execute("SELECT COUNT(*) FROM segments").fetchone()[0]
    print(
        f"\nThis run: +{new_ok} indexed, +{new_missing} without captions.\n"
        f"Index now holds {total_ok} videos / {total_segs} searchable segments."
    )
    conn.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Ingest Dan Pena videos into the search index.")
    p.add_argument("--limit", type=int, default=None, help="only the N most recent videos")
    p.add_argument("--sleep", type=float, default=2.0, help="base seconds between videos")
    p.add_argument("--max-per-run", type=int, default=None,
                   help="stop after processing N videos in one run (keeps request volume low)")
    p.add_argument("--cookies-from-browser", default=None,
                   help="browser to read YouTube cookies from, e.g. chrome / edge / firefox")
    p.add_argument("--cookiefile", default=None,
                   help="path to a Netscape cookies.txt file (best for CI / servers)")
    p.add_argument("--proxy", default=None,
                   help="proxy URL, e.g. http://user:pass@host:port (helps from blocked IPs)")
    p.add_argument("--retry-missing", action="store_true", help="retry videos with no captions")
    args = p.parse_args()
    try:
        ingest(args)
    except KeyboardInterrupt:
        print("\nInterrupted; progress saved.", file=sys.stderr)
