# Spec: Datos, Presupuesto de Fricción y Visualización

> Entregable para Claude Code. Cierra el loop "más uso → más datos → mejores recomendaciones" SIN matar al atleta con fricción. Define: (1) qué dato vive en qué modo, (2) el presupuesto de fricción del producto, (3) la pregunta única de readiness conectada al Stress Engine, y (4) cómo se ve todo en gráficos y emojis. Alineado con `spec-app-viva-interactividad.md` (grafo de entidades, peeks, cards FIFA), `taste-skill` y `ui-ux-pro-max`.

**Design Read:** *Producto deportivo intermedio-avanzado, "FIFA card + dark tech", denso pero calmo.*
**Dials:** `DESIGN_VARIANCE: 6` · `MOTION_INTENSITY: 7` · `VISUAL_DENSITY: 6`.

---

## 0. El principio anti-fricción

> **Cada dato que le pides al atleta tiene que devolverle algo visible de inmediato, o no lo pides.**

La halterofilia ya tiene fricción física (montar discos, calentar, descansar). La app no puede sumar fricción cognitiva. Por eso el dato entra **por el acto de entrenar**, no por formularios. El enriquecimiento ocurre del lado del sistema, no del lado del esfuerzo del atleta.

Corolario (conecta con la app viva): el atleta **no rellena, navega**. El dato que sí se pide se paga con una **decisión visible** — pides la cara 🟡, el semáforo le explica que por eso bajó la intensidad de hoy. Eso rompe el patrón "registro datos en un agujero negro".

---

## 1. Los dos modos (decisión firme, separados desde el día 1)

### Modo Atleta — default, fricción casi nula
Lo que el 90% usa siempre. **80% del valor del producto sale de aquí.**

| Dato | Cómo entra | Fricción |
|---|---|---|
| Peso × reps × series | Ya lo registra para entrenar | **CERO** |
| Éxito/fallo de intento | Un tap que ya hace | **CERO** |
| Velocidad de barra + bar path | Del video que **ya quiere** subir para ver técnica | **CERO extra** |
| Readiness del día | **Una** pregunta, 3 caras, al abrir | **1 tap, opcional** |
| Sueño | Slider rápido, o del wearable si lo tiene | **1 gesto / CERO** |

De esto solo salen: tonelaje, conteo de levantamientos ≥90%, toda la lógica de Prilepin/volumen, semáforo de readiness, PRs, velocidad, share cards. **Suena a poco; es casi todo.**

### Modo Lab — opt-in, para el nerd y el coach de alto rendimiento
Vive en un menú aparte que el 90% nunca abre. Diferenciador para el segmento que paga más, **nunca la puerta de entrada**.

- CMJ (potencia/velocidad concéntrica y altura media — no solo altura máx).
- Sueño detallado / fases (etiquetado como tendencia, no verdad clínica).
- HRV (para guiar intensidad; etiquetado: no predice sobreentrenamiento).
- Perfil carga-velocidad fino para estimar 1RM.
- Pérdida de velocidad intra-serie como autorregulador de volumen.

> Todo en Modo Lab lleva un badge de confianza de evidencia (ver §5). Grip test / CNS tap test → etiquetados **"exploratorio"** porque carecen de validación robusta en halterófilos.

---

## 2. La pregunta única de readiness (el flujo completo)

Al abrir la app, **una** pregunta. No cinco ítems. La evidencia (Saw et al., 2016, *BJSM*) dice que lo subjetivo supera a lo objetivo en sensibilidad — y cuesta un tap.

```
┌──────────────────────────────┐
│   ¿Cómo te sientes hoy?      │
│                              │
│     🟢        🟡        🔴    │
│   Pilas    Normal    Fundido │
│                              │
│        [ omitir ]            │   ← omitir SIEMPRE permitido (cero coerción)
└──────────────────────────────┘
```

**Qué pasa tras el tap (la devolución inmediata):**

