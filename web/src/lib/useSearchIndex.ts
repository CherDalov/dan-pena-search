import { useEffect, useRef, useState } from "react";
import MiniSearch from "minisearch";
import type { Hit, IndexFile, Mode, RawSegment } from "./types";

interface Meta {
  channel: string;
  generated: string;
  sample: boolean;
  videoCount: number;
  segmentCount: number;
}

type Status = "loading" | "ready" | "error";

interface IndexApi {
  status: Status;
  meta: Meta | null;
  search: (query: string, mode: Mode, limit?: number) => Hit[];
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1);
}

export function useSearchIndex(): IndexApi {
  const [status, setStatus] = useState<Status>("loading");
  const [meta, setMeta] = useState<Meta | null>(null);
  const segmentsRef = useRef<RawSegment[]>([]);
  const videosRef = useRef<IndexFile["videos"]>([]);
  const miniRef = useRef<MiniSearch | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = `${import.meta.env.BASE_URL}index.json`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<IndexFile>;
      })
      .then((data) => {
        if (cancelled) return;
        segmentsRef.current = data.segments;
        videosRef.current = data.videos;

        const mini = new MiniSearch<RawSegment & { id: number }>({
          fields: ["x"],
          storeFields: ["v", "t", "x"],
          searchOptions: { prefix: true, fuzzy: 0.15, combineWith: "AND" },
        });
        mini.addAll(data.segments.map((s, i) => ({ id: i, ...s })));
        miniRef.current = mini;

        setMeta({
          channel: data.channel,
          generated: data.generated,
          sample: Boolean(data.sample),
          videoCount: data.videos.length,
          segmentCount: data.segments.length,
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toHit(seg: RawSegment, terms: string[]): Hit {
    const vid = videosRef.current[seg.v];
    return {
      id: vid?.id ?? "",
      title: vid?.title ?? "(unknown)",
      start: seg.t,
      text: seg.x,
      terms,
    };
  }

  function search(query: string, mode: Mode, limit = 80): Hit[] {
    const q = query.trim();
    if (!q) return [];

    if (mode === "phrase") {
      const needle = q.toLowerCase();
      const hits: Hit[] = [];
      const segs = segmentsRef.current;
      for (let i = 0; i < segs.length && hits.length < limit; i++) {
        if (segs[i].x.toLowerCase().includes(needle)) {
          hits.push(toHit(segs[i], [q]));
        }
      }
      return hits;
    }

    // all-words mode (ranked, typo-tolerant)
    const mini = miniRef.current;
    if (!mini) return [];
    const terms = tokenize(q);
    const results = mini.search(q).slice(0, limit);
    return results.map((r) =>
      toHit({ v: r.v as number, t: r.t as number, x: r.x as string }, terms)
    );
  }

  return { status, meta, search };
}
