"""
Search UI for the Dan Pena transcript index.

Run the ingest first (python ingest.py), then:
    python app.py
and open http://127.0.0.1:5000
"""

import html
import sqlite3

from flask import Flask, render_template_string, request

DB_PATH = "search.db"
# ASCII sentinels: html.escape() leaves them untouched and they will not occur
# in real transcripts. We let FTS highlight() wrap matches in these, escape the
# whole string, then swap the sentinels for real <mark> tags.
HL_OPEN = "@@HLO@@"
HL_CLOSE = "@@HLC@@"

app = Flask(__name__)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def build_match(query: str, mode: str) -> str | None:
    """Turn raw user input into a safe FTS5 MATCH expression."""
    q = query.strip()
    if not q:
        return None
    if mode == "all":
        # AND of individual word tokens (each quoted so punctuation is inert)
        words = ["".join(c for c in w if c.isalnum()) for w in q.split()]
        words = [w for w in words if w]
        if not words:
            return None
        return " AND ".join(f'"{w}"' for w in words)
    # default: exact phrase. Double up quotes to neutralise them.
    return '"' + q.replace('"', '""') + '"'


def fmt_ts(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    return f"{h}:{m:02d}:{sec:02d}" if h else f"{m}:{sec:02d}"


def search(query: str, mode: str, limit: int = 60) -> list[dict]:
    match = build_match(query, mode)
    if match is None:
        return []
    conn = get_conn()
    try:
        rows = conn.execute(
            f"""
            SELECT segments.video_id AS vid,
                   segments.start    AS start,
                   highlight(segments, 2, '{HL_OPEN}', '{HL_CLOSE}') AS htext,
                   v.title AS title
            FROM segments
            JOIN videos v ON v.id = segments.video_id
            WHERE segments MATCH ?
            ORDER BY rank
            LIMIT ?
            """,
            (match, limit),
        ).fetchall()
    except sqlite3.OperationalError:
        return []
    finally:
        conn.close()

    results = []
    for r in rows:
        start = int(r["start"])
        safe = html.escape(r["htext"]).replace(HL_OPEN, "<mark>").replace(HL_CLOSE, "</mark>")
        results.append(
            {
                "vid": r["vid"],
                "start": start,
                "ts": fmt_ts(start),
                "title": r["title"],
                "text": safe,
                "watch": f"https://www.youtube.com/watch?v={r['vid']}&t={start}s",
                "embed": f"https://www.youtube.com/embed/{r['vid']}?start={start}&autoplay=1",
            }
        )
    return results


def stats() -> dict:
    conn = get_conn()
    try:
        nv = conn.execute("SELECT COUNT(*) FROM videos WHERE status='ok'").fetchone()[0]
        ns = conn.execute("SELECT COUNT(*) FROM segments").fetchone()[0]
    except sqlite3.OperationalError:
        nv = ns = 0
    finally:
        conn.close()
    return {"videos": nv, "segments": ns}


PAGE = """
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dan Pena Search</title>
<style>
  :root { --bg:#0d0f14; --panel:#161a23; --line:#252b38; --txt:#e6e9ef;
          --muted:#8a93a6; --accent:#ffb000; --mark:#ffe08a; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--txt);
         font:16px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif; }
  header { text-align:center; padding:38px 16px 10px; }
  h1 { margin:0; font-size:30px; letter-spacing:.5px; }
  h1 span { color:var(--accent); }
  .sub { color:var(--muted); font-size:14px; margin-top:6px; }
  form { max-width:760px; margin:22px auto 6px; padding:0 16px; }
  .bar { display:flex; gap:8px; }
  input[type=text] { flex:1; padding:14px 16px; font-size:17px; border-radius:10px;
         border:1px solid var(--line); background:var(--panel); color:var(--txt); }
  input[type=text]:focus { outline:none; border-color:var(--accent); }
  button.go { padding:0 22px; font-size:16px; font-weight:600; border:none;
         border-radius:10px; background:var(--accent); color:#1a1300; cursor:pointer; }
  .opts { max-width:760px; margin:10px auto 0; padding:0 16px; color:var(--muted);
          font-size:13px; display:flex; gap:18px; align-items:center; }
  .opts label { cursor:pointer; }
  main { max-width:820px; margin:24px auto 80px; padding:0 16px; }
  .count { color:var(--muted); font-size:13px; margin-bottom:14px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px;
          padding:14px 16px; margin-bottom:12px; }
  .card .top { display:flex; justify-content:space-between; gap:12px; align-items:baseline; }
  .ttl { font-weight:600; font-size:15px; color:var(--txt); }
  .play { white-space:nowrap; font-size:13px; font-weight:600; color:var(--accent);
          background:none; border:1px solid var(--accent); border-radius:8px;
          padding:5px 12px; cursor:pointer; }
  .quote { margin-top:10px; color:#cdd3df; }
  mark { background:var(--mark); color:#1a1300; padding:0 2px; border-radius:3px; }
  .frame { margin-top:12px; position:relative; padding-top:56.25%; }
  .frame iframe { position:absolute; inset:0; width:100%; height:100%;
          border:0; border-radius:10px; }
  .empty { color:var(--muted); text-align:center; margin-top:40px; }
  a { color:inherit; }
  footer { text-align:center; color:var(--muted); font-size:12px; padding:24px; }
</style>
</head>
<body>
<header>
  <h1>Dan Pe&ntilde;a <span>Search</span></h1>
  <div class="sub">Find the exact moment a word or phrase was said &middot;
    {{ st.videos }} videos / {{ "{:,}".format(st.segments) }} segments indexed</div>
</header>

<form method="get" action="/">
  <div class="bar">
    <input type="text" name="q" value="{{ q|e }}" placeholder="e.g. high performance, dream team, fear" autofocus>
    <button class="go" type="submit">Search</button>
  </div>
  <div class="opts">
    <label><input type="radio" name="mode" value="phrase" {{ '' if mode=='all' else 'checked' }}> exact phrase</label>
    <label><input type="radio" name="mode" value="all" {{ 'checked' if mode=='all' else '' }}> all words (any order)</label>
  </div>
</form>

<main>
  {% if q %}
    <div class="count">{{ results|length }} result{{ '' if results|length==1 else 's' }} for &ldquo;{{ q|e }}&rdquo;</div>
    {% if results %}
      {% for r in results %}
      <div class="card">
        <div class="top">
          <div class="ttl">{{ r.title }}</div>
          <button class="play" onclick="play(this,'{{ r.embed }}')">&#9654; {{ r.ts }}</button>
        </div>
        <div class="quote">&ldquo;{{ r.text|safe }}&rdquo;
          &nbsp;<a href="{{ r.watch }}" target="_blank" rel="noopener" style="color:var(--muted);font-size:12px;">open on YouTube&nearr;</a>
        </div>
        <div class="slot"></div>
      </div>
      {% endfor %}
    {% else %}
      <div class="empty">No matches. Try fewer words or switch to &ldquo;all words&rdquo;.</div>
    {% endif %}
  {% else %}
    <div class="empty">Type a phrase to find where Dan said it.</div>
  {% endif %}
</main>

<footer>Unofficial fan-built transcript search &middot; links out to YouTube</footer>

<script>
function play(btn, src){
  var slot = btn.closest('.card').querySelector('.slot');
  if (slot.dataset.open === '1'){ slot.innerHTML=''; slot.dataset.open='0'; return; }
  slot.innerHTML = '<div class="frame"><iframe src="'+src+
    '" allow="autoplay; encrypted-media" allowfullscreen></iframe></div>';
  slot.dataset.open = '1';
}
</script>
</body>
</html>
"""


@app.route("/")
def home():
    q = request.args.get("q", "")
    mode = request.args.get("mode", "phrase")
    results = search(q, mode) if q else []
    return render_template_string(PAGE, q=q, mode=mode, results=results, st=stats())


if __name__ == "__main__":
    app.run(debug=True, port=5000)
