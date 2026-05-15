'use client';

import React from 'react';
import Link from 'next/link';
import fincaData from '@config/finca.json';
import socials from '@config/socials.json';

// ============================================================================
// Footer — brand · social row · location strip (with the wind ticker).
//
// The middle row is fully data-driven from `config/socials.json`. Each entry
// is either a `link` (Next `<Link>` to an external URL — e.g. Airbnb,
// Facebook) or an `action` (button that triggers a behaviour — currently
// only `share`, which calls `navigator.share` with a clipboard fallback).
// Adding a new social is one JSON entry plus, if needed, one extra case in
// `runAction`. No SVG paths in this file; the icon `path` + `viewBox` ride
// on the JSON entry so the brand mark stays next to the URL.
//
// The wind ticker below the location is live — `/api/wind` proxies
// Open-Meteo for the Tarifa coordinates in `config/finca.json` with a
// 15-minute server cache and a fallback when the upstream is down. The
// Footer fetches on mount and again every 15 min while the page is open.
// ============================================================================

type IconSpec = { viewBox: string; path: string };

type LinkEntry = {
  platform: string;
  label: string;
  kind: 'link';
  url: string;
  hoverColor: string;
  icon: IconSpec;
};

type ActionEntry = {
  platform: string;
  label: string;
  kind: 'action';
  action: string;
  hoverColor: string;
  icon: IconSpec;
};

type SocialEntry = LinkEntry | ActionEntry;

export default function Footer() {
  // The links array is statically typed in TS, but resolveJsonModule infers
  // string-for-everything from the JSON. Cast once at the boundary so the
  // render code stays clean and the `kind` discriminant works.
  const links = socials.links as SocialEntry[];

  // The seed values are intentionally plausible (22 kn / W) — they show on
  // first paint before /api/wind responds, so a casual visitor never sees a
  // "loading…" state in the footer ticker.
  const [wind, setWind] = React.useState({ speed: 22, deg: 270 });

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch('/api/wind', { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as { speed?: number; deg?: number };
        if (cancelled) return;
        if (typeof data.speed === 'number' && typeof data.deg === 'number') {
          setWind({ speed: data.speed, deg: data.deg });
        }
      } catch {
        /* leave the seed values in place; the route already has fallback */
      }
    };
    load();
    // Open-Meteo updates ~hourly; re-pulling every 15 min keeps the
    // ticker honest without thrashing.
    const interval = setInterval(load, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const runAction = React.useCallback((action: string) => {
    if (action === 'share') {
      const url = typeof window !== 'undefined' ? window.location.href : '';
      if (navigator.share) {
        navigator
          .share({
            title: fincaData.name,
            text: `Discover this coastal sanctuary in ${fincaData.subtitle}.`,
            url,
          })
          .catch(() => { /* user cancelled — silent */ });
      } else if (navigator.clipboard && url) {
        navigator.clipboard.writeText(url);
      }
    }
  }, []);

  return (
    <footer className="py-12 px-8 bg-white border-t border-slate-100">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8 md:gap-0">
        <div className="flex flex-col items-center md:items-start">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-[0.3em]">{fincaData.name}</span>
          <span className="text-[10px] font-mono text-slate-300 uppercase mt-1 tracking-widest">Est. {fincaData.est}</span>
        </div>

        <div className="flex items-center gap-12">
          {links.map((entry) =>
            entry.kind === 'link' ? (
              <SocialLink key={entry.platform} entry={entry} />
            ) : (
              <SocialAction key={entry.platform} entry={entry} onRun={runAction} />
            ),
          )}
        </div>

        <div className="flex flex-col items-center md:items-end">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-[0.2em]">
            {fincaData.subtitle}, {fincaData.location.country}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">
              {wind.speed} KTS • {wind.deg}° Wind
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ icon, hoverColor }: { icon: IconSpec; hoverColor: string }) {
  return (
    <svg
      viewBox={icon.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      style={{ ['--hover-fill' as string]: hoverColor }}
      className="w-5 h-5 fill-slate-900 group-hover:fill-[var(--hover-fill)] transition-colors"
    >
      <path d={icon.path} />
    </svg>
  );
}

function SocialLabel({ label, hoverColor }: { label: string; hoverColor: string }) {
  return (
    <span
      style={{ ['--hover-text' as string]: hoverColor }}
      className="text-[10px] font-bold uppercase tracking-widest text-slate-900 group-hover:text-[var(--hover-text)]"
    >
      {label}
    </span>
  );
}

function SocialLink({ entry }: { entry: LinkEntry }) {
  return (
    <Link
      href={entry.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 opacity-30 hover:opacity-100 transition-all duration-500"
    >
      <SocialIcon icon={entry.icon} hoverColor={entry.hoverColor} />
      <SocialLabel label={entry.label} hoverColor={entry.hoverColor} />
    </Link>
  );
}

function SocialAction({
  entry,
  onRun,
}: {
  entry: ActionEntry;
  onRun: (action: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onRun(entry.action)}
      className="group flex items-center gap-2 opacity-30 hover:opacity-100 transition-all duration-500"
    >
      <SocialIcon icon={entry.icon} hoverColor={entry.hoverColor} />
      <SocialLabel label={entry.label} hoverColor={entry.hoverColor} />
    </button>
  );
}
