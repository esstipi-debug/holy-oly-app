# Go-live a Render

`push-and-deploy.ps1` — pushea `main` a GitHub y dispara el deploy en Render, siguiéndolo hasta que queda LIVE.

## Antes de correrlo (una vez)

1. **PAT de GitHub con escritura.** GitHub → Settings → Developer settings → Fine-grained tokens →
   editá el token de `esstipi-debug` → Repository permissions → **Contents: Read and write** → Save.
   Después: `gh auth refresh` (o re-login).
2. **Env vars en Render** (dashboard del servicio `holy-oly`). Crítica: **`CYCLE_ENCRYPTION_KEY`**
   (sin ella el ciclo cifrado rompe al arrancar; debe ser estable, rotarla huérfana los datos).
   El script avisa si falta antes de deployar. Lista completa en
   `docs/superpowers/HANDOFF-2026-06-11-go-live.md` §3.3.
3. **API key de Render** (`rnd_...`) a mano — la guarda el owner.

## Correrlo

```powershell
$env:RENDER_API_KEY = 'rnd_xxxxxxxx'
pwsh -File scripts/go-live/push-and-deploy.ps1
```

Variantes:

```powershell
# Sólo disparar el deploy (ya pusheaste a mano):
pwsh -File scripts/go-live/push-and-deploy.ps1 -SkipPush

# Sólo pushear, sin tocar Render:
pwsh -File scripts/go-live/push-and-deploy.ps1 -SkipDeploy

# Limpiar build cache:
pwsh -File scripts/go-live/push-and-deploy.ps1 -ClearCache
```

## Qué hace / qué NO hace

- **Sí:** push, chequeo de env vars, `POST` al endpoint de deploys, polling de estado, health check
  contra `/health`.
- **No:** migraciones (las aplica solo el `startCommand` de Render: `prisma migrate deploy`), ni el
  seed inicial (one-off manual si la DB está vacía — ver `docs/superpowers/DEPLOY.md`).

La API key nunca se hardcodea: se lee de `-RenderApiKey` o `$env:RENDER_API_KEY`.