```
tap 🟡 ──>
[Semáforo readiness se pinta ámbar en el dashboard]
   "Ámbar. Bajé la intensidad del C&J de 85% → 78% y quité un set."
   (cada dato es chip clickeable → auditable, como en el Flujo C de la app viva)
```

Si tiene sueño/wearable, el sistema **combina** la cara + horas de sueño + sRPE de 7 días para decidir el color, pero al atleta solo le pidió un tap. Lógica de combinación (umbrales del informe de evidencia):

```
verde  : cara🟢 Y sueño≥7h Y sRPE_7d estable
ámbar  : cara🟡 O sueño 5-7h O sRPE_7d +15-25%
rojo   : cara🔴 O sueño<5h varias noches O sRPE_7d >+25%
```

> El semáforo es la ÚNICA parte de la UI autorizada a usar los tres colores (verde/ámbar/rojo). En todo lo demás, color con presupuesto (§4).

---

## 3. Cómo se enriquece con el uso (data network effect, sin pedir más)

El mecanismo real: cuanto más larga la serie temporal del atleta, más fiable la recomendación. **Nada de esto pide datos nuevos** — todo se computa de lo que ya entró.

1. **Perfil carga-velocidad individual** → mejora la estimación de 1RM sesión a sesión (el error baseline ~9,8% baja con datos propios).
2. **Líneas base personales** de readiness, velocidad y sueño → el sistema detecta desviaciones **relativas a la base del propio atleta** (~10% de caída en velocidad/CMJ = bandera), no a normas poblacionales.
3. **Correlación cruzada** sueño/readiness → velocidad de barra del día siguiente → personaliza la prescripción.

Visualmente esto se comunica con un indicador de "madurez de datos" (ver §4.6): la app muestra honestamente cuándo aún está aprendiendo al atleta.

---

## 4. Visualización: gráficos y emojis

### 4.0 Filosofía de gráficos
Tipo FIFA: **un número héroe domina, el gráfico es soporte.** Nunca un dashboard de 8 gráficos. Cada vista tiene **un** gráfico protagonista como máximo. Librería: **Recharts** (ya en tu stack React). Números siempre en `tabular-nums`. Animan con count-up al entrar en viewport (`MOTION_INTENSITY: 7`).

### 4.1 Política de emojis (crítica — leer antes de implementar)
`taste-skill` y `ui-ux-pro-max` prohíben emojis **como iconos de UI**. La regla para Holy Oly:

| Uso | ¿Emoji? | Qué usar |
|---|---|---|
| Iconos de interfaz (nav, botones, acciones) | **NUNCA** | Phosphor icons, strokeWidth 1.5, una familia |
| Semáforo readiness | **NO emoji** | Círculo de color sólido (token de design system) + label de texto |
| Celebración de PR | **SÍ, como contenido** | 🔥 es un evento de 1.5s, no decoración permanente |
| Caras de la pregunta de readiness | **SÍ, como contenido afectivo** | 🟢🟡🔴 + palabra; es input emocional, no cromo de UI |
| Share cards (redes) | **SÍ, libre** | Es contenido para Instagram/TikTok, otra lógica |

> Regla mental: emoji solo donde comunica **emoción o celebración** (contenido). Jamás donde comunica **función** (interfaz). El 🔥 del PR se gana; no vive en la barra de nav.

### 4.2 Sparkline (el caballo de batalla)
Va dentro de cada card de movimiento y cada peek de métrica. Tendencia de 30 días, sin ejes, sin grid — solo la forma. Se dibuja de izquierda a derecha al aparecer.

