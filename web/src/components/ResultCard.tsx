import { useState } from "react";
import { motion } from "motion/react";
import { Play, ExternalLink, X } from "lucide-react";
import type { Hit } from "../lib/types";
import {
  formatTimestamp,
  highlight,
  youtubeEmbed,
  youtubeThumb,
  youtubeWatch,
} from "../lib/format";

export function ResultCard({ hit, index }: { hit: Hit; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.025, 0.3) }}
      className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm transition-colors hover:border-gold/40 hover:bg-white/[0.05] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-zinc-200 sm:text-[15px]">
          {hit.title}
        </h3>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/50 px-3 py-1 text-xs font-bold text-gold transition hover:bg-gold hover:text-ink"
        >
          {open ? <X size={13} /> : <Play size={13} fill="currentColor" />}
          {formatTimestamp(hit.start)}
        </button>
      </div>

      <p className="mt-3 text-[15px] leading-relaxed text-zinc-300">
        <span className="text-gold/60">&ldquo;</span>
        {highlight(hit.text, hit.terms)}
        <span className="text-gold/60">&rdquo;</span>
      </p>

      {open ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src={youtubeEmbed(hit.id, hit.start)}
              title={hit.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="relative h-[54px] w-24 shrink-0 overflow-hidden rounded-lg border border-white/10"
            aria-label="Play from here"
          >
            <img
              src={youtubeThumb(hit.id)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-70 transition group-hover:opacity-100"
            />
            <span className="absolute inset-0 grid place-items-center">
              <Play size={18} className="text-white drop-shadow" fill="white" />
            </span>
          </button>
          <a
            href={youtubeWatch(hit.id, hit.start)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-gold"
          >
            open on YouTube <ExternalLink size={12} />
          </a>
        </div>
      )}
    </motion.div>
  );
}
