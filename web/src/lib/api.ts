import type { Hit, Mode } from "./types";

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);
}

interface SearchResponse {
  hits: { id: string; title: string; start: number; text: string }[];
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

export async function apiStats(): Promise<{ videos: number; segments: number }> {
  const res = await fetch(`/api/search`);
  if (!res.ok) return { videos: 0, segments: 0 };
  const data: SearchResponse = await res.json();
  return data.stats ?? { videos: 0, segments: 0 };
}