```tsx
import { LineChart, Line, ResponsiveContainer } from "recharts";

function Sparkline({ data, up }: { data: {v:number}[]; up: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" strokeWidth={2}
          stroke={up ? "var(--accent)" : "var(--muted)"}
          dot={false} isAnimationActive />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### 4.3 Velocidad vs carga (gráfico protagonista de una secuencia)
En la página de secuencia (Flujo A del 3x3). Cada punto = un set, **clickeable** (→ peek del set). El punto del PR brilla.

```
v (m/s)
1.0 ┤ ●                         ← sets ligeros, rápidos
0.8 ┤   ● ●
0.6 ┤       ● ●
0.4 ┤           ● ●
0.2 ┤               ◆ PR 🔥     ← single al límite (velocidad mínima)
    └──────────────────────────
     70  80  85  90  92  %1RM
```

Scatter de Recharts; al tap en un punto → `openPeek({type:'set', id})`. La línea de regresión carga-velocidad se dibuja punteada (es el perfil individual que se afina con el uso, §3).

### 4.4 Radar de atributos (card de atleta, lo más "FIFA")
6 vértices: Fuerza · Técnica · Velocidad · Consistencia · Readiness · Volumen tolerado. **Cada vértice es clickeable** → peek de esa métrica con su sparkline y su "de dónde sale".

```tsx
import { RadarChart, PolarGrid, Radar, PolarAngleAxis, ResponsiveContainer } from "recharts";
// onClick en PolarAngleAxis tick → openPeek de la métrica del vértice
```

Regla de densidad: el radar NO lleva números en los ejes (eso es ruido FIFA). Los números viven en el peek de cada vértice. El radar comunica **forma**, no precisión.

### 4.5 Barra de volumen por zona de intensidad (lógica Prilepin)
Comunica volumen de un vistazo. Verde si está en rango óptimo de la zona, ámbar si se pasa (heurística Prilepin, etiquetada como tal en su peek).

```
Levantamientos esta semana por zona:
70-80%  ████████████░░░░░░  14 / óptimo 18
80-90%  ██████████████████  16 / óptimo 15  ⚠ sobre rango
90%+    ████░░░░░░░░░░░░░░░   3 / óptimo 4
```

Cada barra → peek que explica la zona y cita que Prilepin es heurística observacional (no ensayo). Honestidad de evidencia en la UI.

### 4.6 Indicador de "madurez de datos"
Comunica el data network effect honestamente. No es un gráfico; es un micro-estado.

```
Aprendiendo tu perfil ▓▓▓▓▓░░░░░  12 sesiones
"Con ~8 sesiones más, mi estimación de tu 1RM se afina."
```

Esto convierte la paciencia en expectativa (motiva el uso continuo) y es honesto sobre la incertidumbre temprana (el error de 1RM ~9,8% que baja con datos).

### 4.7 Tarjeta de PR (celebración — única excepción al reposo calmo)
Entra con spring exagerado + partículas de fuego **una vez, 1.5s, sin loop**. `prefers-reduced-motion` la reduce a un fade. Es la base de la share card (Remotion, spec de video).

```
   ┌───────────────────────┐
   │   🔥  NUEVO PR  🔥    │
   │                       │
   │   CLEAN & JERK        │
   │     102 kg            │   ← número héroe, count-up dramático
   │   +3 kg  (+3%)        │
   │                       │
   │  [Ver secuencia] [↗]  │
   └───────────────────────┘
