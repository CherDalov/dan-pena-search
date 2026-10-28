import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, Sparkles, Loader2, Compass, type LucideIcon } from "lucide-react";
import type { Hit, Mode } from "./lib/types";
import { apiSearch, apiStats } from "./lib/api";
import { ResultCard } from "./components/ResultCard";
import { ThemesView } from "./components/ThemesView";

const EXAMPLES = [
  "high performance",
  "dream team",
  "comfort zone",
  "non-recourse",
  "fear",
  "quantum leap",
  "Castle",
];

type Tab = "search" | "themes";

interface View {
  tab: Tab;
  look: string | null; // open "look for" item on the Themes tab
}

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "search", label: "Search", icon: Search },
  { id: "themes", label: "Themes", icon: Compass },
];

// the tab and open theme item live in the URL, so links and the back button work
function readView(): View {
  const p = new URLSearchParams(window.location.search);
  const look = p.get("look");
  return p.get("tab") === "themes" || look
    ? { tab: "themes", look }
    : { tab: "search", look: null };
}

function viewUrl(v: View): string {
  const p = new URLSearchParams();
  if (v.tab === "themes") p.set("tab", "themes");
  if (v.look) p.set("look", v.look);
  const s = p.toString();
  return s ? `?${s}` : window.location.pathname;
}

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
  const [view, setView] = useState<View>(readView);
  const inputRef = useRef<HTMLInputElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const themesScroll = useRef(0); // where the themes list was before an item was opened

  const debounced = useDebounced(query, 200);

  // footer stats (once)
  useEffect(() => {
    apiStats().then(setStats).catch(() => {});
  }, []);

  // browser back/forward moves between tabs and theme items
  useEffect(() => {
    window.history.scrollRestoration = "manual";
    const onPop = () => setView(readView());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback((v: View) => {
    window.history.pushState({ inApp: true }, "", viewUrl(v));
    setView(v);
  }, []);

  const openTab = useCallback(
    (tab: Tab) => {
      if (tab === view.tab && !view.look) return;
      themesScroll.current = 0;
      go({ tab, look: null });
    },
    [view, go]
  );

  const openLook = useCallback(
    (look: string) => {
      if (!view.look) themesScroll.current = window.scrollY;
      go({ tab: "themes", look });
    },
    [view.look, go]
  );

  const closeLook = useCallback(() => {
    if (window.history.state?.inApp) {
      window.history.back();
    } else {
      // landed straight on an item: there is no themes page behind it to go back to
      const v: View = { tab: "themes", look: null };
      window.history.replaceState(null, "", viewUrl(v));
      setView(v);
    }
  }, []);

  // opening a theme item jumps to it; closing one returns to where the list was
  useLayoutEffect(() => {
    if (view.tab !== "themes") return;
    if (view.look) tabsRef.current?.scrollIntoView({ block: "start" });
    else window.scrollTo(0, themesScroll.current);
  }, [view.tab, view.look]);

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

  // keyboard: "/" focuses search, Esc clears (or closes an open theme item)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        if (view.tab === "search") inputRef.current?.focus();
        else openTab("search"); // the search box focuses itself when it appears
      } else if (e.key === "Escape") {
        if (view.look) {
          closeLook();
        } else {
          setQuery("");
          inputRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, openTab, closeLook]);

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

      {/* Tabs */}
      <nav
        ref={tabsRef}
        className="mt-10 flex scroll-mt-4 justify-center gap-8 border-b border-white/10"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => openTab(id)}
            className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition ${
              view.tab === id ? "text-gold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Icon size={15} /> {label}
            {view.tab === id && (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
          </button>
        ))}
      </nav>

      {view.tab === "themes" ? (
        <main className="mt-8 flex-1">
          <ThemesView look={view.look} onOpen={openLook} onBack={closeLook} />
        </main>
      ) : (
        <>
          {/* Search */}
          <div className="sticky top-3 z-20 mt-6">
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
                <p className="mt-6 text-sm text-zinc-500">
                  Or browse business moves and big ideas in{" "}
                  <button
                    onClick={() => openTab("themes")}
                    className="text-gold underline underline-offset-2"
                  >
                    Themes
                  </button>
                  .
                </p>
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
        </>
      )}

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
