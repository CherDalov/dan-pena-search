import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import type { Hit } from "../lib/types";
import { apiTheme } from "../lib/api";
import { THEME_GROUPS, findLook, type LookFor, type Theme } from "../lib/themes";
import { ResultCard } from "./ResultCard";

interface Props {
  look: string | null; // id of the open "look for" item, if any
  onOpen: (look: string) => void;
  onBack: () => void;
}

export function ThemesView({ look, onOpen, onBack }: Props) {
  const open = look ? findLook(look) : null;
  if (open) {
    return <LookResults theme={open.theme} item={open.item} onOpen={onOpen} onBack={onBack} />;
  }

  return (
    <div>
      <p className="mx-auto max-w-lg text-balance text-center text-zinc-400">
        Business moves and ideas Dan keeps coming back to. Pick one to see the
        moments he talks about it.
      </p>

      {THEME_GROUPS.map((group) => (
        <section key={group.title} className="mt-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">
            {group.title}
          </h2>
          <div className="gap-3 sm:columns-2">
            {group.themes.map((t, i) => (
              <ThemeCard key={t.id} theme={t} index={i} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ThemeCard({
  theme,
  index,
  onOpen,
}: {
  theme: Theme;
  index: number;
  onOpen: (look: string) => void;
}) {
  const Icon = theme.icon;
  return (
    <motion.article
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.3) }}
      className="mb-3 break-inside-avoid rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm sm:p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold/30 bg-gold/10 text-gold">
          <Icon size={16} />
        </span>
        <h3 className="font-semibold text-white">{theme.title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{theme.blurb}</p>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        Look for
      </p>
      <ul className="mt-1 divide-y divide-white/5">
        {theme.items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => onOpen(item.id)}
              className="group flex w-full items-center gap-3 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-200 transition group-hover:text-gold">
                  {item.label}
                </span>
                <span className="block text-xs leading-snug text-zinc-500">{item.hint}</span>
              </span>
              <ChevronRight
                size={16}
                className="shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-gold"
              />
            </button>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}

function LookResults({
  theme,
  item,
  onOpen,
  onBack,
}: {
  theme: Theme;
  item: LookFor;
  onOpen: (look: string) => void;
  onBack: () => void;
}) {
  const [hits, setHits] = useState<Hit[]>([]);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  useEffect(() => {
    const ctrl = new AbortController();
    setHits([]);
    setStatus("loading");
    apiTheme(item, ctrl.signal)
      .then((h) => {
        setHits(h);
        setStatus("done");
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") setStatus("error");
      });
    return () => ctrl.abort();
  }, [item]);

  const Icon = theme.icon;
  const others = theme.items.filter((it) => it.id !== item.id);

  // at least a screen tall, so the page doesn't shrink while results load and
  // the browser keeps the scroll at the top of the item instead of the old spot
  return (
    <div className="min-h-screen">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-gold"
      >
        <ArrowLeft size={15} /> All themes
      </button>

      <div className="mt-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold/80">
          <Icon size={14} /> {theme.title}
        </p>
        <h2
          className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {item.label}
        </h2>
        <p className="mt-2 text-zinc-400">{item.hint}</p>
      </div>

      <div className="mb-4 mt-6 text-xs text-zinc-500">
        {status === "loading" ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 size={14} className="animate-spin text-gold" /> Finding the moments…
          </span>
        ) : status === "done" && hits.length > 0 ? (
          `${hits.length}${hits.length === 60 ? "+" : ""} moment${hits.length === 1 ? "" : "s"}`
        ) : null}
      </div>

      {status === "error" ? (
        <div className="pt-6 text-center text-zinc-500">Search hiccup — try again in a moment.</div>
      ) : status === "done" && hits.length === 0 ? (
        <div className="pt-6 text-center text-zinc-500">
          Nothing yet. More videos are still being added, so check back soon.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {hits.map((hit, i) => (
            <ResultCard key={`${hit.id}-${hit.start}`} hit={hit} index={i} />
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="mt-12 border-t border-white/10 pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            More in {theme.title}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((it) => (
              <button
                key={it.id}
                onClick={() => onOpen(it.id)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-300 transition hover:border-gold/40 hover:text-gold"
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