```

### 4.8 Resumen de reglas de visualización
1. Un gráfico protagonista por vista, máximo.
2. Emoji = emoción/celebración (contenido); nunca función (UI).
3. Semáforo = único uso de verde/ámbar/rojo; va con color sólido + texto, no emoji.
4. Gráficos comunican forma; los números exactos viven en los peeks.
5. Todo punto de dato en un gráfico es clickeable (sigue el grafo de la app viva).
6. Count-up + dibujado progresivo; `prefers-reduced-motion` respetado.
7. Color con presupuesto: fondo neutro oscuro + un acento + el semáforo reservado.

---

## 5. Badge de confianza de evidencia (transparencia como feature)
Cada métrica del Modo Lab muestra, en su peek, un badge de qué tan sólida es su evidencia. Esto protege la credibilidad del producto y educa al coach.

| Badge | Significa | Métricas |
|---|---|---|
| ● Sólida | Meta-análisis / ECA | Velocidad de barra, feedback visual, sueño (extensión), autorregulación RPE/VL |
| ◐ Moderada | Estudios consistentes, muestras chicas | CMJ (potencia concéntrica), pérdida de velocidad, cuestionario subjetivo |
| ○ Exploratoria | Anecdótica / sin validar en halterófilos | Grip test, CNS tap test, HRV como predictor, ACWR |

El peek de cada métrica cita la fuente en una línea. Ej: tap en "Velocidad" → *"Feedback visual mejora la velocidad ~8,4% (Weakley 2023, meta-análisis). ● Evidencia sólida."*

---

## 6. Roadmap de implementación

| Fase | Alcance | Esfuerzo (solo dev + Claude Code) |
|---|---|---|
| **F1 — Modo Atleta núcleo** | Registro de sets (ya existe) → tonelaje + Prilepin + conteo ≥90%. Pregunta única de readiness + semáforo conectado al Stress Engine. | ~1-1.5 sem |
| **F2 — Visualización** | Sparkline en cards, velocidad-vs-carga en secuencia, barra de zonas Prilepin, tarjeta de PR con celebración. | ~1.5 sem |
| **F3 — Enriquecimiento** | Perfil carga-velocidad individual, líneas base personales, indicador de madurez de datos, radar de atleta. | ~1.5-2 sem |
| **F4 — Modo Lab** | CMJ, sueño detallado, HRV, pérdida de velocidad, todos con badge de evidencia. Opt-in, menú separado. | ~2 sem |

### Criterios de aceptación
- [ ] El Modo Atleta funciona end-to-end pidiendo **máximo 1 tap extra** (readiness) por sesión.
- [ ] Omitir la pregunta de readiness **nunca** bloquea nada.
- [ ] Cada dato pedido produce una **devolución visible** (el tap 🟡 pinta el semáforo y explica el ajuste).
- [ ] Cero emojis como iconos de UI; el 🔥 solo aparece en celebración de PR y share cards.
- [ ] Máximo un gráfico protagonista por vista; todos los puntos de datos clickeables.
- [ ] Cada métrica de Modo Lab muestra su badge de evidencia + fuente en una línea.
- [ ] `prefers-reduced-motion` respetado en count-up, dibujado y celebración.
- [ ] Indicador de madurez de datos visible mientras el perfil está incompleto.

### Riesgos
| Riesgo | Mitigación |
|---|---|
| Atleta siente que "rellena formularios" | Solo 1 pregunta; todo lo demás sale del acto de entrenar |
| Métricas exploratorias dañan credibilidad | Badge de evidencia honesto + viven en Modo Lab opt-in |
| Dashboard se vuelve ruido FIFA | Un gráfico protagonista por vista; números en peeks, no en gráficos |
| Emoji se cuela como icono de UI | Regla §4.1 explícita; revisión por componente |
| Atleta nuevo ve estimaciones malas y desconfía | Indicador de madurez de datos comunica la incertidumbre temprana |

---

## 7. Resumen para Claude Code (orden de ejecución)
1. Implementar la pregunta única de readiness + lógica de combinación (cara + sueño + sRPE) → color del semáforo, conectada al Stress Engine y auditable por chips.
2. Derivar tonelaje, conteo ≥90% y barras de zona Prilepin de los sets ya registrados (cero input nuevo).
3. Construir los componentes de visualización (Sparkline, scatter velocidad-carga clickeable, radar, barra de zonas, tarjeta de PR) en Recharts + Motion.
4. Aplicar la política de emojis §4.1 como regla de revisión por componente.
5. Agregar el perfil carga-velocidad individual + líneas base + indicador de madurez de datos (el enriquecimiento por uso).
6. Modo Lab como menú separado opt-in, cada métrica con su badge de evidencia §5.
