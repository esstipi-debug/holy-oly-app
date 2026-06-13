<p align="center">
  <img src="_mockup/holy-oly-disc.png" alt="Holy Oly — disco 25 kg" width="220" />
</p>

<h1 align="center">Holy Oly</h1>

<p align="center">
  <strong>Macrociclos coach⇄atleta para halterofilia olímpica.</strong><br />
  <em>Smart training, zero burnout.</em>
</p>

<p align="center">
  Planificás hacia la competencia · Leés carga y recuperación con contexto · El calendario manda
</p>

---

Holy Oly conecta al **coach** con su **plantel** en un solo lugar: prescripción de macrociclos, monitor de carga, clases en el box y el camino del atleta hacia la fecha que importa. No es un Excel con colores — cada señal se explica **cómo se forma**, **para qué sirve** y **contra qué se lee**.

| Coach | Atleta |
|-------|--------|
| Equipo, drill-down, asignación de macros | Su feed, entreno del día, progreso vs su normal |
| ACWR, recuperación, alertas con banda | Señales legibles — sin números gameables |
| Calendario de clases y cupos | Reserva de clases, ciclo (opt-in, redactado) |

---

## Por qué existe

En halterofilia el problema no es “falta de datos”: es **demasiados números sin marco**. Holy Oly prioriza:

1. **Verdad anclada a fecha** — competencias y mesociclos en calendario real, no semanas sueltas.
2. **Viz-first** — gráficos con referencia; sin dato → estado explícito, nunca falso verde.
3. **Privacidad por rol** — el atleta no ve lo que puede usarse para auto-presionarse; el coach solo ve atletas con vínculo activo.

Catálogo de referencia: **24 macrociclos · 10 escuelas** (`packages/core` + seed).

---

## Arranque rápido

Requisitos: **Node 22**, **pnpm 10**.

```bash
pnpm install
pnpm dev                 # SPA React → http://localhost:5173
```

API + base de datos (integración local): [`docs/superpowers/DEPLOY-LOCAL.md`](docs/superpowers/DEPLOY-LOCAL.md).

Demo offline instalable en Windows (modo local, sin backend): `pwsh -File scripts/local-demo/setup.ps1`.

---

## Monorepo

```
packages/core   →  dominio puro (monitor, prescription, classes, repository)
apps/api        →  Fastify + Prisma + authz
apps/web        →  React — shells coach y atleta
_mockup/        →  prototipo HTML/PWA (referencia visual legacy)
```

| Comando | Qué hace |
|---------|----------|
| `pnpm dev` | Frontend en caliente |
| `pnpm -r typecheck` | Types en todo el workspace |
| `pnpm -r test` | Unit + integración API |
| `pnpm -r build` | Build de producción |

---

## Documentación

| Si necesitás… | Abrí |
|---------------|------|
| Contexto del producto y mapa de módulos | [`docs/MEMORIA.md`](docs/MEMORIA.md) |
| Reglas MUST/NEVER (HR-1, HR-2, authz, ciclo) | [`docs/domain/HOLY-OLY-DOMAIN.md`](docs/domain/HOLY-OLY-DOMAIN.md) |
| Ritual de agentes + graphify | [`CLAUDE.md`](CLAUDE.md) · [`docs/GRAPHIFY-QUICKSTART.md`](docs/GRAPHIFY-QUICKSTART.md) |

<details>
<summary><strong>Graphify</strong> (explorar el código con grafo)</summary>

```powershell
pnpm graphify:setup
pnpm graphify:query -- "LocalRepository MonitorSeries AssignSheet"
pnpm graphify:update    # tras cambiar .ts/.tsx
pnpm graphify:viz         # graph.html en el navegador
```

Índice por comunidades: [`graphify-out/wiki/index.md`](graphify-out/wiki/index.md) (cuando el grafo está generado).

</details>

<details>
<summary><strong>Mockup estático</strong> (legacy, sin backend)</summary>

Pantallas de referencia en `_mockup/` — `index.html`, `atleta.html`, `coach.html`, etc.

```bash
python -m http.server 8000 -d _mockup
```

El producto activo vive en `apps/web` + `apps/api`.

</details>

---

<p align="center">
  <sub>Repo privado · halterofilia · coach-atleta · mobile-first</sub>
</p>
