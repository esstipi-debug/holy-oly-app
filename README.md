# Holy Oly

Prototipo de la app de **macrociclos coach⇄atleta** (halterofilia). *Smart training, zero burnout.*

**Estado:** mockup visual navegable (HTML/CSS/JS, sin backend todavía) + catálogo de macrociclos normalizado.

## Ver el prototipo
Servir `_mockup/` como sitio estático y abrir:

| Archivo | Pantalla |
|---|---|
| `index.html` | Overview: Inicio · Entreno · Macrociclos (catálogo + detalle) — 5 temas |
| `app.html` | **App instalable (PWA)** con tabs |
| `atleta.html` | Atleta · Progreso (incluye módulo de ciclo) |
| `coach.html` | Coach · Drill-down de atleta (8 gráficos + palmarés/medallas) |
| `equipo.html` | Coach · Equipo (triage del plantel) |
| `coach-plan.html` | Coach · Asignar plan (RM + macrociclo en una ventana) |
| `index.html?screen=macro&role=coach` | Coach · Macrociclos (catálogo para asignar) |

Local: `python -m http.server 8000 -d _mockup` → http://localhost:8000

## Deploy (Render · sitio estático)
`render.yaml` publica `_mockup/`. En Render: **New → Blueprint** → conectar este repo. Da una URL HTTPS (necesaria para instalar la PWA en el teléfono).

## Datos
`macrocycles.ts` — catálogo normalizado **24 programas / 10 escuelas** (fuente de verdad).
