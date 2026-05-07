<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project structure

Routes go in `src/app/`. Components go in `src/components/<area>/`. Do not colocate components inside `src/app/` route folders.

```
src/
  app/                     # routes only — page.tsx, layout.tsx, route.ts, loading.tsx, error.tsx, etc.
    page.tsx               # /
    debug/page.tsx         # /debug
  components/              # all UI components, grouped by area
    landing/               # HeroLanding, PropertyShowcase, AboutSection, Footer
    debug/                 # DebugColorPanel
  lib/                     # utilities, clients, shared logic (when needed)
finca.json                 # static estate config at project root
public/images/             # property + host images
```

Rules:
- A folder under `src/app/` exists only because it represents a URL segment. If a file is not a route file, it does not belong there.
- Route files import components via the `@/components/<area>/<Name>` alias (configured in `tsconfig.json` paths).
- Group components by area (`landing/`, `debug/`, `booking/`, `admin/`...), not by type. Avoid a flat `src/components/` dump.
- Static config (estate metadata, copy) lives in JSON at the repo root and is imported with relative paths.
