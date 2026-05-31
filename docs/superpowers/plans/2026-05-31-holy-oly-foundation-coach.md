# Holy Oly — Foundation + Coach Slice · Implementation Plan (M1–M2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the real Holy Oly app as a pnpm monorepo — a tested pure-TS domain package (`packages/core`) and a React design-system foundation (`apps/web`) — porting the existing `_mockup/` and `macrocycles.ts`, frontend-first with local data.

**Architecture:** pnpm workspaces. `packages/core` = framework-free domain (types + catalog + pure logic, vitest). `apps/web` = Vite + React + TS + Tailwind + React Router; consumes `core`; data behind a `Repository` interface (local impl arrives in M3). UI is a port of the mockup (tokens + components), not a rewrite.

**Tech Stack:** pnpm 10, Node 24, TypeScript 5, Vitest, Vite 5, React 18, Tailwind 3, React Router 6.

Design doc: `docs/superpowers/specs/2026-05-31-holy-oly-app-design.md`. Reference UI: `_mockup/` (keep). This plan covers **M1 (monorepo + core)** and **M2 (design system)**. M3–M5 (Equipo, Drill-down, Asignar plan) get their own plan once this foundation exists.

---

## File Structure

**Root (monorepo):**
- `pnpm-workspace.yaml` — workspace globs (`apps/*`, `packages/*`).
- `package.json` (root, private) — scripts + shared devDeps.
- `tsconfig.base.json` — shared compiler options.

**`packages/core`:**
- `package.json`, `tsconfig.json`, `vitest.config.ts`
- `src/index.ts` — barrel export.
- `src/types/index.ts` — domain types (single source of truth).
- `src/data/macrocycles.ts` — catalog (ported from root `macrocycles.ts`, refactored to import types).
- `src/data/macrocycles.test.ts` — catalog invariants.
- `src/logic/discs.ts` + `discs.test.ts` — plate math (IWF).
- `src/logic/monitor.ts` + `monitor.test.ts` — ACWR / IMR-band / recovery state.
- `src/logic/restructure.ts` + `restructure.test.ts` — competition taper (volume curve).
- `src/repository.ts` — `Repository` interface (no impl here).

