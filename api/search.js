// Vercel serverless function: full-text search over the Turso FTS5 index.
//   GET /api/search?q=<query>&mode=phrase|all|any
//   GET /api/search           -> { hits: [], stats: { videos, segments } }
import { createClient } from "@libsql/client";

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
  if (mode === "any") {
    // theme lookups: exact phrases separated by "|", any of which may match;
    // a phrase starting with "-" is excluded (e.g. "excuses|-excuse me")
    const quote = (p) => '"' + p.replace(/"/g, '""') + '"';
    const parts = q.split("|").map((p) => p.trim());
    const include = parts.filter((p) => p && !p.startsWith("-")).map(quote);
    const exclude = parts
      .filter((p) => p.startsWith("-") && p.slice(1).trim())
      .map((p) => quote(p.slice(1).trim()));
    if (!include.length) return null;
    return `(${include.join(" OR ")})` + exclude.map((x) => ` NOT ${x}`).join("");
  }
  // exact phrase: wrap in quotes, neutralise internal quotes
  return '"' + q.replace(/"/g, '""') + '"';
}

export default async function handler(req, res) {
  const q = (req.query.q ?? "").toString();
  const mode = ["all", "any"].includes(req.query.mode) ? req.query.mode : "phrase";

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
