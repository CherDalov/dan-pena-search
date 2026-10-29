// Vercel serverless function: full-text search over the Turso FTS5 index.
//   GET /api/search?q=<query>&mode=phrase|all
//   GET /api/search?mode=theme&q=..&words=..&ignore=..&near=..   (Themes, see _theme.js)
//   GET /api/search           -> { hits: [], stats: { videos, segments } }
import { createClient } from "@libsql/client";
import { CANDIDATES, SHOWN, ftsMatch, parseRules, themeCheck } from "./_theme.js";

// strip any stray BOM/whitespace (Windows tooling can prepend a U+FEFF)
const clean = (s) => (s || "").replace(/^﻿/, "").trim();

const client = createClient({
  url: clean(process.env.TURSO_DATABASE_URL),
  authToken: clean(process.env.TURSO_AUTH_TOKEN),
});

// Turn raw user input into a safe FTS5 MATCH expression.
function buildMatch(query, mode) {
  const q = query.trim();
  if (!q) return null;
  if (mode === "all") {
    const words = q
      .split(/[^\p{L}\p{N}]+/u)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter((w) => w.length > 1);
    if (!words.length) return null;
    return words.map((w) => `"${w}"`).join(" AND ");
  }
  // exact phrase: wrap in quotes, neutralise internal quotes
  return '"' + q.replace(/"/g, '""') + '"';
}

// A Themes item: the best index matches, each with the moments right before
// and after it (same video), so the rules can check the context.
async function themeHits(query) {
  const rules = parseRules(query);
  const match = ftsMatch(rules);
  if (!match) return [];
  const around = (rel, op) =>
    rules.near.length
      ? `(SELECT ${rel}.text FROM segments ${rel} WHERE ${rel}.rowid = h.rid ${op} 1 AND ${rel}.video_id = h.video_id)`
      : "NULL";
  const r = await client.execute({
    sql: `WITH h0 AS (
            SELECT rowid AS rid, video_id, title, start, text, rank AS r
            FROM segments WHERE segments MATCH ? ORDER BY rank LIMIT ?
          )
          SELECT h.video_id AS id, h.title, h.start, h.text,
                 ${around("p", "-")} AS prev, ${around("n", "+")} AS next
          FROM h0 h ORDER BY h.r`,
    args: [match, CANDIDATES],
  });
  const check = themeCheck(rules);
  const hits = [];
  for (const row of r.rows) {
    const marks = check(row);
    if (!marks) continue;
    hits.push({ id: row.id, title: row.title, start: Number(row.start), text: row.text, marks });
    if (hits.length === SHOWN) break;
  }
  return hits;
}

export default async function handler(req, res) {
  const q = (req.query.q ?? "").toString();
  const mode = ["all", "theme"].includes(req.query.mode) ? req.query.mode : "phrase";

  try {
    if (!q.trim()) {
      const stat = await client.execute(
        "SELECT count(*) c, count(distinct video_id) v FROM segments"
      );
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({
        hits: [],
        stats: {
          segments: Number(stat.rows[0].c),
          videos: Number(stat.rows[0].v),
        },
      });
    }

    if (mode === "theme") {
      const hits = await themeHits(req.query);
      res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.status(200).json({ hits });
    }

    const match = buildMatch(q, mode);
    if (!match) return res.status(200).json({ hits: [] });

    const r = await client.execute({
      sql: `SELECT video_id AS id, title, start, text
            FROM segments WHERE segments MATCH ? ORDER BY rank LIMIT 60`,
      args: [match],
    });

    const hits = r.rows.map((row) => ({
      id: row.id,
      title: row.title,
      start: Number(row.start),
      text: row.text,
    }));

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ hits });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e), hits: [] });
  }
}
