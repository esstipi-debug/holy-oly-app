# Tour de onboarding de primera vez — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una tarjeta-guía de navegación on-brand la primera vez que un coach o atleta real (modo `API_ENABLED`) entra a su pantalla principal; se descarta una vez y no vuelve.

**Architecture:** Un componente presentacional compartido `OnboardingCard` (chrome de tarjeta inferior, look del `DemoTourCard` existente) + persistencia pura por-usuario en `localStorage` (`onboardingSeen.ts`) + contenido por rol en `steps.ts`. Se monta en `Equipo` (coach) y `HomeScreen` (atleta), gateado a `API_ENABLED && user`, mutuamente excluyente con el `DemoTourCard` de demo (`!API_ENABLED`).

**Tech Stack:** React 19 + TypeScript, Vite, Vitest + React Testing Library, tokens CSS `--wl-*`.

**Spec:** `docs/superpowers/specs/2026-06-08-onboarding-tour-design.md`

**Convenciones del repo (respetarlas):**
- Tests usan `MemStorage` de `apps/web/src/test-utils/MemStorage` y `fireEvent` (no `userEvent`) — seguir el patrón de `DemoTourCard.test.tsx`.
- Estilos inline con tokens `--wl-*` (el repo no usa CSS modules para estas tarjetas).
- Comandos (desde la raíz del repo):
  - Un test: `pnpm --filter @holy-oly/web exec vitest run <ruta>`
  - Todos los de web: `pnpm --filter @holy-oly/web test`
  - Typecheck: `pnpm --filter @holy-oly/web typecheck`
  - Lint: `pnpm lint`
  - Build web: `pnpm --filter @holy-oly/web build`
- No agregar línea `Co-Authored-By` en los commits (atribución desactivada globalmente por el usuario).

---

## File Structure

Nuevos:
- `apps/web/src/onboarding/onboardingSeen.ts` — persistencia pura (key por usuario, get/set, degradación segura).
- `apps/web/src/onboarding/steps.ts` — títulos + pasos por rol (constantes).
- `apps/web/src/onboarding/OnboardingCard.tsx` — tarjeta presentacional genérica.
- `apps/web/src/onboarding/__tests__/onboardingSeen.test.ts`
- `apps/web/src/onboarding/__tests__/OnboardingCard.test.tsx`
- `apps/web/src/screens/coach/__tests__/equipo.onboarding.test.tsx`
- `apps/web/src/screens/atleta/__tests__/home.onboarding.test.tsx`

Modificados:
- `apps/web/src/screens/coach/Equipo.tsx` — montar `OnboardingCard` (coach).
- `apps/web/src/screens/atleta/HomeScreen.tsx` — montar `OnboardingCard` (atleta).

---

### Task 1: Persistencia pura (`onboardingSeen.ts`)

**Files:**
- Create: `apps/web/src/onboarding/onboardingSeen.ts`
- Test: `apps/web/src/onboarding/__tests__/onboardingSeen.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/onboarding/__tests__/onboardingSeen.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MemStorage } from "../../test-utils/MemStorage";
import { onboardingKey, isOnboardingSeen, markOnboardingSeen } from "../onboardingSeen";

describe("onboardingSeen", () => {
  it("builds a per-user key under the ho: namespace", () => {
    expect(onboardingKey("user-123")).toBe("ho:onboard:user-123");
  });

  it("round-trips unseen -> seen for a given key", () => {
    const s = new MemStorage();
    const key = onboardingKey("u1");
    expect(isOnboardingSeen(s, key)).toBe(false);
    markOnboardingSeen(s, key);
    expect(isOnboardingSeen(s, key)).toBe(true);
  });

  it("keeps users isolated (one seen does not mark another)", () => {
    const s = new MemStorage();
    markOnboardingSeen(s, onboardingKey("u1"));
    expect(isOnboardingSeen(s, onboardingKey("u2"))).toBe(false);
  });

  it("degrades to seen=true when storage reads throw (private mode)", () => {
    const throwing: Storage = {
      get length() { return 0; },
      clear() {},
      getItem() { throw new Error("blocked"); },
      key() { return null; },
      removeItem() {},
      setItem() {},
    };
    expect(isOnboardingSeen(throwing, "ho:onboard:x")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/web exec vitest run src/onboarding/__tests__/onboardingSeen.test.ts`
Expected: FAIL — `Cannot find module '../onboardingSeen'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/onboarding/onboardingSeen.ts`:

