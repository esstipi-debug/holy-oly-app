# Spec: "App Viva" — Arquitectura de Interactividad Total

> Entregable para Claude Code. Define cómo convertir Holy Oly / BECCTTOR en una app donde **casi cualquier elemento es clickeable** y cada click lleva a "cómo se crea" o "cómo se mejora" ese elemento. Estética: **densa en información pero minimalista, tipo FIFA (EA FC) pero más dinámica**. Stack: React + Vite, Tailwind v4, Motion (`motion/react`), Phosphor icons. Alineado con `taste-skill` y `ui-ux-pro-max`.

**Design Read:** *App de producto deportivo para atletas/coaches intermedios-avanzados, lenguaje "FIFA card + dark tech", denso pero limpio.*
**Dials:** `DESIGN_VARIANCE: 6` · `MOTION_INTENSITY: 7` · `VISUAL_DENSITY: 6` (más denso que un landing — esto es producto, no marketing).

---

## 1. El principio rector: la app es un grafo, no páginas

El error de la mayoría de apps de training: son **listas de pantallas**. Sesión → lista de ejercicios → números muertos. La información existe pero no se puede *recorrer*.

La regla de "App Viva":

> **Todo sustantivo en pantalla es una entidad. Toda entidad es clickeable. Todo click responde una de dos preguntas: "¿cómo se creó esto?" (origen) o "¿cómo lo mejoro?" (progresión).**

Esto convierte la app en un **grafo navegable**:

```
Atleta ──hace──> Sesión ──contiene──> Secuencia (3x3 @85%) ──de──> Movimiento (Snatch)
   │                                        │                          │
   │                                        └──produce──> RM/PR ◄──────┤
   │                                                        │          │
   └──tiene──> Readiness ──modula──> Carga del día           │          ├──se mejora con──> Drills
                                                            │          ├──tiene──> Análisis de video
                                                            └──video──>┤          (bar path, errores)
                                                                       └──prerrequisito de──> Skill Tree (DAG)
```

Ya tienes el DAG del skill tree en BECCTTOR y el Stress Engine como motor. Esta spec **no crea entidades nuevas**: las hace navegables.

### 1.1 Catálogo de entidades clickeables (V1)

| Entidad | Click responde... | Destino del click |
|---|---|---|
| **Movimiento** (Snatch, C&J, Back Squat...) | "¿cómo lo mejoro?" | Página de movimiento: RM, historial, drills, errores frecuentes, posición en skill tree |
| **RM / PR** (ej: "Snatch 102 kg 🔥") | "¿cómo se creó?" | La secuencia exacta que lo produjo (los sets, la sesión, el video, el bar path) |
| **Secuencia / Set** (ej: "3x3 @ 85%") | ambas | Detalle de la secuencia: cada rep, velocidad si hay video, RPE, de qué bloque del programa viene |
| **Sesión** | "¿cómo se creó?" | Por qué el Stress Engine programó esto (ACWR, readiness, fase del mesociclo) |
| **Atleta** (en vista coach) | — | Card de atleta estilo FIFA: overall + atributos |
| **Drill** | "¿qué mejora?" | Qué error corrige, qué movimiento alimenta, video demo |
| **Error técnico** (del análisis de video) | "¿cómo lo arreglo?" | Definición + drills asociados + lifts del atleta donde apareció |
| **Métrica** (velocidad pico, ACWR, tonelaje) | "¿de dónde sale?" | Fórmula en lenguaje simple + los datos que la componen + tendencia |
| **Semáforo readiness** (Verde/Ámbar/Rojo) | "¿por qué?" | Los inputs del día (sueño, sRPE, turnos) y qué ajustó en la sesión |
| **% de carga** (ej: "85%") | "¿de qué?" | Del RM vigente → click al RM → click a la secuencia que lo creó (cadena completa) |

**Regla de oro:** si el usuario puede preguntarse "¿y esto de dónde sale?", el elemento debe ser clickeable. Si un elemento no tiene respuesta a ninguna de las dos preguntas, es decoración — y la decoración se elimina (minimalismo).

---

## 2. El patrón de navegación: 3 niveles de profundidad

El minimalismo no es mostrar poco — es **mostrar lo justo en cada nivel y dejar que el click revele más**. Tres niveles, siempre los mismos:

### Nivel 0 — Chip (en línea, dentro de cualquier texto o lista)
El elemento vive dentro de otra vista. Mínima señal de interactividad: el texto de la entidad va en **peso semibold + color de acento sutil**, sin subrayado, sin botón. Touch target ≥ 44px (padding invisible).

```
Hoy: Snatch 5x2 @ 80% · C&J 3x3 @ 85% · Front Squat 4x4
        └─chip      └─chip   └─chip  └─chip      └─chip
```

