// Rules for the "Look for" items on the Themes tab, shared by the search API
// and scripts/check_themes.mjs (the underscore keeps Vercel from serving this
// file as its own endpoint).
//
// The full-text index finds candidate moments for an item's search phrases
// (stemmed, so "negotiate" also finds "negotiating" but "margin" also finds
// "marginal"). Each candidate is then checked in plain text, so only moments
// that use the words in the intended sense are kept:
//   words  - one of these must appear in the moment itself, as whole words;
//            these are what get highlighted
//   ignore - phrases that don't count because they mean something else
//            (e.g. "private equity" for Equity); blanked out before the check
//   near   - topic words; at least one must appear in the moment or in the
//            moments right before or after it (about a minute and a half).
//            It applies to every word of the item, so items list their
//            unambiguous phrases here too.
// In all three, "*" stands for any letters or digits ("negotiat*", "*x multiple",
// "take* * public"), and spaces or hyphens match either. Captions show bleeped
// words as "[ __ ]", which a phrase has to spell out ("open your [ __ ] mouth").

export const CANDIDATES = 400; // best index matches checked per item
export const SHOWN = 60; // moments returned

const MAX_TERMS = 120;
const MAX_LEN = 80;

/** Split a "|"-separated list, as sent in the query string. */
export function list(value) {
  return String(value ?? "")
    .split("|")
    .map((s) => s.trim().slice(0, MAX_LEN))
    .filter(Boolean)
    .slice(0, MAX_TERMS);
}

/** The rules for one item, from the query string (q = search phrases). */
export function parseRules(query) {
  return {
    search: list(query.q),
    words: list(query.words),
    ignore: list(query.ignore),
    near: list(query.near),
  };
}

/** FTS5 MATCH expression: any of the search phrases. */
export function ftsMatch(rules) {
  if (!rules.search.length) return null;
  return rules.search.map((p) => '"' + p.replace(/"/g, '""') + '"').join(" OR ");
}

// curly apostrophes -> straight (same length, so offsets still line up)
const norm = (s) => (s || "").replace(/[‘’ʼ]/g, "'");
const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

// Case-insensitive, whole-word pattern matching any of the words/phrases.
// Spaces and hyphens inside a phrase match either ("roll-up" = "roll up").
function pattern(terms, flags) {
  const alts = terms
    .map((t) =>
      norm(t.toLowerCase())
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((w) => escape(w).replace(/\*/g, "[\\p{L}\\p{N}']*"))
        .join("[\\s-]+")
    )
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (!alts.length) return null;
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join("|")})(?![\\p{L}\\p{N}])`, flags);
}

/**
 * Returns check(row) for rows of { text, prev, next }: the [start, end]
 * spans to highlight if the moment fits the item, or null if it doesn't.
 */
export function themeCheck(rules) {
  const words = pattern(rules.words, "giu");
  const ignore = pattern(rules.ignore, "giu");
  const near = pattern(rules.near, "iu");
  return (row) => {
    let text = norm(row.text);
    if (ignore) text = text.replace(ignore, (m) => " ".repeat(m.length));
    const marks = words ? [...text.matchAll(words)].map((m) => [m.index, m.index + m[0].length]) : [];
    if (words && !marks.length) return null;
    if (near && !near.test([row.prev, row.text, row.next].map(norm).join(" \n "))) return null;
    return marks;
  };
}

/** Which topic word put the moment in context, and where (for checking rules). */
export function nearEvidence(rules, row) {
  const near = pattern(rules.near, "iu");
  if (!near) return null;
  for (const [where, s] of [["here", row.text], ["before", row.prev], ["after", row.next]]) {
    const m = near.exec(norm(s));
    if (m) return `${m[0]} (${where})`;
  }
  return null;
}
