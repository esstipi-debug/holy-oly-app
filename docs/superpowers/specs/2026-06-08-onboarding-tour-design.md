# Tour de onboarding de primera vez (coach + atleta)

> Spec de diseño · 2026-06-08
> Una guía de navegación de primera vez para el coach y otra para el atleta, que
> aparece la primera vez que cada usuario real entra a su cuenta y le muestra los
> lugares clave de la app.

## Objetivo

Cuando un coach o un atleta **real** (modo API/producción) entra por primera vez a
su pantalla principal, mostrarle una tarjeta-guía on-brand que oriente la navegación:
qué es cada superficie y por dónde empezar. Se ve una vez, se descarta y no vuelve.

No-objetivos (v1):
- No es el tour de demo/venta existente (`DemoTourCard`/`DemoSalesStrip`), que vive en
  modo demo (`!API_ENABLED`) y orienta a un prospecto. El onboarding es para usuarios
  reales (`API_ENABLED`) y son contextos mutuamente excluyentes.
- No hay coachmarks/spotlight sobre elementos reales (el sistema evita ese look — ver
  el comentario en `DemoTourCard.tsx`).
- No hay pantalla de bienvenida modal que interrumpa.
- No hay "ver la guía de nuevo" (anotado como futuro opcional en Cuenta).
- No hay persistencia server-side del flag (localStorage por-usuario alcanza para v1).

## Decisiones tomadas en brainstorming

| Decisión | Elección |
|---|---|
| Formato | Tour interactivo in-app (no documento ni guion) |
| Audiencia | Usuario real (onboarding), modo `API_ENABLED` |
| Estilo visual | Tarjeta-guía inferior on-brand (no spotlight, no modal) |
| Estructura | Componente compartido `OnboardingCard` + contenido por rol (enfoque A) |

## Arquitectura

Tres archivos nuevos bajo `apps/web/src/onboarding/`:

### `onboardingSeen.ts` — persistencia pura
Espejo de `apps/web/src/data/demoTour.ts`. Funciones puras que reciben el `Storage`:

```ts
export function onboardingKey(userId: string): string; // `ho:onboard:${userId}`
export function isOnboardingSeen(storage: Storage, key: string): boolean;
export function markOnboardingSeen(storage: Storage, key: string): void;
```

- La key se llavea por `user.id` para que coach y atleta en el mismo dispositivo no se
  pisen, y para que distintos usuarios reciban su propio onboarding.
- Namespace `ho:` (consistente con el resto del storage de la app).
- `isOnboardingSeen` devuelve `true` ante cualquier error de lectura del storage
  (modo privado, storage deshabilitado) → degrada a "no mostrar", nunca rompe.

### `steps.ts` — contenido por rol
Arrays de strings, separados del render para poder testear/ajustar el copy sin tocar
el componente:

