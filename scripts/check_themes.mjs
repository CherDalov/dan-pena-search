// Check what each "Look for" item on the Themes tab finds, using the local
// search.db and the same rules as the live site (api/_theme.js).
//
//   node scripts/check_themes.mjs                every item: how many moments it keeps
//   node scripts/check_themes.mjs margins debt   those items (or whole themes, by id):
//                                                the moments the site would show
// Options:
//   --top N         moments to list per item (default: as many as the site shows)
//   --dropped       also list the candidates the rules leave out, and why
//   --rules a.json  try other rules: { "<item id>": { search, words, ignore, near } }
//   --db path       database to read (default search.db, opened read-only)
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { THEME_GROUPS } from "../web/src/lib/themes.ts";
import { CANDIDATES, SHOWN, ftsMatch, nearEvidence, parseRules, themeCheck } from "../api/_theme.js";

const args = process.argv.slice(2);
const opt = { top: SHOWN, dropped: false, rules: [], db: "search.db", only: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--top") opt.top = Number(args[++i]);
  else if (a === "--dropped") opt.dropped = true;
  else if (a === "--rules") opt.rules.push(args[++i]);
  else if (a === "--db") opt.db = args[++i];
  else opt.only.push(a);
}
const overrides = Object.assign({}, ...opt.rules.map((f) => JSON.parse(readFileSync(f, "utf8"))));

const db = new DatabaseSync(opt.db, { readOnly: true });
const countSql = db.prepare("SELECT count(*) AS c FROM segments WHERE segments MATCH ?");
const candSql = db.prepare(`
  WITH hits AS (
    SELECT rowid AS rid, video_id, start, text, rank AS r
    FROM segments WHERE segments MATCH ? ORDER BY rank LIMIT ?
  )
  SELECT h.video_id AS id, h.start, h.text,
    (SELECT title FROM videos v WHERE v.id = h.video_id) AS title,
    (SELECT p.text FROM segments p WHERE p.rowid = h.rid - 1 AND p.video_id = h.video_id) AS prev,
    (SELECT n.text FROM segments n WHERE n.rowid = h.rid + 1 AND n.video_id = h.video_id) AS next
  FROM hits h ORDER BY h.r`);

const time = (s) => {
  s = Math.floor(s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};
const marked = (text, marks) => {
  let out = "", last = 0;
  for (const [a, b] of marks) { out += text.slice(last, a) + "[[" + text.slice(a, b) + "]]"; last = b; }
  return out + text.slice(last);
};

// the rules exactly as the API receives them (same "|" lists and limits)
const asSent = (r) =>
  parseRules({
    q: r.search.join("|"),
    words: r.words.join("|"),
    ignore: (r.ignore ?? []).join("|"),
    near: (r.near ?? []).join("|"),
  });

const items = [];
for (const g of THEME_GROUPS)
  for (const t of g.themes)
    for (const it of t.items)
      if (!opt.only.length || opt.only.includes(it.id) || opt.only.includes(t.id))
        items.push({ theme: t, item: it, rules: asSent({ ...it, ...overrides[it.id] }) });

const videos = db.prepare("SELECT count(*) AS c FROM videos WHERE status = 'ok'").get().c;
console.log(`${videos} videos in ${opt.db}\n`);

for (const { theme, item, rules } of items) {
  const match = ftsMatch(rules);
  const total = match ? countSql.get(match).c : 0;
  const rows = match ? candSql.all(match, CANDIDATES) : [];
  const check = themeCheck(rules);
  const kept = [], dropped = [];
  for (const row of rows) {
    const marks = check(row);
    if (marks) kept.push({ row, marks });
    else dropped.push(row);
  }
  const shown = kept.slice(0, SHOWN);

  if (!opt.only.length) {
    const flag = shown.length < 8 ? "   <-- few" : "";
    console.log(`${item.id.padEnd(26)} ${String(total).padStart(5)} found  ${String(shown.length).padStart(3)} shown  (${dropped.length} of ${rows.length} checked left out)${flag}`);
    continue;
  }

  console.log(`== ${item.id}  ·  ${theme.title}  ·  ${item.label}: ${item.hint}`);
  console.log(`   search: ${rules.search.join(" | ")}`);
  console.log(`   words:  ${rules.words.join(" | ")}`);
  if (rules.ignore.length) console.log(`   ignore: ${rules.ignore.join(" | ")}`);
  if (rules.near.length) console.log(`   near:   ${rules.near.join(" | ")}`);
  console.log(`   ${total} found by the index, ${rows.length} checked, ${kept.length} fit, ${shown.length} shown\n`);
  shown.slice(0, opt.top).forEach(({ row, marks }, i) => {
    const ev = rules.near.length ? `   {${nearEvidence(rules, row)}}` : "";
    console.log(`${String(i + 1).padStart(3)}. ${row.id} ${time(row.start)}  ${String(row.title).slice(0, 70)}${ev}`);
    console.log(`     ${marked(row.text, marks)}`);
  });
  if (opt.dropped && dropped.length) {
    console.log(`\n   -- left out (${dropped.length}):`);
    const words = themeCheck({ ...rules, near: [] });
    dropped.forEach((row, i) => {
      const why = words(row) ? "no topic word nearby" : "none of the words";
      console.log(`  x${i + 1}. ${row.id} ${time(row.start)}  (${why})`);
      console.log(`     ${row.text}`);
    });
  }
  console.log("");
}