```ts
/**
 * First-time onboarding "visto" flag, keyed per user so coach/atleta on the same device
 * (and distinct real users) each get their own tour. Pure given the Storage passed in.
 * Mirrors the demo-tour persistence (`data/demoTour.ts`) but lives in the onboarding module
 * and is namespaced separately so the demo reset never touches real-user onboarding.
 */
export function onboardingKey(userId: string): string {
  return `ho:onboard:${userId}`;
}

export function isOnboardingSeen(storage: Storage, key: string): boolean {
  try {
    return storage.getItem(key) === "1";
  } catch {
    // Storage unavailable (private mode, disabled): degrade to "seen" so we never block
    // the screen by repeatedly trying to show the card.
    return true;
  }
}

export function markOnboardingSeen(storage: Storage, key: string): void {
  try {
    storage.setItem(key, "1");
  } catch {
    // Best-effort: if we can't persist, the card may reappear next mount — acceptable.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/onboarding/__tests__/onboardingSeen.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/onboarding/onboardingSeen.ts apps/web/src/onboarding/__tests__/onboardingSeen.test.ts
git commit -m "feat(onboarding): persistencia pura del flag de primera vez por usuario"
```

---

### Task 2: Contenido por rol (`steps.ts`)

**Files:**
- Create: `apps/web/src/onboarding/steps.ts`

No lleva test propio: son constantes, y quedan ejercitadas por los tests de integración (Tasks 4 y 5) que renderizan con estos arrays reales y asertan un texto.

- [ ] **Step 1: Create the content module**

Create `apps/web/src/onboarding/steps.ts`:

```ts
/**
 * First-time onboarding copy, separated from the card render so the wording can change
 * without touching the component. Contract: a short title + a list of 4 short steps per role.
 */
export const ONBOARDING_TITLE_COACH = "Bienvenido — así te movés acá";
export const ONBOARDING_TITLE_ATLETA = "Bienvenido — así te movés acá";

export const COACH_STEPS: readonly string[] = [
  "Este es tu Plantel: cada atleta y su estado de readiness (verde / ámbar / rojo).",
  "Tocá un atleta para ver su detalle: carga, recuperación y progreso del año.",
  "En Macros elegís un macrociclo y se lo asignás a un atleta.",
  "En Invitaciones compartís tu código para que tus atletas se vinculen.",
];

export const ATLETA_STEPS: readonly string[] = [
  "Esto es Hoy: tu check-in de bienestar y tu plan del día.",
  "Tocá «Iniciar entrenamiento» y registrás serie por serie; los discos te muestran cómo cargar la barra.",
  "En Mi progreso seguís tu evolución.",
  "En Cuenta están tus datos y tu coach vinculado.",
];
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @holy-oly/web typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/onboarding/steps.ts
git commit -m "feat(onboarding): copy de los pasos por rol (coach + atleta)"
```

---

### Task 3: Tarjeta presentacional (`OnboardingCard.tsx`)

**Files:**
- Create: `apps/web/src/onboarding/OnboardingCard.tsx`
- Test: `apps/web/src/onboarding/__tests__/OnboardingCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/onboarding/__tests__/OnboardingCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemStorage } from "../../test-utils/MemStorage";
import { isOnboardingSeen } from "../onboardingSeen";
import { OnboardingCard } from "../OnboardingCard";

const STEPS = ["Primer paso de prueba", "Segundo paso de prueba"];

describe("OnboardingCard", () => {
  it("shows the title and every step when unseen", () => {
    const s = new MemStorage();
    render(<OnboardingCard title="Bienvenido test" steps={STEPS} storageKey="ho:onboard:u1" storage={s} />);
    expect(screen.getByTestId("onboarding-card")).toBeInTheDocument();
    expect(screen.getByText("Bienvenido test")).toBeInTheDocument();
    expect(screen.getByText("Primer paso de prueba")).toBeInTheDocument();
    expect(screen.getByText("Segundo paso de prueba")).toBeInTheDocument();
  });

  it("renders nothing when already seen", () => {
    const s = new MemStorage();
    s.setItem("ho:onboard:u1", "1");
    const { container } = render(<OnboardingCard title="x" steps={STEPS} storageKey="ho:onboard:u1" storage={s} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("dismiss persists the seen flag, fires onDismiss, and hides", () => {
    const s = new MemStorage();
    const onDismiss = vi.fn();
    render(<OnboardingCard title="x" steps={STEPS} storageKey="ho:onboard:u1" storage={s} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /Entendido/i }));
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
    expect(isOnboardingSeen(s, "ho:onboard:u1")).toBe(true);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/web exec vitest run src/onboarding/__tests__/OnboardingCard.test.tsx`