```ts
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

(Textos finales sujetos a ajuste durante implementación; el contrato es: lista de
strings cortos, 4 pasos por rol.)

### `OnboardingCard.tsx` — componente presentacional
Genérico, reusa el lenguaje visual del `DemoTourCard` (tarjeta `position:fixed` abajo,
centrada, tokens `--wl-*`, spacer in-flow para no atrapar el último contenido bajo la
tarjeta fija, botón "Entendido, empezar" de `minHeight:44`).

```ts
interface OnboardingCardProps {
  title: string;
  steps: readonly string[];
  storageKey: string;          // ya resuelto por el caller (onboardingKey(user.id))
  storage?: Storage;           // default window.localStorage (inyectable para test)
  onDismiss?: () => void;
}
```

Comportamiento:
- Estado inicial `open = !isOnboardingSeen(storage, storageKey)` (lazy init en
  `useState`).
- Si `!open` → `return null`.
- "Entendido, empezar" → `markOnboardingSeen` + `setOpen(false)` + `onDismiss?.()`.
- `aria-label="Guía de primera vez"`, `data-testid="onboarding-card"`.
- Lista numerada (`<ol>`) igual que el DemoTourCard.

Nota de reúso: NO generalizamos `DemoTourCard` (tiene copy de venta + spacer atado al
roster + gating de demo). `OnboardingCard` es un componente nuevo y limpio que
comparte solo el lenguaje visual (estilos inline equivalentes), no la lógica.

## Integración (dónde se monta)

### Coach — `apps/web/src/screens/coach/Equipo.tsx`
- Importa `useAuth`, `OnboardingCard`, `COACH_STEPS`, `ONBOARDING_TITLE_COACH`,
  `onboardingKey`.
- Al final del contenedor, junto al `DemoTourCard` existente:

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

`user` viene de `useAuth()`. Como `API_ENABLED` y `!API_ENABLED` son excluyentes, el
onboarding y el demo card nunca conviven.

### Atleta — `apps/web/src/screens/atleta/HomeScreen.tsx`
- Mismo patrón con `ATLETA_STEPS` / `ONBOARDING_TITLE_ATLETA`.
- Se monta al final del contenido de Home (verificar durante implementación que el
  spacer in-flow no choque con el bottom-nav del shell; el DemoTourCard ya resuelve
  ese caso con su spacer de 280px, replicar el criterio).

## Estado vacío / bordes

- Coach sin atletas y atleta sin plan: la tarjeta se muestra igual (el contenido no
  depende de datos) — es justo el momento donde la orientación más sirve.
- `RequireAuth` ya garantiza sesión en `/coach` y `/atleta`, pero el guard `user &&`
  evita cualquier render sin `user.id`.
- Storage no disponible → `isOnboardingSeen` devuelve `true` → no se muestra, sin throw.

## Testing

1. `onboarding/__tests__/onboardingSeen.test.ts`
   - `onboardingKey` produce `ho:onboard:<id>`.
   - get/set con un `Storage` mock (no visto → visto).
   - lectura con storage que throwea → `true` (degradación segura).

2. `onboarding/__tests__/OnboardingCard.test.tsx`
   - Muestra título + todos los pasos cuando no visto.
   - Oculto cuando `isOnboardingSeen` es true (storage inyectado con la key marcada).
   - Click "Entendido" → persiste en storage + llama `onDismiss` + desaparece.

3. Integración liviana (extender `equipo.test.tsx` y `home.test.tsx`)
   - Con `API_ENABLED` + user → aparece `onboarding-card`.
   - Sin user → no aparece.
   - (El gating de `API_ENABLED` se mockea como ya se hace en esos tests.)

Cobertura objetivo ≥ 80% del código nuevo. tsc + eslint + build de web limpios.

## Riesgos / notas

- **Layout del spacer**: la tarjeta fija necesita un spacer in-flow para no tapar el
  último contenido de cada pantalla. Reusar el criterio del DemoTourCard (~280px) y
  verificar visualmente en coach y atleta.
- **API_ENABLED en tests**: `apiConfig` se mockea distinto según el test existente;
  seguir el patrón ya presente en `equipo.test.tsx`.
- **Verificación en vivo**: smoke con Playwright en holy-oly.onrender.com tras deploy
  (login coach real → ve la tarjeta una vez → descarta → recarga → no vuelve; idem
  atleta).

## Archivos tocados

Nuevos:
- `apps/web/src/onboarding/onboardingSeen.ts`
- `apps/web/src/onboarding/steps.ts`
- `apps/web/src/onboarding/OnboardingCard.tsx`
- `apps/web/src/onboarding/__tests__/onboardingSeen.test.ts`
- `apps/web/src/onboarding/__tests__/OnboardingCard.test.tsx`

Modificados:
- `apps/web/src/screens/coach/Equipo.tsx`
- `apps/web/src/screens/atleta/HomeScreen.tsx`
- `apps/web/src/screens/coach/__tests__/equipo.test.tsx`
- `apps/web/src/screens/atleta/__tests__/home.test.tsx`
