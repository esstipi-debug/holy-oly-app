<p align="center">
  <img src="_mockup/holy-oly-disc.png" alt="Holy Oly — 25 kg plate" width="194" height="192" />
</p>

<h1 align="center">Holy Oly</h1>

<p align="center">
  <strong>Coach⇄athlete macrocycles for Olympic weightlifting.</strong><br />
  <em>Smart training, zero burnout.</em>
</p>

<p align="center">
  You plan toward the competition · You read load and recovery with context · The calendar rules
</p>

---

Holy Oly connects the **coach** with their **roster** in one place: macrocycle prescription, load monitor, classes at the box, and the athlete's path toward the date that matters. It's not an Excel sheet with colors — every signal explains **how it is formed**, **what it is for**, and **what it is read against**.

| Coach | Athlete |
|-------|---------|
| Team, drill-down, macrocycle assignment | Their feed, the day's session, progress vs their normal |
| ACWR, recovery, alerts with a band | Readable signals — no gameable numbers |
| Class calendar and slots | Class booking, cycle (opt-in, redacted) |

---

## Why it exists

In weightlifting the problem is not “a lack of data”: it's **too many numbers with no frame**. Holy Oly prioritizes:

1. **Date-anchored truth** — competitions and mesocycles on a real calendar, not loose weeks.
2. **Viz-first** — charts with a reference; no data → explicit state, never a false green.
3. **Privacy by role** — the athlete does not see what can be used to self-pressure; the coach only sees athletes with an active coach-athlete link.

Reference catalog: **24 macrocycles · 10 schools** (`packages/core` + seed).

---

## Quick start

Requirements: **Node 22**, **pnpm 10**.

```bash
pnpm install
pnpm dev                 # React SPA → http://localhost:5173
```

API + database (local integration): [`docs/superpowers/DEPLOY-LOCAL.md`](docs/superpowers/DEPLOY-LOCAL.md).

Installable offline demo on Windows (local mode, no backend): `pwsh -File scripts/local-demo/setup.ps1`.

---

## Monorepo

```
packages/core   →  pure domain (monitor, prescription, classes, repository)
apps/api        →  Fastify + Prisma + authz
apps/web        →  React — coach and athlete shells
_mockup/        →  HTML/PWA prototype (legacy visual reference)
```

| Command | What it does |
|---------|--------------|
| `pnpm dev` | Frontend, live |
| `pnpm -r typecheck` | Types across the whole workspace |
| `pnpm -r test` | Unit + API integration |
| `pnpm -r build` | Production build |

---

## Documentation

| If you need… | Open |
|--------------|------|
| Product context and module map | [`docs/MEMORIA.md`](docs/MEMORIA.md) |
| MUST/NEVER rules (HR-1, HR-2, authz, cycle) | [`docs/domain/HOLY-OLY-DOMAIN.md`](docs/domain/HOLY-OLY-DOMAIN.md) |
| Agent ritual + graphify | [`CLAUDE.md`](CLAUDE.md) · [`docs/GRAPHIFY-QUICKSTART.md`](docs/GRAPHIFY-QUICKSTART.md) |

<details>
<summary><strong>Graphify</strong> (explore the code with a graph)</summary>

```powershell
pnpm graphify:setup
pnpm graphify:query -- "LocalRepository MonitorSeries AssignSheet"
pnpm graphify:update    # after changing .ts/.tsx
pnpm graphify:viz         # graph.html in the browser
```

Index by communities: [`graphify-out/wiki/index.md`](graphify-out/wiki/index.md) (when the graph has been generated).

</details>

<details>
<summary><strong>Static mockup</strong> (legacy, no backend)</summary>

Reference screens in `_mockup/` — `index.html`, `atleta.html`, `coach.html`, etc.

```bash
python -m http.server 8000 -d _mockup
```

The active product lives in `apps/web` + `apps/api`.

</details>

---

<p align="center">
  <sub>Private repo · weightlifting · coach-athlete · mobile-first</sub>
</p>
