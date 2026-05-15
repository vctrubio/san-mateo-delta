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
// The wind ticker below the location is a soft visual hook for the
// kite/wind brand — values drift on a random walk every 4s. Candidate for a
// real Tarifa wind API (Open-Meteo, Windy) down the line; see
// docs/case-study.md.
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

  const [wind, setWind] = React.useState({ speed: 18, deg: 270 });

  React.useEffect(() => {
    const interval = setInterval(() => {
      setWind((prev) => ({
        speed: Math.max(10, Math.min(45, Number((prev.speed + (Math.random() - 0.5) * 2).toFixed(1)))),
        deg: (prev.deg + Math.floor((Math.random() - 0.5) * 10)) % 360,
      }));
    }, 4000);
    return () => clearInterval(interval);
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