Expected: FAIL — `Cannot find module '../OnboardingCard'`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/onboarding/OnboardingCard.tsx` (chrome y estilos espejan `DemoTourCard.tsx`; el spacer in-flow evita que la tarjeta `position:fixed` atrape el último contenido):

```tsx
/**
 * First-time onboarding guide as a single on-brand bottom card (same visual language as the
 * demo tour card — NOT a spotlight cutout, which the system avoids). Lists the role's key
 * navigation spots, then dismisses (persisting the per-user `ho:onboard:<id>` flag so it never
 * reappears). Generic + presentational: the caller supplies title, steps and the resolved key.
 */
import { useState } from "react";
import { isOnboardingSeen, markOnboardingSeen } from "./onboardingSeen";

interface OnboardingCardProps {
  title: string;
  steps: readonly string[];
  storageKey: string;
  storage?: Storage;
  onDismiss?: () => void;
}

export function OnboardingCard({ title, steps, storageKey, storage = window.localStorage, onDismiss }: OnboardingCardProps) {
  const [open, setOpen] = useState(() => !isOnboardingSeen(storage, storageKey));
  if (!open) return null;

  const dismiss = () => {
    markOnboardingSeen(storage, storageKey);
    setOpen(false);
    onDismiss?.();
  };

  return (
    <>
      {/* In-flow spacer so the position:fixed card never traps the last element of the screen
          underneath it. Sits next to the card in the scroll flow, so it vanishes WITH the card
          on dismiss (no desync). Matches the DemoTourCard spacer criterion. */}
      <div aria-hidden style={{ height: 280 }} />
      <section
        aria-label="Guía de primera vez"
        data-testid="onboarding-card"
        style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, width: "min(92vw, 400px)", zIndex: 50, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", borderRadius: 12, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}
      >
        <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--wl-muted)" }}>Primeros pasos</div>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 17, margin: "4px 0 10px", lineHeight: 1.05 }}>{title}</div>
        <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
          {steps.map((s, i) => (
            <li key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: 12.5, color: "var(--wl-text)", lineHeight: 1.35 }}>
              <span style={{ flex: "0 0 auto", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 12, color: "var(--wl-accent)" }}>{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={dismiss}
          style={{ minHeight: 44, width: "100%", marginTop: 12, borderRadius: 9, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
        >
          Entendido, empezar
        </button>
      </section>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/onboarding/__tests__/OnboardingCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/onboarding/OnboardingCard.tsx apps/web/src/onboarding/__tests__/OnboardingCard.test.tsx
git commit -m "feat(onboarding): tarjeta-guía presentacional de primera vez"
```

---

### Task 4: Montar en el coach (`Equipo.tsx`)

**Files:**
- Modify: `apps/web/src/screens/coach/Equipo.tsx`
- Test: `apps/web/src/screens/coach/__tests__/equipo.onboarding.test.tsx` (archivo nuevo, separado de `equipo.test.tsx` para no romper los tests de modo demo que dependen de `API_ENABLED=false`)

- [ ] **Step 1: Write the failing integration test**

Create `apps/web/src/screens/coach/__tests__/equipo.onboarding.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";

// Force real-user mode so the onboarding card (API_ENABLED) renders and the demo card does not.
vi.mock("../../../data/apiConfig", () => ({ API_ENABLED: true, API_BASE: "" }));

// Mockable auth: each test sets what useAuth returns before rendering.
const useAuthMock = vi.fn();
vi.mock("../../../auth/AuthContext", () => ({ useAuth: () => useAuthMock() }));

import { Equipo } from "../Equipo";

function renderEquipo() {
  const repo = new LocalRepository(new MemStorage());
  return render(
    <RepositoryProvider repo={repo}>
      <MemoryRouter initialEntries={["/coach"]}>
        <Routes>
          <Route path="/coach" element={<Equipo />} />
          <Route path="/coach/a/:id" element={<div>DRILLDOWN</div>} />
        </Routes>
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

describe("Equipo onboarding (real-user mode)", () => {
  it("shows the coach onboarding card when API is enabled and a user is signed in", async () => {
    useAuthMock.mockReturnValue({ user: { id: "coach-1" } });
    renderEquipo();
    await screen.findByText(/MEJOR READINESS/i); // roster loaded
    expect(screen.getByTestId("onboarding-card")).toBeInTheDocument();
    expect(screen.getByText(/Este es tu Plantel/)).toBeInTheDocument();
  });

  it("does not show the onboarding card when there is no signed-in user", async () => {
    useAuthMock.mockReturnValue({ user: null });
    renderEquipo();
    await screen.findByText(/MEJOR READINESS/i);
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/coach/__tests__/equipo.onboarding.test.tsx`
Expected: FAIL — `onboarding-card` not found (Equipo doesn't render it yet).

- [ ] **Step 3: Wire the card into Equipo**

In `apps/web/src/screens/coach/Equipo.tsx`:

(a) Add imports after the existing import block (the `resetDemo` import is around line 11):

```tsx
import { useAuth } from "../../auth/AuthContext";
import { OnboardingCard } from "../../onboarding/OnboardingCard";
import { onboardingKey } from "../../onboarding/onboardingSeen";
import { COACH_STEPS, ONBOARDING_TITLE_COACH } from "../../onboarding/steps";
```

(b) Inside `export function Equipo()`, read the user right after `const navigate = useNavigate();`:

```tsx
  const { user } = useAuth();
```

(c) Replace the final demo-card line:

```tsx
      {!API_ENABLED && <DemoTourCard />}
```

with both cards (mutually exclusive):

```tsx
      {!API_ENABLED && <DemoTourCard />}
      {API_ENABLED && user && (
        <OnboardingCard
          title={ONBOARDING_TITLE_COACH}
          steps={COACH_STEPS}
          storageKey={onboardingKey(user.id)}
        />
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/coach/__tests__/equipo.onboarding.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify the existing demo tests still pass**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/coach/__tests__/equipo.test.tsx`
Expected: PASS (the original 5 tests — the new test file's `vi.mock` does not leak across files).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/screens/coach/Equipo.tsx apps/web/src/screens/coach/__tests__/equipo.onboarding.test.tsx
git commit -m "feat(onboarding): montar la guía de primera vez en el plantel del coach"
```

---

### Task 5: Montar en el atleta (`HomeScreen.tsx`)

**Files:**
- Modify: `apps/web/src/screens/atleta/HomeScreen.tsx`
- Test: `apps/web/src/screens/atleta/__tests__/home.onboarding.test.tsx` (archivo nuevo)

**Nota:** `HomeScreen` carga datos vía un `client` inyectable (`MeClient`) y muestra "Cargando…" hasta resolver. El test inyecta un `client` stub con respuestas mínimas para llegar al estado `ready`. Verificá las firmas reales de `MeClient` (`getMePlan`, `getMeSeries`, `getDayLog`) en `apps/web/src/data/meClient.ts` y ajustá el stub para que tipechee; abajo va un stub plausible — si una forma difiere, alineala con el tipo real (no cambies el componente para acomodar el test).

- [ ] **Step 1: Write the failing integration test**

Create `apps/web/src/screens/atleta/__tests__/home.onboarding.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { MeClient } from "../../../data/meClient";

vi.mock("../../../data/apiConfig", () => ({ API_ENABLED: true, API_BASE: "" }));

const useAuthMock = vi.fn();
vi.mock("../../../auth/AuthContext", () => ({ useAuth: () => useAuthMock() }));

import { HomeScreen } from "../HomeScreen";

// Minimal MeClient stub that lands HomeScreen in the "ready" state (plan + daylog present).
// Align field shapes with the real MePlanView / DayLogView / MonitorSeries if tsc complains.
function stubClient(): MeClient {
  return {
    getMePlan: async () => ({ athlete: { nombre: "Ana Test" }, plan: null }),
    getMeSeries: async () => undefined,
    getDayLog: async () => ({ entry: null, streak: 0, days: [], today: "2026-06-08" }),
    putDayLog: async () => {},
  } as unknown as MeClient;
}

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/atleta"]}>
      <HomeScreen client={stubClient()} variant="tap" />
    </MemoryRouter>,
  );
}

describe("HomeScreen onboarding (real-user mode)", () => {
  it("shows the athlete onboarding card when API is enabled and a user is signed in", async () => {
    useAuthMock.mockReturnValue({ user: { id: "atleta-1" } });
    renderHome();
    await screen.findByText(/Hola, Ana/); // home rendered (ready state)
    expect(screen.getByTestId("onboarding-card")).toBeInTheDocument();
    expect(screen.getByText(/Esto es Hoy/)).toBeInTheDocument();
  });

  it("does not show the onboarding card when there is no signed-in user", async () => {
    useAuthMock.mockReturnValue({ user: null });
    renderHome();
    await screen.findByText(/Hola, Ana/);
    expect(screen.queryByTestId("onboarding-card")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/home.onboarding.test.tsx`
Expected: FAIL — `onboarding-card` not found (HomeScreen doesn't render it yet). If it fails instead on the stub not reaching "ready" (`Hola, Ana` missing), fix the stub shapes against the real `MeClient` types before continuing.

- [ ] **Step 3: Wire the card into HomeScreen**

In `apps/web/src/screens/atleta/HomeScreen.tsx`:

(a) Add imports (after the existing import block, around line 12):

```tsx
import { useAuth } from "../../auth/AuthContext";
import { API_ENABLED } from "../../data/apiConfig";
import { OnboardingCard } from "../../onboarding/OnboardingCard";
import { onboardingKey } from "../../onboarding/onboardingSeen";
import { ATLETA_STEPS, ONBOARDING_TITLE_ATLETA } from "../../onboarding/steps";
```

(b) Read the user near the other hooks at the top of the component (after `const ctx = useOutletContext<...>();`):

```tsx
  const { user } = useAuth();
```

(c) In the `ready` JSX (the final `return (<> ... </>)`), add the card just before the closing `</>` — but NOT in preview mode (the coach "ver como atleta" reuse must not show onboarding). Insert after the `{checkinOpen && (...)}` block:

```tsx
      {API_ENABLED && user && !preview && (
        <OnboardingCard
          title={ONBOARDING_TITLE_ATLETA}
          steps={ATLETA_STEPS}
          storageKey={onboardingKey(user.id)}
        />
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/home.onboarding.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify the existing home tests still pass**

Run: `pnpm --filter @holy-oly/web exec vitest run src/screens/atleta/__tests__/home.test.tsx`
Expected: PASS (the new file's `vi.mock` does not leak; `home.test.tsx` runs in demo mode as before).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/screens/atleta/HomeScreen.tsx apps/web/src/screens/atleta/__tests__/home.onboarding.test.tsx
git commit -m "feat(onboarding): montar la guía de primera vez en el inicio del atleta"
```

---

### Task 6: Verificación completa

**Files:** ninguno nuevo (gate de calidad).

- [ ] **Step 1: Typecheck**

Run: `pnpm --filter @holy-oly/web typecheck`
Expected: PASS (no errors).

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: PASS (no errors en archivos nuevos/modificados).

- [ ] **Step 3: Full web test suite**

Run: `pnpm --filter @holy-oly/web test`
Expected: PASS — todos los tests de web verdes, incluyendo los 4 nuevos archivos (onboardingSeen, OnboardingCard, equipo.onboarding, home.onboarding) y los existentes de equipo/home sin regresión.

- [ ] **Step 4: Production build**

Run: `pnpm --filter @holy-oly/web build`
Expected: PASS (tsc -b + vite build sin errores).

- [ ] **Step 5: Commit (si hubo algún ajuste menor en este paso)**

```bash
git add -A
git commit -m "chore(onboarding): verificación final (typecheck + lint + tests + build)"
```

(Si no hubo cambios, omitir el commit.)

---

## Verificación en vivo (post-merge / post-deploy, manual)

No es parte de los commits, pero antes de dar por cerrado:
- Smoke con Playwright en holy-oly.onrender.com:
  - Login coach real → aparece la tarjeta una vez en el Plantel → "Entendido" → recargar → no vuelve.
  - Login atleta real → aparece en Hoy → "Entendido" → recargar → no vuelve.
- Verificar visualmente que el spacer (280px) no deja un hueco raro ni tapa el bottom-nav en ambos roles; ajustar la altura si hace falta.

---

## Notas de decisiones (del spec)

- Gating `API_ENABLED && user`: el onboarding es solo para usuarios reales; nunca convive con el `DemoTourCard` (`!API_ENABLED`).
- Sin "ver de nuevo" en v1 (YAGNI). Futuro opcional: un botón en Cuenta que borre la key `ho:onboard:<id>`.
- Persistencia en `localStorage` por-usuario (no server-side) — suficiente para v1.
- `preview` (coach "ver como atleta") NO muestra onboarding — es una vista del coach, no el primer login del atleta.
