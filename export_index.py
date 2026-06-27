"""
Export the SQLite FTS index into a compact JSON file the website loads and
searches entirely in the browser (no backend needed).

    python export_index.py

Writes web/public/index.json with shape:
    {
      "channel": "Dan Pena",
      "generated": "<iso8601>",
      "videos":   [ {"id": "<ytid>", "title": "..."} , ... ],
      "segments": [ {"v": <videoIndex>, "t": <startSeconds>, "x": "<text>"}, ... ]
    }
"""

import json
import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = "search.db"
OUT_PATH = os.path.join("web", "public", "index.json")


def main() -> None:
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"{DB_PATH} not found. Run ingest.py first.")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    vids = conn.execute(
        "SELECT id, title FROM videos WHERE status='ok' ORDER BY ingested_at"
    ).fetchall()
    index_of = {v["id"]: i for i, v in enumerate(vids)}
    videos = [{"id": v["id"], "title": v["title"]} for v in vids]

    if not videos:
        print(
            "No indexed videos yet (none with status='ok'). "
            "Skipping export so existing index.json is NOT overwritten with empty data."
        )
        raise SystemExit(2)

    segments = []
    for row in conn.execute("SELECT video_id, start, text FROM segments"):
        vid = row["video_id"]
        if vid in index_of:
            segments.append(
                {"v": index_of[vid], "t": round(row["start"], 1), "x": row["text"]}
            )
    conn.close()

    payload = {
        "channel": "Dan Peña",
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "videos": videos,
        "segments": segments,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    size_mb = os.path.getsize(OUT_PATH) / 1e6
    print(
        f"Wrote {OUT_PATH}: {len(videos)} videos, {len(segments)} segments, "
        f"{size_mb:.2f} MB"
    )


if __name__ == "__main__":
    main()
