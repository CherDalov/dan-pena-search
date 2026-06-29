import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, Sparkles, Loader2 } from "lucide-react";
import type { Hit, Mode } from "./lib/types";
import { apiSearch, apiStats } from "./lib/api";
import { ResultCard } from "./components/ResultCard";

const EXAMPLES = [
  "high performance",
  "dream team",
  "comfort zone",
  "non-recourse",
  "fear",
  "quantum leap",
  "Castle",
];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("phrase");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const [ms, setMs] = useState(0);
  const [stats, setStats] = useState<{ videos: number; segments: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debounced = useDebounced(query, 200);

  // footer stats (once)
  useEffect(() => {
    apiStats().then(setStats).catch(() => {});
  }, []);

  // run search whenever the debounced query / mode changes
  useEffect(() => {
    const q = debounced.trim();
    if (!q) {
      setHits([]);
      setError(false);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    setError(false);
    const t0 = performance.now();
    apiSearch(debounced, mode, ctrl.signal)
      .then((h) => {
        setHits(h);
        setMs(performance.now() - t0);
        setSearching(false);
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") {
          setError(true);
          setSearching(false);
        }
      });
    return () => ctrl.abort();
  }, [debounced, mode]);

  // keyboard: "/" focuses search, Esc clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasQuery = debounced.trim().length > 0;

  return (
    <div className="relative z-10 mx-auto flex min-h-full max-w-3xl flex-col px-4 pb-24">
      {/* Hero */}
      <header className="pt-16 text-center sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold"
        >
          <Sparkles size={13} /> Unofficial transcript search
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="text-5xl font-extrabold tracking-tight text-white sm:text-7xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          DAN PEÑA <span className="text-gold">SEARCH</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mx-auto mt-4 max-w-md text-balance text-zinc-400"
        >
          Find the exact moment he said it. Type a word or phrase and jump
          straight to it.
        </motion.p>
      </header>

      {/* Search */}
      <div className="sticky top-3 z-20 mt-10">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-2 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2">
            {searching ? (
              <Loader2 size={20} className="ml-3 shrink-0 animate-spin text-gold" />
            ) : (
              <Search size={20} className="ml-3 shrink-0 text-zinc-500" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the channel…  ( press / )"
              autoFocus
              className="w-full bg-transparent py-3 text-lg text-white outline-none placeholder:text-zinc-600"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="mr-1 rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                clear
              </button>
            )}
          </div>
        </div>

        {/* Mode toggle */}
        <div className="mx-auto mt-2 flex w-fit items-center justify-center gap-1 rounded-full border border-white/10 bg-black/30 p-1 text-sm backdrop-blur-md">
          {(["phrase", "all"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`relative rounded-full px-4 py-1.5 font-medium transition ${
                mode === m ? "text-ink" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {mode === m && (
                <motion.span
                  layoutId="mode-pill"
                  className="absolute inset-0 rounded-full bg-gold"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative">
                {m === "phrase" ? "Exact phrase" : "All words"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <main className="mt-8 flex-1">
        {!hasQuery && (
          <div className="pt-6 text-center">
            <p className="text-sm text-zinc-500">Try one of these:</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setMode("phrase");
                    setQuery(ex);
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-300 transition hover:border-gold/40 hover:text-gold"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasQuery && (
          <>
            <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
              <span>
                {searching
                  ? "Searching…"
                  : `${hits.length}${hits.length === 60 ? "+" : ""} result${
                      hits.length === 1 ? "" : "s"
                    } for “`}
                {!searching && <span className="text-zinc-300">{debounced}</span>}
                {!searching && "”"}
              </span>
              {!searching && hits.length > 0 && <span>{ms.toFixed(0)} ms</span>}
            </div>

            {error ? (
              <div className="pt-10 text-center text-zinc-500">
                Search hiccup — try again in a moment.
              </div>
            ) : !searching && hits.length === 0 ? (
              <div className="pt-10 text-center text-zinc-500">
                Nothing found. Try fewer words or switch to{" "}
                <button
                  onClick={() => setMode(mode === "phrase" ? "all" : "phrase")}
                  className="text-gold underline underline-offset-2"
                >
                  {mode === "phrase" ? "“All words”" : "“Exact phrase”"}
                </button>
                .
              </div>
            ) : (
              <motion.div layout className="flex flex-col gap-3">
                <AnimatePresence mode="popLayout">
                  {hits.map((hit, i) => (
                    <ResultCard
                      key={`${hit.id}-${hit.start}`}
                      hit={hit}
                      index={i}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-zinc-600">
        {stats && (
          <p>
            {stats.videos.toLocaleString()} videos ·{" "}
            {stats.segments.toLocaleString()} segments indexed
          </p>
        )}
        <p className="mt-2">
          Unofficial fan-built search · all playback links out to YouTube ·{" "}
          <a
            href="https://www.youtube.com/@trilliondollarman"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-gold"
          >
            @trilliondollarman
          </a>
        </p>
      </footer>
    </div>
  );
}
