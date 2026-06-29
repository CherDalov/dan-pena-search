// Sync web/public/index.json into Turso (FTS5 table the API queries).
//
// Incremental by default: only uploads videos not already in Turso, so each
// run is fast and there is no gap in search while it runs.
//   node scripts/load_turso.mjs          # incremental
//   node scripts/load_turso.mjs --full   # wipe + full rebuild
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const FULL = process.argv.includes("--full");

const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^﻿/, "").trim();
}
if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
  console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in .env");
  process.exit(1);
}

const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

const idx = JSON.parse(readFileSync(new URL("../web/public/index.json", import.meta.url), "utf8"));
const videos = idx.videos;
const segments = idx.segments;

const CREATE =
  "CREATE VIRTUAL TABLE IF NOT EXISTS segments USING fts5(" +
  "video_id UNINDEXED, title UNINDEXED, start UNINDEXED, text, " +
  "tokenize='porter unicode61')";

if (FULL) {
  console.log("Full rebuild: dropping existing table...");
  await client.execute("DROP TABLE IF EXISTS segments");
}
await client.execute(CREATE);

// which videos are already in Turso?
const existing = new Set();
const cur = await client.execute("SELECT DISTINCT video_id FROM segments");
for (const row of cur.rows) existing.add(row.video_id);

// only segments belonging to not-yet-uploaded videos
const rows = [];
for (const s of segments) {
  const v = videos[s.v];
  if (!existing.has(v.id)) rows.push({ vid: v.id, title: v.title, t: s.t, x: s.x });
}

if (rows.length === 0) {
  console.log(`Turso already up to date (${existing.size} videos).`);
} else {
  const newVideos = new Set(rows.map((r) => r.vid)).size;
  console.log(`Uploading ${rows.length} segments from ${newVideos} new videos...`);
  const CHUNK = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    await client.batch(
      slice.map((r) => ({
        sql: "INSERT INTO segments (video_id, title, start, text) VALUES (?, ?, ?, ?)",
        args: [r.vid, r.title, r.t, r.x],
      })),
      "write"
    );
    done += slice.length;
    process.stdout.write(`\r  uploaded ${done}/${rows.length}`);
  }
  process.stdout.write("\n");
}

const c = await client.execute("SELECT count(*) c, count(distinct video_id) v FROM segments");
console.log(`Turso now holds ${Number(c.rows[0].c)} segments / ${Number(c.rows[0].v)} videos.`);