### Nivel 1 — Peek (bottom sheet / popover, 40-60% de pantalla)
Click en un chip → **sheet que sube desde abajo** (móvil) o popover anclado (desktop). Muestra el "resumen FIFA" de la entidad: la card con 3-5 stats clave + 2 acciones. **No navega**: el contexto de fondo sigue visible, atenuado. Cerrar = swipe down o tap fuera.

Contenido del peek por entidad:
- **Movimiento:** mini-card con RM actual, tendencia 30d (sparkline), último video analizado. Acciones: `Ver todo` / `Analizar video`.
- **RM:** peso + fecha + badge 🔥, la secuencia que lo produjo en una línea ("3x3 @ 85% → single @ 102"), thumbnail del video si existe. Acciones: `Ver secuencia` / `Compartir card`.
- **Métrica:** valor + sparkline + una frase de explicación ("ACWR 1.3 = tu carga aguda está 30% sobre tu crónica").

### Nivel 2 — Página de entidad (navegación completa)
`Ver todo` desde el peek → página completa. Aquí vive la densidad: historial, gráficas, videos, drills, relaciones con otras entidades (que son, a su vez, chips clickeables → el grafo sigue).

**Regla anti-laberinto:** breadcrumb persistente de máximo 3 saltos visibles (`Sesión › C&J › RM 102kg`) + swipe-back siempre disponible. El usuario nunca debe sentirse perdido en el grafo.

---

## 3. Lenguaje visual: "FIFA pero más dinámico"

Qué tomar de FIFA/EA FC y qué no:

### 3.1 Tomar
- **La card como unidad atómica de identidad.** En FIFA, el jugador ES su card. Aquí: el atleta y el movimiento SON sus cards. Una card de movimiento se reconoce a distancia: nombre grande, número dominante (RM), 4-6 sub-stats compactas.
- **Jerarquía numérica brutal:** un número héroe (el overall / el RM) en 64-96px, sub-stats en 12-14px. El ojo sabe en 200ms qué importa.
- **Tiers visuales:** FIFA usa bronce/plata/oro/icon. Aquí: el borde/fondo de la card refleja nivel — calculado desde el skill tree DAG (ej: `base` / `intermedio` / `avanzado` / `élite` según % de nodos completados o RM relativo al peso corporal). Sin coleccionismo artificial: el tier se *gana* entrenando.
- **El radar/hexágono de atributos** para la card de atleta: Fuerza, Técnica, Velocidad, Consistencia, Readiness, Volumen tolerado. Cada vértice del radar es — obvio — clickeable (Nivel 1 peek de esa métrica).

### 3.2 NO tomar
- Brillos, partículas y gradientes dorados en reposo. FIFA es visualmente ruidoso; aquí el estado de reposo es **calmo y plano**. El brillo se reserva para **momentos ganados**: nuevo PR, subida de tier, racha. El fuego 🔥 del PR es un evento, no decoración permanente.
- Menús laberínticos de FIFA. La navegación es el grafo de la sección 2, nada más.

### 3.3 "Más dinámico": las 4 reglas de motion
Con `MOTION_INTENSITY: 7`, usando `motion/react`:

1. **Todo lo clickeable responde al touch en <100ms:** scale 0.97 + sombra al presionar (`whileTap={{ scale: 0.97 }}`). Es la señal universal de "esto es vivo".
2. **Transiciones con continuidad espacial:** el chip se expande hacia el peek, el peek hacia la página (`layoutId` compartido de Motion). El usuario *ve* que es el mismo objeto en tres escalas. Esto es lo que FIFA no hace y nos hace sentir "más dinámico".
3. **Los números cuentan, no aparecen:** RM, tonelaje y velocidades animan con count-up (300-500ms, ease-out) al entrar en viewport. Sparklines se dibujan de izquierda a derecha.
4. **Física solo en celebraciones:** el card de PR entra con spring exagerado + partículas de fuego (una vez, 1.5s, no loop). `prefers-reduced-motion` desactiva todo lo anterior salvo el feedback de tap.

**Prohibido:** animaciones en loop infinito, skeleton screens de más de 400ms sin contenido progresivo, hover como única señal de interactividad (móvil primero).

---

## 4. Los tres flujos estrella (casos de uso completos)

### Flujo A — "RM del movimiento en secuencias" (tu ejemplo del 3x3)

El RM nunca es un número aislado: es el **resultado de una secuencia**, y la app lo muestra así.

