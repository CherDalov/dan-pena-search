import type { ReactNode } from "react";

/** Seconds -> "m:ss" or "h:mm:ss". */
export function formatTimestamp(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split `text` into React nodes, wrapping any occurrence of the given
 * `terms` (case-insensitive) in <mark>. Safe — no dangerouslySetInnerHTML.
 */
export function highlight(text: string, terms: string[]): ReactNode[] {
  const cleaned = terms.map((t) => t.trim()).filter(Boolean);
  if (cleaned.length === 0) return [text];

  // longest first so phrases win over their constituent words
  const pattern = cleaned
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|");
  const re = new RegExp(`(${pattern})`, "gi");

  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<mark key={key++}>{m[0]}</mark>);
    last = m.index + m[0].length;
    if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function youtubeWatch(id: string, start: number): string {
  return `https://www.youtube.com/watch?v=${id}&t=${Math.floor(start)}s`;
}

export function youtubeEmbed(id: string, start: number): string {
  return `https://www.youtube.com/embed/${id}?start=${Math.floor(
    start
  )}&autoplay=1&rel=0`;
}

export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
}
