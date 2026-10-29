import type { Hit, Mode } from "./types";
import type { LookFor } from "./themes";

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);
}

interface SearchResponse {
  hits: { id: string; title: string; start: number; text: string; marks?: [number, number][] }[];
  stats?: { videos: number; segments: number };
}

export async function apiSearch(
  q: string,
  mode: Mode,
  signal?: AbortSignal
): Promise<Hit[]> {
  const res = await fetch(
    `/api/search?q=${encodeURIComponent(q)}&mode=${mode}`,
    { signal }
  );
  if (!res.ok) throw new Error(`search failed (${res.status})`);
  const data: SearchResponse = await res.json();
  const terms = mode === "phrase" ? [q.trim()] : tokenize(q);
  return (data.hits || []).map((h) => ({
    id: h.id,
    title: h.title,
    start: h.start,
    text: h.text,
    terms,
  }));
}

/** Moments for a Themes "Look for" item; the API checks its rules and marks the words. */
export async function apiTheme(item: LookFor, signal?: AbortSignal): Promise<Hit[]> {
  const params = new URLSearchParams({
    mode: "theme",
    q: item.search.join("|"),
    words: item.words.join("|"),
  });
  if (item.ignore?.length) params.set("ignore", item.ignore.join("|"));
  if (item.near?.length) params.set("near", item.near.join("|"));
  const res = await fetch(`/api/search?${params}`, { signal });
  if (!res.ok) throw new Error(`search failed (${res.status})`);
  const data: SearchResponse = await res.json();
  return (data.hits || []).map((h) => ({
    id: h.id,
    title: h.title,
    start: h.start,
    text: h.text,
    terms: [],
    marks: h.marks ?? [],
  }));
}

export async function apiStats(): Promise<{ videos: number; segments: number }> {
  const res = await fetch(`/api/search`);
  if (!res.ok) return { videos: 0, segments: 0 };
  const data: SearchResponse = await res.json();
  return data.stats ?? { videos: 0, segments: 0 };
}