```
[Dashboard] ── tap chip "C&J 102kg 🔥 PR" ──>
[Peek RM]
   ┌─────────────────────────────┐
   │  CLEAN & JERK        🔥 PR  │
   │  102 kg          +3kg (3%)  │
   │  ───────────────────────    │
   │  Construido por:            │
   │  3x3 @85% → 2x2 @92% → 102  │   ← cada bloque es chip
   │  ▶ [thumbnail video]        │
   │  [Ver secuencia] [Compartir]│
   └─────────────────────────────┘
── tap "Ver secuencia" ──>
[Página de secuencia]
   • Timeline horizontal de sets: 3x3 ─ 3x3 ─ 3x3 ─ 2x2 ─ 2x2 ─ 1x1(PR)
     (cada set: peso, velocidad media si hay video, RPE; tap = detalle del set)
   • Gráfica velocidad vs carga de la sesión (cada punto clickeable → ese set)
   • "¿Por qué esta secuencia?" → chip a la fase del programa que la generó (Stress Engine)
   • Comparar con la secuencia del PR anterior (lado a lado)
```

**Modelo de datos mínimo:** todo `PerformanceRecord` (ya existe en Arsenal) guarda `sequenceId` → tabla `SetSequence` con los sets ordenados de esa sesión para ese movimiento. Es la edge del grafo que hace posible el flujo.

### Flujo B — "¿Cómo mejoro este movimiento?"

```
[Cualquier lugar] ── tap chip "Snatch" ──> [Peek] ── "Ver todo" ──>
[Página de Movimiento: Snatch]
   Tab 1 · ESTADO:    card FIFA del movimiento (RM, tendencia, tier, velocidad @80%)
   Tab 2 · MEJORAR:   ① errores detectados en tus últimos videos (chips → drill asociado)
                      ② drills recomendados por el motor (chips → video demo + dosis)
                      ③ posición en el skill tree: qué desbloquea, qué lo alimenta (mini-DAG navegable)
   Tab 3 · HISTORIA:  todos los RM y secuencias que los crearon (Flujo A en reversa)
```

La pestaña MEJORAR es donde el análisis de video (spec anterior) se conecta: cada error del catálogo (barra adelantada, extensión incompleta...) ya tiene drill asociado → aquí se renderiza como par `error → drill`, ambos clickeables.

### Flujo C — "¿Por qué mi sesión de hoy es así?"

```
[Sesión de hoy] ── tap en el header "¿Por qué esta sesión?" o en el semáforo 🟡 ──>
[Peek Readiness]
   "Ámbar: dormiste 5.2h y tu sRPE de 7 días subió 18%.
    El motor bajó la intensidad del C&J de 85% → 78% y quitó un set."
   (cada dato es chip: sueño → fuente; sRPE → cálculo; 78% → del RM vigente → grafo)
```

Esto materializa la filosofía del Stress Engine ("el sistema alerta, el coach decide") en UI: la decisión del sistema siempre es **auditable con un tap**.

---

## 5. Arquitectura técnica (React)

### 5.1 Los 3 componentes que hacen todo

```tsx
// 1. EntityChip — el átomo. Envuelve CUALQUIER mención de una entidad.
<EntityChip type="movement" id="snatch">Snatch</EntityChip>
<EntityChip type="pr" id="pr_8821">102 kg 🔥</EntityChip>
<EntityChip type="metric" id="acwr">ACWR 1.3</EntityChip>

// Implementación: semibold + acento, touch target 44px, whileTap scale,
// onClick → openPeek({ type, id }). NADA más. Es deliberadamente tonto.

// 2. PeekSheet — el Nivel 1. Un solo componente global, contenido por registry.
const PEEK_REGISTRY: Record<EntityType, React.FC<{ id: string }>> = {
  movement: MovementPeek,
  pr: PrPeek,
  sequence: SequencePeek,
  metric: MetricPeek,
  session: SessionPeek,
  drill: DrillPeek,
  error: ErrorPeek,
  athlete: AthletePeek,
};
// Estado global (Zustand): peekStack: {type, id}[]  — permite peek sobre peek
// (máx 2 de profundidad; el tercero navega a página).

// 3. EntityPage — el Nivel 2. Ruta /e/:type/:id con loader que trae
// la entidad + sus edges (relaciones), renderizadas como EntityChips.
```

### 5.2 El endpoint que alimenta el grafo

Un solo contrato para todas las entidades (evita 10 endpoints ad-hoc):

```
GET /api/entity/:type/:id?depth=peek|full

// Respuesta uniforme:
{
  "type": "pr",
  "id": "pr_8821",
  "card": { "title": "Clean & Jerk", "hero": "102", "unit": "kg",
            "badge": "PR", "delta": "+3kg", "tier": "avanzado" },
  "stats": [ { "label": "Velocidad última rep", "value": "0.31 m/s", "entity": {"type":"metric","id":"v_8821"} } ],
  "edges": [
    { "rel": "built_by", "label": "3x3 @85% → 2x2 @92% → 102",
      "entity": { "type": "sequence", "id": "seq_5512" } },
    { "rel": "video", "entity": { "type": "video_analysis", "id": "va_910" } },
    { "rel": "movement", "entity": { "type": "movement", "id": "cj" } }
  ],
  "actions": [ { "label": "Compartir card", "intent": "share_pr" } ]
}
```

