# plan/

Working folder for the next mile of Delta. The architectural reading
(`docs/case-study.md`) is the *what and why*; this folder is the *how
and when*. Keep one markdown per phase. When a phase ships, archive
the file by prefixing with `done-`, don't delete it — the audit trail
is the value.

## Order today

The phases are ordered so each one de-risks the next. Don't reorder
without re-reading `docs/case-study.md`'s rationale.

| # | File | Title | Status |
| --- | --- | --- | --- |
| 0 | `chat-resume-2026-05-15.md` | Conversation resume: case study + about.md | reference |
| 1 | (todo) `phase-1-auth-roles.md` | Auth + role split (David / Tano / guest) + `users.role` + `BookingsExplorer` token narrowing + adjust-check-in-date action | next |
| 2 | (todo) `phase-2-cloudinary-seo.md` | Cloudinary migration, property gallery, per-route `generateMetadata`, JSON-LD `LodgingBusiness`, `sitemap.ts`, `robots.ts`, OG images via Cloudinary transforms | queued |
| 3 | (todo) `phase-3-email.md` | `react-email` templates + Resend, 5 transactional flows, `/debug/emails` preview surface | queued |
| 4 | (todo) `phase-4-airbnb-sync.md` | Outbound `/api/properties/[slug]/ical` (token-gated), inbound cron that upserts Airbnb VEVENTs into `property_blocks` | queued |
| 5 | (todo) `phase-5-scheduled-balance.md` | Auto-pull balance N days before check-in via saved Stripe payment method | queued |

## Conventions

- One markdown per phase. Filename pattern: `phase-<n>-<slug>.md`.
- Each file should open with **what does done look like** (a paragraph,
  not a checklist), then the **smallest credible first slice** (the
  thing you'd ship in one afternoon to prove the shape), then **the
  patterns to extend** (which existing modules grow, which don't).
- Don't introduce new patterns inside a phase file. If a phase needs a
  pattern that doesn't exist yet, that's a flag — re-read
  `docs/case-study.md` and either fold into an existing pattern or
  promote the new pattern into `AGENTS.md` first.
- When a phase ships, rename `phase-N-*.md` → `done-phase-N-*.md` and
  add a one-paragraph postmortem at the top: what stayed in scope,
  what got cut, what fought back.

## Pointers

- Architectural reading: [`docs/case-study.md`](../docs/case-study.md)
- Estate + host facts: [`about.md`](../about.md)
- Schema source of truth: [`db/schema.sql`](../db/schema.sql)
- House rules for new code: [`AGENTS.md`](../AGENTS.md)
- Known bugs to clear before each phase: [`docs/bugs.md`](../docs/bugs.md)
