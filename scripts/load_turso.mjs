// Load web/public/index.json into Turso as an FTS5 table the API can query.
// Full reload each run (drop + recreate + insert) - simple and idempotent.
//
//   node scripts/load_turso.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) {
  console.error("Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in .env");
  process.exit(1);
}

const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

const idx = JSON.parse(readFileSync(new URL("../web/public/index.json", import.meta.url), "utf8"));
const videos = idx.videos;
const segments = idx.segments;
console.log(`Loading ${segments.length} segments from ${videos.length} videos into Turso...`);

await client.execute("DROP TABLE IF EXISTS segments");
await client.execute(
  "CREATE VIRTUAL TABLE segments USING fts5(" +
    "video_id UNINDEXED, title UNINDEXED, start UNINDEXED, text, " +
    "tokenize='porter unicode61')"
);

const rows = segments.map((s) => ({
  vid: videos[s.v].id,
  title: videos[s.v].title,
  t: s.t,
  x: s.x,
}));

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
  process.stdout.write(`\r  inserted ${done}/${rows.length}`);
}

const c = await client.execute("SELECT count(*) c, count(distinct video_id) v FROM segments");
console.log(`\nDone. Turso now holds ${Number(c.rows[0].c)} segments / ${Number(c.rows[0].v)} videos.`);