`depth=peek` devuelve card + 3 edges; `depth=full` devuelve todo. El frontend nunca sabe "qué hay dentro" de una entidad: solo renderiza cards, stats y edges. **Agregar una entidad nueva al grafo = agregar un resolver en backend + un Peek component. Cero cambios en navegación.**

### 5.3 Prisma: la edge que falta

```prisma
model SetSequence {
  id         String   @id @default(cuid())
  sessionId  String
  movementId String
  sets       Json     // [{order, reps, weightKg, rpe?, meanVelocity?, videoAnalysisId?}]
  producedPrId String? @unique  // ← la edge RM ◄── secuencia
  createdAt  DateTime @default(now())
}
// PerformanceRecord (Arsenal) agrega: sequenceId String?
```

---

## 6. Minimalismo operativo: qué se quita para que la densidad respire

La densidad FIFA solo funciona porque todo lo demás desaparece:

1. **Cero labels redundantes.** "RM: 102 kg" → solo `102` grande + `kg` pequeño. El contexto (estás en la card de C&J) ya dice qué es.
2. **Una tipografía, dos pesos, tres tamaños** por vista. Números en tabular-nums siempre.
3. **Color con presupuesto:** fondo neutro oscuro, un acento de marca, y el semáforo (verde/ámbar/rojo) reservado EXCLUSIVAMENTE para readiness/estado. Si todo brilla, nada brilla.
4. **Sin botones donde un chip basta.** Los CTAs explícitos (`Analizar video`, `Compartir`) viven solo en peeks y páginas, máximo 2 por vista.
5. **Iconos Phosphor, strokeWidth 1.5, una familia.** Cero emojis como iconos de UI (el 🔥 del PR es contenido de celebración, no icono de interfaz).

---

## 7. Roadmap de implementación

| Fase | Alcance | Esfuerzo (solo dev + Claude Code) |
|---|---|---|
| **F1 — Esqueleto del grafo** | `EntityChip`, `PeekSheet` global con Zustand, endpoint `/api/entity` con 3 tipos (movement, pr, sequence), `SetSequence` en Prisma. Flujo A completo (RM → secuencia 3x3). | ~1-1.5 semanas |
| **F2 — Cards FIFA** | Card de movimiento y de atleta con tiers + radar de atributos, count-up de números, transiciones `layoutId`. | ~1 semana |
| **F3 — El grafo completo** | Tipos restantes (metric, session, drill, error, readiness), Flujos B y C, breadcrumb, peek-sobre-peek. | ~1.5-2 semanas |
| **F4 — Celebraciones + share** | Animación de PR (spring + fuego, una vez), conexión con las share cards del spec de video (Remotion). | ~1 semana |

### Criterios de aceptación
- [ ] En la vista de sesión, **el 100% de movimientos, %s, RMs y métricas son chips** que abren peek en <150ms.
- [ ] Desde cualquier RM se llega a su secuencia origen (3x3 → ... → PR) en **máximo 2 taps**.
- [ ] Desde cualquier movimiento se llega a un drill accionable en **máximo 3 taps**.
- [ ] El semáforo readiness siempre explica su color con datos clickeables (auditable).
- [ ] Test del pasillo: un atleta nuevo, sin onboarding, descubre solo que los elementos son clickeables (señal: tasa de tap en chips > 40% en primera sesión — instrumentar).
- [ ] `prefers-reduced-motion` respetado; touch targets ≥ 44px; contraste ≥ 4.5:1 en todos los chips.

### Riesgos
| Riesgo | Mitigación |
|---|---|
| "Todo clickeable" → usuario no distingue qué tocar | Estilo de chip 100% consistente; nunca dos estilos de interactividad |
| Grafo se vuelve laberinto | Máx 3 niveles visibles + breadcrumb + peek antes de navegar |
| Sobre-fetch (cada peek = request) | `depth=peek` ultraliviano (<2KB) + cache por entidad (stale-while-revalidate) |
| Densidad FIFA se vuelve ruido | Presupuesto de color (regla 6.3) + revisión con 2-3 atletas reales por fase |

---

## 8. Resumen para Claude Code (orden de ejecución)

1. Crear `SetSequence` + migración; backfill de PRs existentes si hay datos.
2. Implementar `GET /api/entity/:type/:id` con resolvers para `movement`, `pr`, `sequence`.
3. Construir `EntityChip` + `PeekSheet` (Zustand store `peekStack`) + 3 peeks.
4. Flujo A end-to-end (criterio: RM → secuencia en 2 taps).
5. Iterar F2-F4 según roadmap, validando cada fase con uso real antes de seguir.