**`apps/web`:**
- `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `postcss.config.js`, `tailwind.config.ts`
- `src/main.tsx`, `src/app/App.tsx`, `src/app/router.tsx`
- `src/styles/theme.css` — `wl-*` tokens / 5 skins (ported from `_mockup/wl-themes.css`).
- `src/styles/index.css` — Tailwind layers + base.
- `src/ui/Button.tsx`, `Badge.tsx`, `Card.tsx`, `BottomSheet.tsx`, `Stepper.tsx`, `Chip.tsx`, `WeekPicker.tsx`, `Toast.tsx`
- `src/ui/Disc.tsx`, `Medal.tsx`
- `src/ui/charts/MacroTimeline.tsx`
- `src/ui/__tests__/*.test.tsx` — render smoke tests.
- `src/ui/Gallery.tsx` — temporary route that renders every component (visual verification; removed in M3).

---

## Milestone 1 — Monorepo + `packages/core`

### Task 1: Monorepo workspace scaffold

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create root `package.json`**
```json
{
  "name": "holy-oly",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "dev": "pnpm --filter @holy-oly/web dev",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  },
  "packageManager": "pnpm@10.33.0"
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true
  }
}
```

- [ ] **Step 4: Append to `.gitignore`**
```
node_modules/
dist/
*.tsbuildinfo
```

- [ ] **Step 5: Commit**
```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .gitignore
git commit -m "chore: pnpm monorepo scaffold"
```

### Task 2: `packages/core` package scaffold

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/vitest.config.ts`, `packages/core/src/index.ts`

- [ ] **Step 1: Create `packages/core/package.json`**
```json
{
  "name": "@holy-oly/core",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `packages/core/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/core/vitest.config.ts`**
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node" } });
```

- [ ] **Step 4: Create `packages/core/src/index.ts` (temporary barrel)**
```ts
export {};
```

- [ ] **Step 5: Install from repo root**
Run: `pnpm install`
Expected: workspaces linked, `node_modules/` created, no errors.

- [ ] **Step 6: Commit**
```bash
git add packages/core pnpm-lock.yaml
git commit -m "chore(core): package scaffold + vitest"
```

### Task 3: Domain types

**Files:**
- Create: `packages/core/src/types/index.ts`

- [ ] **Step 1: Write `packages/core/src/types/index.ts`**
```ts
export type Id = string;
export type Estado = "ok" | "warn" | "alert";

export type MacrocycleLevel = "beginner" | "intermediate" | "advanced" | "elite";
export type MacrocycleFamily =
  | "Búlgaro" | "Coreano" | "Chino" | "Cubano" | "Polaco"
  | "Ruso" | "Ucraniano" | "Colombiano" | "Híbrido" | "USA";

export interface MacrocyclePhase {
  key: string; name: string;
  weeks: [number, number];
  imrPct: [number, number];
  volRel: number; focus: string;
}

export interface Macrocycle {
  id: string; name: string; family: MacrocycleFamily; product: "holy-oly";
  desc: string; frequency: string; duration: string;
  intensity: number; volume: number; color: string; bestFor?: string;
  level: MacrocycleLevel; peaks: boolean; peakWeek: number | null;
  phaseProfile: MacrocyclePhase[];
}

export interface Competencia { name: string; week: number; }

export interface Medal {
  comp: string; date: string; cat: string;
  medal: "oro" | "plata" | "bronce";
  sn: number; cj: number; place: string;
}

export interface RM { arranque: number; envion: number; sentadilla: number; frente: number; }

export interface Plan {
  atletaId: Id; macroId: string; startWeek: number;
  rms: RM; comps: Competencia[];
}

export interface MonitorSeries {
  weeks: number;
  acute: number[];
  hrv: number[]; hrvBase: number;
  rhr: number[]; rhrBase: number;
  imr: number[];
  wellness: number[];
}

export type VinculoEstado = "pendiente" | "activo" | "rechazado" | "revocado";
export interface Vinculo {
  id: Id; coachId: Id; atletaId: Id;
  estado: VinculoEstado; iniciadoPor: "atleta";
}

export interface Atleta {
  id: Id; nombre: string; iniciales: string;
  nivel: MacrocycleLevel; macroId?: string; compite?: boolean;
}
```

- [ ] **Step 2: Typecheck**
Run: `pnpm --filter @holy-oly/core typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add packages/core/src/types/index.ts
git commit -m "feat(core): domain types"
```

### Task 4: Port the macrocycle catalog

**Files:**
- Create: `packages/core/src/data/macrocycles.ts` (from existing root `macrocycles.ts`)
- Create: `packages/core/src/data/macrocycles.test.ts`
- Delete: root `macrocycles.ts` (after copy)

- [ ] **Step 1: Write the failing test `packages/core/src/data/macrocycles.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { MACROCYCLES, MACROCYCLE_FAMILIES, phaseForWeek } from "./macrocycles";

describe("catalog", () => {
  it("has 24 programs across 10 families", () => {
    expect(MACROCYCLES).toHaveLength(24);
    expect(MACROCYCLE_FAMILIES).toHaveLength(10);
  });
  it("every program has a non-empty phaseProfile", () => {
    for (const m of MACROCYCLES) expect(m.phaseProfile.length).toBeGreaterThan(0);
  });
  it("phaseForWeek returns the phase whose week range contains the week", () => {
    const ruso = MACROCYCLES.find((m) => m.id === "ruso-5d")!;
    expect(phaseForWeek(ruso, 1)?.key).toBe("hipertrofia");
    expect(phaseForWeek(ruso, 14)?.key).toBe("peaking");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**
Run: `pnpm --filter @holy-oly/core test`
Expected: FAIL — cannot resolve `./macrocycles`.

- [ ] **Step 3: Copy + refactor the catalog file**
Copy the existing root `macrocycles.ts` to `packages/core/src/data/macrocycles.ts`. Then refactor its top so the interfaces come from the types module (delete the inline `export type MacrocycleLevel`, `export interface MacrocyclePhase`, `export interface Macrocycle` definitions and replace with an import):
```ts
import type { Macrocycle, MacrocyclePhase, MacrocycleLevel } from "../types";
```
Keep `MACROCYCLES`, `MACROCYCLE_FAMILIES`, and `phaseForWeek` exactly as they are.

- [ ] **Step 4: Run the test to verify it passes**
Run: `pnpm --filter @holy-oly/core test`
Expected: PASS (3 tests).

- [ ] **Step 5: Remove the old root copy + export from barrel**
Delete root `macrocycles.ts`. Edit `packages/core/src/index.ts`:
```ts
export * from "./types";
export * from "./data/macrocycles";
```

- [ ] **Step 6: Commit**
```bash
git add packages/core/src/data packages/core/src/index.ts macrocycles.ts
git commit -m "feat(core): port macrocycle catalog (24/10) with invariant tests"
```

### Task 5: Plate / disc logic

**Files:**
- Create: `packages/core/src/logic/discs.ts`, `packages/core/src/logic/discs.test.ts`

- [ ] **Step 1: Write the failing test `discs.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { perSide, DISC_COLORS } from "./discs";

describe("perSide (barra 20kg)", () => {
  it("140kg -> 25,25,10 por lado", () => { expect(perSide(140)).toEqual([25, 25, 10]); });
  it("60kg -> 20", () => { expect(perSide(60)).toEqual([20]); });
  it("barra sola o menos -> vacío", () => { expect(perSide(20)).toEqual([]); expect(perSide(24)).toEqual([]); });
  it("respeta barra de 15kg (mujer)", () => { expect(perSide(65, 15)).toEqual([25]); });
  it("solo usa 10/15/20/25", () => {
    for (const d of perSide(137.5)) expect([10,15,20,25]).toContain(d);
  });
  it("tiene colores para cada disco", () => {
    for (const d of [10,15,20,25] as const) expect(DISC_COLORS[d]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/core test discs`
Expected: FAIL — cannot resolve `./discs`.

- [ ] **Step 3: Implement `discs.ts`**
```ts
export type Disc = 10 | 15 | 20 | 25;
export const DISCS: readonly Disc[] = [25, 20, 15, 10];

// [fill, edge, light] — colores IWF. El kg es la verdad; los discos son aproximados.
export const DISC_COLORS: Record<Disc, [string, string, string]> = {
  10: ["#3eb24a", "#2c8a37", "#7fd07f"],
  15: ["#f3c200", "#c79c00", "#ffe46b"],
  20: ["#2f6fa8", "#1d4f7e", "#6fa3cf"],
  25: ["#d5232b", "#a4161d", "#ec6b6f"],
};

/** Discos por lado para `totalKg` con barra `barKg` (20 hombre, 15 mujer). Aproximado. */
export function perSide(totalKg: number, barKg = 20): Disc[] {
  let r = (totalKg - barKg) / 2;
  const out: Disc[] = [];
  if (r < 5) return out;
  for (const p of DISCS) while (r >= p) { out.push(p); r -= p; }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/core test discs`
Expected: PASS.

- [ ] **Step 5: Export + commit**
Add to `src/index.ts`: `export * from "./logic/discs";`
```bash
git add packages/core/src/logic/discs.ts packages/core/src/logic/discs.test.ts packages/core/src/index.ts
git commit -m "feat(core): plate/disc math"
```

### Task 6: Monitor logic (ACWR / IMR band / chronic)

**Files:**
- Create: `packages/core/src/logic/monitor.ts`, `packages/core/src/logic/monitor.test.ts`

- [ ] **Step 1: Write the failing test `monitor.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { acwrState, chronic, acwr, imrBandState } from "./monitor";

describe("monitor", () => {
  it("acwrState: banda segura 0.8–1.3", () => {
    expect(acwrState(1.0)).toBe("ok");
    expect(acwrState(1.4)).toBe("warn");
    expect(acwrState(0.7)).toBe("warn");
    expect(acwrState(1.6)).toBe("alert");
  });
  it("chronic = media móvil de 4 semanas", () => {
    expect(chronic([100, 100, 100, 100])).toEqual([100, 100, 100, 100]);
    expect(chronic([400, 0, 0, 0])[0]).toBe(400);
    expect(chronic([400, 0, 0, 0])[3]).toBe(100);
  });
  it("acwr = aguda / crónica", () => {
    expect(acwr([100, 100, 100, 200])[3]).toBeCloseTo(200 / 125);
  });
  it("imrBandState: warn fuera de la banda esperada (±2)", () => {
    expect(imrBandState(80, [75, 82])).toBe("ok");
    expect(imrBandState(90, [75, 82])).toBe("warn");
    expect(imrBandState(70, [75, 82])).toBe("warn");
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/core test monitor`
Expected: FAIL.

- [ ] **Step 3: Implement `monitor.ts`**
```ts
import type { Estado } from "../types";

export function acwrState(v: number): Estado {
  return v > 1.5 ? "alert" : v > 1.3 || v < 0.8 ? "warn" : "ok";
}

/** Media móvil de 4 semanas (incluye la semana actual). */
export function chronic(acute: number[]): number[] {
  return acute.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - 3); j <= i; j++) { sum += acute[j]!; n++; }
    return sum / n;
  });
}

export function acwr(acute: number[]): number[] {
  const ch = chronic(acute);
  return acute.map((a, i) => a / ch[i]!);
}

/** El IMR está fuera de la banda esperada de la fase (margen ±2). */
export function imrBandState(imr: number, band: [number, number]): Estado {
  return imr > band[1] + 2 || imr < band[0] - 2 ? "warn" : "ok";
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/core test monitor`
Expected: PASS.

- [ ] **Step 5: Export + commit**
Add to `src/index.ts`: `export * from "./logic/monitor";`
```bash
git add packages/core/src/logic/monitor.ts packages/core/src/logic/monitor.test.ts packages/core/src/index.ts
git commit -m "feat(core): monitor (ACWR / chronic / IMR band)"
```

### Task 7: Restructure logic (competition taper)

**Files:**
- Create: `packages/core/src/logic/restructure.ts`, `packages/core/src/logic/restructure.test.ts`

- [ ] **Step 1: Write the failing test `restructure.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { volumeCurve, isTaperWeek } from "./restructure";

const flat = () => 100; // volumen base constante para aislar el taper

describe("restructure", () => {
  it("1 competencia: adelanta la bajada de volumen a las ~3 semanas previas", () => {
    const v = volumeCurve(16, [{ week: 12, name: "A" }], flat);
    expect(v[11]).toBe(26); // sem 12 (semana de comp)
    expect(v[10]).toBe(26); // sem 11
    expect(v[9]).toBe(40);  // sem 10
    expect(v[8]).toBe(56);  // sem 9
    expect(v[7]).toBe(100); // sem 8 (fuera del taper)
    expect(v[15]).toBe(55); // sem 16 post-competencia (ligero)
  });
  it("varias competencias: repite la bajada antes de cada una", () => {
    const v = volumeCurve(16, [{ week: 12, name: "A" }, { week: 16, name: "B" }], flat);
    expect(v[11]).toBe(26); // taper A
    expect(v[15]).toBe(26); // taper B
    expect(v[7]).toBe(100);
  });
  it("isTaperWeek marca las 2 semanas previas + la de la competencia", () => {
    const comps = [{ week: 12, name: "A" }];
    expect(isTaperWeek(12, comps)).toBe(true);
    expect(isTaperWeek(10, comps)).toBe(true);
    expect(isTaperWeek(9, comps)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/core test restructure`
Expected: FAIL.

- [ ] **Step 3: Implement `restructure.ts`**
```ts
import type { Competencia } from "../types";

/**
 * Curva de volumen relativo por semana (1..weeks). `baseAt(w)` da el volumen base
 * del macro. Antes de CADA competencia se baja el volumen (taper); con varias
 * competencias el taper se repite. Después de la última, semanas ligeras.
 */
export function volumeCurve(
  weeks: number,
  comps: Competencia[],
  baseAt: (w: number) => number
): number[] {
  const last = comps.reduce((m, c) => Math.max(m, c.week), 0);
  const out: number[] = [];
  for (let w = 1; w <= weeks; w++) {
    let v = baseAt(w);
    for (const c of comps) {
      const dd = c.week - w;
      if (dd >= 0 && dd <= 3) {
        const cap = dd <= 1 ? 26 : dd <= 2 ? 40 : 56;
        if (cap < v) v = cap;
      }
    }
    if (last && w > last) v = Math.min(v, baseAt(w) * 0.55);
    out.push(v);
  }
  return out;
}

export function isTaperWeek(w: number, comps: Competencia[]): boolean {
  return comps.some((c) => w >= c.week - 2 && w <= c.week);
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/core test restructure`
Expected: PASS.

- [ ] **Step 5: Export + commit**
Add to `src/index.ts`: `export * from "./logic/restructure";`
```bash
git add packages/core/src/logic/restructure.ts packages/core/src/logic/restructure.test.ts packages/core/src/index.ts
git commit -m "feat(core): competition restructure (volume taper)"
```

### Task 8: Repository interface

**Files:**
- Create: `packages/core/src/repository.ts`

- [ ] **Step 1: Write `repository.ts`**
```ts
import type { Atleta, Plan, Medal, Competencia, MonitorSeries } from "./types";

export interface Repository {
  getRoster(): Promise<Atleta[]>;
  getAthlete(id: string): Promise<Atleta | undefined>;
  getSeries(id: string): Promise<MonitorSeries>;
  getPlan(id: string): Promise<Plan | undefined>;
  savePlan(plan: Plan): Promise<void>;
  getMedals(id: string): Promise<Medal[]>;
  addMedal(id: string, medal: Medal): Promise<void>;
  getComps(id: string): Promise<Competencia[]>;
  setComps(id: string, comps: Competencia[]): Promise<void>;
}
```

- [ ] **Step 2: Export, typecheck, full test run**
Add to `src/index.ts`: `export * from "./repository";`
Run: `pnpm --filter @holy-oly/core typecheck && pnpm --filter @holy-oly/core test`
Expected: typecheck clean; all suites PASS.

- [ ] **Step 3: Commit + push milestone**
```bash
git add packages/core/src/repository.ts packages/core/src/index.ts
git commit -m "feat(core): Repository interface"
git push origin main
```

**M1 done when:** `pnpm -r test` is green and `@holy-oly/core` exports types + catalog + discs/monitor/restructure + `Repository`.

---

## Milestone 2 — Design system (`apps/web`)

### Task 9: Scaffold `apps/web` (Vite + React + TS + Tailwind + Router)

**Files:**
- Create: `apps/web/package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `postcss.config.js`, `tailwind.config.ts`, `src/main.tsx`, `src/app/App.tsx`, `src/app/router.tsx`, `src/styles/index.css`

- [ ] **Step 1: Create `apps/web/package.json`**
```json
{
  "name": "@holy-oly/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 8743",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@holy-oly/core": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/vite.config.ts`**
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 8743 },
  test: { environment: "jsdom", globals: true, setupFiles: "./src/test-setup.ts" },
});
```

- [ ] **Step 3: Create `apps/web/tsconfig.json` and `tsconfig.node.json`**
`tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "noEmit": true, "types": ["vitest/globals", "@testing-library/jest-dom"] },
  "include": ["src"]
}
```
`tsconfig.node.json`:
```json
{ "compilerOptions": { "composite": true, "module": "ESNext", "moduleResolution": "Bundler" }, "include": ["vite.config.ts"] }
```

- [ ] **Step 4: Create `index.html`**
```html
<!doctype html>
<html lang="es" class="wl wl--neon">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Holy Oly</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `postcss.config.js` + `tailwind.config.ts`**
`postcss.config.js`:
```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } };
```
`tailwind.config.ts`:
```ts
import type { Config } from "tailwindcss";
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        wl: {
          bg: "var(--wl-bg)", surface: "var(--wl-surface)",
          text: "var(--wl-text)", muted: "var(--wl-muted)", accent: "var(--wl-accent)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Create `src/styles/index.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
@import "./theme.css";
:root { color-scheme: dark; }
body { margin: 0; background: var(--wl-bg); color: var(--wl-text); font-family: Manrope, system-ui, sans-serif; }
```

- [ ] **Step 7: Create `src/main.tsx`, `src/app/App.tsx`, `src/app/router.tsx`, `src/test-setup.ts`**
`src/test-setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```
`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import "./styles/index.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>
);
```
`src/app/App.tsx`:
```tsx
import { Outlet } from "react-router-dom";
export function App() { return <Outlet />; }
```
`src/app/router.tsx`:
```tsx
import { createBrowserRouter } from "react-router-dom";
import { App } from "./App";
import { Gallery } from "../ui/Gallery";
export const router = createBrowserRouter([
  { path: "/", element: <App />, children: [{ index: true, element: <Gallery /> }] },
]);
```

- [ ] **Step 8: Temporary `src/ui/Gallery.tsx`**
```tsx
export function Gallery() {
  return <div style={{ padding: 24 }}><h1 className="text-wl-accent">Holy Oly · gallery</h1></div>;
}
```

- [ ] **Step 9: Install + run dev once to verify boot**
Run: `pnpm install` then `pnpm --filter @holy-oly/web dev`
Expected: Vite serves on :8743; page shows "Holy Oly · gallery" in accent color. Stop the server.

- [ ] **Step 10: Commit**
```bash
git add apps/web pnpm-lock.yaml
git commit -m "chore(web): Vite + React + TS + Tailwind + Router scaffold"
```

### Task 10: Port theme tokens (`wl-themes` → `theme.css`)

**Files:**
- Create: `apps/web/src/styles/theme.css` (from `_mockup/wl-themes.css`)

- [ ] **Step 1: Copy the tokens file**
Copy `_mockup/wl-themes.css` to `apps/web/src/styles/theme.css` verbatim (it defines `--wl-*` vars under `.wl--plates/.wl--neon/.wl--chalk/.wl--premium/.wl--neonlight`). No edits needed; `index.html` sets `class="wl wl--neon"` (default Neon PR).

- [ ] **Step 2: Verify in dev**
Run: `pnpm --filter @holy-oly/web dev`
Expected: background/text use Neon PR tokens (dark `#120a16`-ish, lime accent). Stop server.

- [ ] **Step 3: Commit**
```bash
git add apps/web/src/styles/theme.css
git commit -m "feat(web): port wl-themes tokens (5 skins, default Neon PR)"
```

### Task 11: Primitive components

> Port from `_mockup` (`wl-controls.jsx` + the screens' markup). Each is a small focused file in `src/ui/`. Below: `Button` and `Badge` in full as the pattern; the rest follow identically (one component, token-driven classes, props for variants). Verify all in the Gallery (Task 14).

**Files:**
- Create: `src/ui/Button.tsx`, `src/ui/Badge.tsx`, `src/ui/Card.tsx`, `src/ui/Chip.tsx`, `src/ui/Stepper.tsx`, `src/ui/WeekPicker.tsx`, `src/ui/BottomSheet.tsx`, `src/ui/Toast.tsx`
- Test: `src/ui/__tests__/primitives.test.tsx`

- [ ] **Step 1: `src/ui/Button.tsx`**
```tsx
import type { ReactNode } from "react";
export function Button({ children, onClick, variant = "primary" }:
  { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" }) {
  const base = "font-display font-extrabold rounded-xl px-4 py-3 cursor-pointer border-0";
  const styles = variant === "primary"
    ? { background: "var(--wl-accent)", color: "var(--wl-bg)" }
    : { background: "transparent", color: "var(--wl-text)", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)" };
  return <button className={base} style={styles} onClick={onClick}>{children}</button>;
}
```

- [ ] **Step 2: `src/ui/Badge.tsx`**
```tsx
import type { ReactNode } from "react";
const TONES: Record<string, string> = { ok: "#1bc98a", warn: "#ffab2e", alert: "#ff3b46" };
export function Badge({ children, tone }: { children: ReactNode; tone?: "ok" | "warn" | "alert" }) {
  const c = tone ? TONES[tone] : "var(--wl-accent)";
  return <span style={{ color: c, border: `1px solid ${c}55`, background: `${c}1f`,
    fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99 }}>{children}</span>;
}
```

- [ ] **Step 3: Create the remaining primitives**
Create `Card`, `Chip`, `Stepper` (−/value/+, props `value/onChange/step`), `WeekPicker` (row of week buttons 1..n, `value/onChange`), `BottomSheet` (`open/onClose/children`, absolute overlay + bottom panel — port `.msheet` markup/CSS to inline styles or a `bottom-sheet.css`), `Toast` (`message/show`). Each reads `--wl-*` tokens; mirror the look in `_mockup/coach.html` / `index.html` / `coach-plan.html`.

- [ ] **Step 4: Write smoke test `src/ui/__tests__/primitives.test.tsx`**
```tsx
import { render, screen } from "@testing-library/react";
import { Button } from "../Button";
import { Badge } from "../Badge";
test("Button renders its label", () => {
  render(<Button>Empezar</Button>);
  expect(screen.getByText("Empezar")).toBeInTheDocument();
});
test("Badge renders with tone", () => {
  render(<Badge tone="warn">Vigilar</Badge>);
  expect(screen.getByText("Vigilar")).toBeInTheDocument();
});
```

- [ ] **Step 5: Run tests + commit**
Run: `pnpm --filter @holy-oly/web test`
Expected: PASS.
```bash
git add apps/web/src/ui
git commit -m "feat(web): primitive components (Button/Badge/Card/Chip/Stepper/WeekPicker/BottomSheet/Toast)"
```

### Task 12: `Disc` component (consumes `core`)

**Files:**
- Create: `src/ui/Disc.tsx`, `src/ui/__tests__/disc.test.tsx`

- [ ] **Step 1: Write the failing test `disc.test.tsx`**
```tsx
import { render } from "@testing-library/react";
import { DiscRow } from "../Disc";
test("DiscRow renders one svg per plate for 140kg (3 per side)", () => {
  const { container } = render(<DiscRow kg={140} />);
  expect(container.querySelectorAll("svg").length).toBe(3);
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/web test disc`
Expected: FAIL — no `Disc`.

- [ ] **Step 3: Implement `src/ui/Disc.tsx`**
```tsx
import { perSide, DISC_COLORS, type Disc as DiscW } from "@holy-oly/core";

export function Disc({ w, size = 28 }: { w: DiscW; size?: number }) {
  const [fill, edge, light] = DISC_COLORS[w];
  const id = `d${w}-${Math.round(size)}`;
  const numColor = w === 15 ? "#3a2a00" : "#fff";
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} style={{ display: "block" }}>
      <defs><radialGradient id={id} cx="42%" cy="34%" r="75%">
        <stop offset="0" stopColor={light} /><stop offset="55%" stopColor={fill} /><stop offset="100%" stopColor={edge} />
      </radialGradient></defs>
      <circle cx="16" cy="16" r="15" fill={edge} />
      <circle cx="16" cy="16" r="14" fill={`url(#${id})`} />
      <circle cx="16" cy="16" r="6" fill="#dde0e4" stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      <circle cx="16" cy="16" r="1.9" fill="#33363a" />
      <text x="16" y="10.5" textAnchor="middle" fontSize="6.4" fontWeight="800" fill={numColor} fontFamily="Saira Condensed, sans-serif">{w}</text>
    </svg>
  );
}

export function DiscRow({ kg, barKg = 20 }: { kg: number; barKg?: number }) {
  const discs = perSide(kg, barKg);
  return <div style={{ display: "flex", gap: 3, alignItems: "center" }}>{discs.map((d, i) => <Disc key={i} w={d} />)}</div>;
}
```

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/web test disc`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/ui/Disc.tsx apps/web/src/ui/__tests__/disc.test.tsx
git commit -m "feat(web): Disc/DiscRow (uses core.perSide)"
```

### Task 13: `Medal` component (port `medals.js`)

**Files:**
- Create: `src/ui/Medal.tsx`, `src/ui/__tests__/medal.test.tsx`

- [ ] **Step 1: Write the failing test `medal.test.tsx`**
```tsx
import { render } from "@testing-library/react";
import { Medal } from "../Medal";
test("Medal renders an svg for each metal", () => {
  for (const k of ["oro", "plata", "bronce"] as const) {
    const { container } = render(<Medal metal={k} size={40} />);
    expect(container.querySelector("svg")).toBeTruthy();
  }
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/web test medal`
Expected: FAIL.

- [ ] **Step 3: Implement `src/ui/Medal.tsx`**
Port the `HOmedal(key, S)` SVG builder from `_mockup/medals.js` into a React component: a `METALS` palette map (oro/plata/bronce), `<defs>` with the three gradients (unique ids per render via `useId()`), the blue/white ribbon rects, and the disc circles. Signature: `Medal({ metal, size = 40 })`. Return the same SVG markup as the mockup, as JSX.

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/web test medal`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/ui/Medal.tsx apps/web/src/ui/__tests__/medal.test.tsx
git commit -m "feat(web): Medal component (port medals.js)"
```

### Task 14: `MacroTimeline` chart + Gallery + milestone push

**Files:**
- Create: `src/ui/charts/MacroTimeline.tsx`, `src/ui/__tests__/macro-timeline.test.tsx`
- Modify: `src/ui/Gallery.tsx`

- [ ] **Step 1: Write the failing test `macro-timeline.test.tsx`**
```tsx
import { render } from "@testing-library/react";
import { MacroTimeline } from "../charts/MacroTimeline";
test("renders one flag per competition", () => {
  const { container } = render(<MacroTimeline weeks={16} hoy={12} comps={[{ name: "A", week: 12 }, { name: "B", week: 16 }]} />);
  // 2 flag labels (🚩 text nodes)
  const flags = [...container.querySelectorAll("text")].filter((t) => t.textContent === "🚩");
  expect(flags.length).toBe(2);
});
```

- [ ] **Step 2: Run to verify it fails**
Run: `pnpm --filter @holy-oly/web test macro-timeline`
Expected: FAIL.

- [ ] **Step 3: Implement `src/ui/charts/MacroTimeline.tsx`**
Port `chartMacro` from `_mockup/coach.html` into a React SVG component. Props: `{ weeks: number; hoy: number; comps: Competencia[] }`. Use `core`'s `volumeCurve` (with a base wave) and `isTaperWeek` for the bars (highlight taper weeks in alert color), an intensity line peaking at each comp, a HOY divider, and one 🚩 + label per competition. Tokens for colors (`var(--wl-accent)`, `var(--wl-text)`); state color for flags/taper.

- [ ] **Step 4: Run to verify it passes**
Run: `pnpm --filter @holy-oly/web test macro-timeline`
Expected: PASS.

- [ ] **Step 5: Wire the Gallery to show every component**
Edit `src/ui/Gallery.tsx` to render, in a phone-width column: theme switch (set `document.documentElement.className`), `Button`/`Badge`/`Card`/`Chip`/`Stepper`/`WeekPicker`, a `DiscRow kg={140}`, the three `Medal`s, and `MacroTimeline` with 2 comps. This is the visual smoke screen.

- [ ] **Step 6: Visual verify**
Run: `pnpm --filter @holy-oly/web dev` → open :8743. Confirm: discs render with IWF colors, medals render gold/silver/bronze with ribbon, macro timeline shows 2 taper windows + 2 flags, theme switch swaps all tokens. Stop server.

- [ ] **Step 7: Full test run + commit + push milestone**
Run: `pnpm -r test`
Expected: all core + web suites PASS.
```bash
git add apps/web/src/ui/charts apps/web/src/ui/Gallery.tsx apps/web/src/ui/__tests__/macro-timeline.test.tsx
git commit -m "feat(web): MacroTimeline chart + component gallery"
git push origin main
```

**M2 done when:** `pnpm -r test` is green, `pnpm --filter @holy-oly/web dev` boots, and the Gallery shows the tokens + primitives + Disc + Medal + MacroTimeline in Neon PR (and theme switch works).

---

## Next plan (M3–M5)
Once this foundation is green: `LocalRepository` (seeds: roster + per-athlete series + catalog), then **M3 Equipo** (heatmap + risk quadrant), **M4 Drill-down** (8 charts + palmarés + asignar competencia/restructure, reusing `MacroTimeline`), **M5 Asignar plan** (RM + macro + start week). These get their own plan file referencing this one.

## Self-review notes
- Spec coverage: M1 covers core (types, catalog 24/10, discs, monitor, restructure, Repository); M2 covers the design-system port (tokens + primitives + Disc/Medal/chart). Screens (Equipo/Drill-down/Asignar plan) are explicitly deferred to the M3–M5 plan — consistent with the design doc's slice sequencing.
- Type consistency: `Disc`, `Estado`, `Competencia`, `Macrocycle`, `Repository` names match between core tasks and their web consumers (Disc, MacroTimeline).
- Placeholders: component-heavy steps (Task 11 remaining primitives, Task 13 Medal port, Task 14 MacroTimeline port) reference exact mockup sources to port from rather than inlining 100+ lines; the testable contracts (props, test assertions) are concrete.
