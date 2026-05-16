'use client';

import React from 'react';
import Link from 'next/link';
import fincaData from '@config/finca.json';
import socials from '@config/socials.json';
import { PROPERTY_LABELS, type PropertySlug } from '@/lib/colors';

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

type Tone = 'transparent' | 'white';

export default function Footer({ tone = 'transparent' }: { tone?: Tone } = {}) {
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

  // Feedback chip that briefly replaces the Share label after a click.
  // Native share targets (iOS / Android / Edge) get "Shared"; the desktop
  // clipboard fallback gets "Copied". Auto-resets after 1.6s so the footer
  // returns to its idle state without the user having to mouse off.
  const [shareFeedback, setShareFeedback] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!shareFeedback) return;
    const t = setTimeout(() => setShareFeedback(null), 1600);
    return () => clearTimeout(t);
  }, [shareFeedback]);

  const runAction = React.useCallback((action: string) => {
    if (action !== 'share') return;
    if (typeof window === 'undefined') return;

    // Share copy is page-aware: on /finca/<slug> we share that specific
    // property; everywhere else (/, /finca) we share the estate. We don't
    // try to read document.title — the SEO title has template suffixes
    // and the Punta Paloma tail baked in, which reads weirdly in a share
    // sheet. Building the copy from finca.json + the slug stays cleaner.
    const path = window.location.pathname;
    const url = window.location.href;
    const slugMatch = path.match(/^\/finca\/([^/?#]+)/);
    const slug = slugMatch ? slugMatch[1] : null;
    const estate = `Finca ${fincaData.name}`;
    const where = `${fincaData.subtitle}, ${fincaData.location.country}`;
    const hook = '300 m from Punta Paloma Beach';

    const label = slug
      ? (PROPERTY_LABELS[slug as PropertySlug] ?? slug.charAt(0).toUpperCase() + slug.slice(1))
      : null;

    const share = label
      ? {
          title: `${label} · ${estate}`,
          text: `Check out ${label} at ${estate} in ${where} — a vacation rental ${hook}.`,
          url,
        }
      : {
          title: estate,
          text: `Check out ${estate} in ${where} — a vacation rental ${hook}.`,
          url,
        };

    if (navigator.share) {
      navigator
        .share(share)
        .then(() => setShareFeedback('Shared'))
        .catch(() => { /* user cancelled — silent */ });
      return;
    }
    if (navigator.clipboard) {
      // Recipient platforms (Slack/WhatsApp/iMessage) unfurl the URL into
      // a rich OG card on paste, so the bare URL is the right clipboard
      // payload — pasting "Check out … URL" double-prints the text.
      navigator.clipboard.writeText(url).then(() => setShareFeedback('Copied'));
    }
  }, []);

  // tone="white" — explicit white background (landing page).
  // tone="transparent" — inherits whatever the parent surface uses; on
  //   /finca/* the FincaLayout's slate-50 shell shows through so the
  //   footer reads as one piece with the page.
  const toneClass = tone === 'white' ? 'bg-white' : '';

  return (
    <footer className={`py-12 px-8 border-t border-slate-100 ${toneClass}`.trim()}>
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
              <SocialAction
                key={entry.platform}
                entry={entry}
                onRun={runAction}
                feedback={entry.action === 'share' ? shareFeedback : null}
              />
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
  feedback,
}: {
  entry: ActionEntry;
  onRun: (action: string) => void;
  feedback: string | null;
}) {
  // When feedback is active, force the row to full opacity so the
  // transient "Copied" / "Shared" chip is unmissable even if the user's
  // cursor has already moved away.
  const isFeedback = !!feedback;
  return (
    <button
      type="button"
      onClick={() => onRun(entry.action)}
      aria-live="polite"
      className={`group flex items-center gap-2 transition-all duration-500 ${
        isFeedback ? 'opacity-100' : 'opacity-30 hover:opacity-100'
      }`}
    >
      <SocialIcon icon={entry.icon} hoverColor={entry.hoverColor} />
      <SocialLabel label={feedback ?? entry.label} hoverColor={entry.hoverColor} />
    </button>
  );
}
