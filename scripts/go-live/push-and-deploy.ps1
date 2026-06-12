#Requires -Version 7
<#
.SYNOPSIS
  Go-live de Holy Oly: push a GitHub + dispara el Manual Deploy en Render y lo sigue hasta que queda LIVE.

.DESCRIPTION
  Corré esto UNA vez que el PAT de GitHub tenga "Contents: Read and write" sobre holy-oly-app.
  Pasos:
    0. Pre-flight: confirma rama y muestra el commit a desplegar.
    1. git push origin main
    2. Chequea en Render que estén las env vars críticas (sobre todo CYCLE_ENCRYPTION_KEY).
    3. Dispara el deploy vía API (autoDeploy está OFF, por eso va a mano).
    4. Hace polling del estado hasta LIVE / fallo / timeout.
    5. Health check contra https://holy-oly.onrender.com/health
  Las migraciones (16, 17, 18-booking cuando se commitee) las aplica solo el startCommand de Render
  (prisma migrate deploy) — este script NO toca la base.

.PARAMETER RenderApiKey
  API key de Render (rnd_...). Si se omite, se lee de $env:RENDER_API_KEY. NUNCA se hardcodea acá.

.PARAMETER ServiceId
  ID del servicio web en Render. Default: el de holy-oly.

.PARAMETER ClearCache
  Si lo pasás, el deploy limpia el build cache (más lento; usalo si sospechás de cache podrido).

.PARAMETER SkipPush
  Salta el git push (úsalo si ya pusheaste a mano y sólo querés disparar el deploy).

.PARAMETER SkipDeploy
  Sólo pushea, no toca Render.

.PARAMETER Force
  No pregunta nada (útil para CI). Sin esto, si falta una env var crítica te pide confirmación.

.EXAMPLE
  $env:RENDER_API_KEY = 'rnd_xxxxxxxx'
  pwsh -File scripts/go-live/push-and-deploy.ps1

.EXAMPLE
  # Sólo disparar el deploy (ya pusheado), limpiando cache:
  pwsh -File scripts/go-live/push-and-deploy.ps1 -SkipPush -ClearCache -RenderApiKey rnd_xxx
#>
[CmdletBinding()]
param(
    [string]$RenderApiKey = $env:RENDER_API_KEY,
    [string]$ServiceId    = 'srv-d8etrvvavr4c73954o4g',
    [string]$Branch       = 'main',
    [string]$HealthUrl    = 'https://holy-oly.onrender.com/health',
    [switch]$ClearCache,
    [switch]$SkipPush,
    [switch]$SkipDeploy,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference     = 'SilentlyContinue'

function Write-Step { param([string]$m) Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Write-Ok   { param([string]$m) Write-Host "  OK  $m" -ForegroundColor Green }
function Write-Warn2{ param([string]$m) Write-Host "  !!  $m" -ForegroundColor Yellow }
function Write-Err2 { param([string]$m) Write-Host "  XX  $m" -ForegroundColor Red }

# Ubicarse en la raíz del repo (este script vive en scripts/go-live/).
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
Set-Location $repoRoot

# ── 0. Pre-flight git ───────────────────────────────────────────────────────────
Write-Step "Pre-flight"
Write-Host "  Repo: $repoRoot"
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($currentBranch -ne $Branch) {
    Write-Err2 "Estás en '$currentBranch', no en '$Branch'. Cambiá de rama o pasá -Branch $currentBranch."
    exit 1
}
try {
    $ahead = (git rev-list --count "origin/$Branch..$Branch" 2>$null).Trim()
    if ($ahead) { Write-Host "  Rama '$Branch': $ahead commits adelante de origin/$Branch." }
} catch { }
Write-Host "  HEAD: $((git log -1 --oneline).Trim())"

# ── 1. Push ─────────────────────────────────────────────────────────────────────
if (-not $SkipPush) {
    Write-Step "git push origin $Branch"
    git push origin $Branch
    if ($LASTEXITCODE -ne 0) {
        Write-Err2 "Push falló (exit $LASTEXITCODE)."
        Write-Err2 "Si fue 403: el PAT de esstipi-debug NO tiene Contents:write sobre holy-oly-app."
        Write-Err2 "Arreglo: GitHub > Settings > Developer settings > Fine-grained tokens >"
        Write-Err2 "         editá el token > Repository permissions > Contents: Read and write > Save."
        Write-Err2 "         Después: gh auth refresh  (o re-login) y volvé a correr este script."
        exit 1
    }
    Write-Ok "Push completo."
} else {
    Write-Warn2 "Push salteado (-SkipPush)."
}

if ($SkipDeploy) {
    Write-Warn2 "Deploy salteado (-SkipDeploy). Listo."
    exit 0
}

# ── 2. API key de Render ────────────────────────────────────────────────────────
Write-Step "Render API"
if ([string]::IsNullOrWhiteSpace($RenderApiKey)) {
    Write-Err2 "Falta la API key de Render."
    Write-Err2 "Pasala con -RenderApiKey rnd_xxx  o  seteá `$env:RENDER_API_KEY antes de correr."
    exit 1
}
$headers = @{ Authorization = "Bearer $RenderApiKey" }
$base    = "https://api.render.com/v1/services/$ServiceId"

# ── 3. Pre-flight de env vars (atrapa el gotcha #1: CYCLE_ENCRYPTION_KEY) ────────
Write-Step "Chequeo de env vars en Render"
try {
    $envResp = Invoke-RestMethod -Method Get -Uri "$base/env-vars?limit=100" -Headers $headers
    $keys = @($envResp | ForEach-Object { $_.envVar.key })
    $critical    = @('CYCLE_ENCRYPTION_KEY')
    $recommended = @('APP_ORIGIN','API_ORIGIN','WEB_ORIGIN','BILLING_PROVIDER','EMAIL_PROVIDER')
    $missingCrit = @($critical    | Where-Object { $_ -notin $keys })
    $missingRec  = @($recommended | Where-Object { $_ -notin $keys })

    if ($missingCrit.Count -gt 0) {
        Write-Err2 ("FALTAN env vars CRÍTICAS: {0}" -f ($missingCrit -join ', '))
        Write-Err2 "Sin CYCLE_ENCRYPTION_KEY el ciclo cifrado (mig 12/17) rompe al arrancar."
        if (-not $Force) {
            $ans = Read-Host "  ¿Deployar igual? (escribí 'si' para continuar)"
            if ($ans -ne 'si') {
                Write-Warn2 "Abortado. Seteá los env vars en el dashboard y reintentá."
                exit 1
            }
        }
    } else {
        Write-Ok "CYCLE_ENCRYPTION_KEY presente."
    }
    if ($missingRec.Count -gt 0) {
        Write-Warn2 ("Recomendadas ausentes (no bloquean el boot): {0}" -f ($missingRec -join ', '))
    }
} catch {
    Write-Warn2 "No pude leer las env vars (¿la API key no tiene permiso de lectura?). Sigo sin el chequeo."
}

# ── 4. Disparar el deploy ───────────────────────────────────────────────────────
Write-Step "Disparando Manual Deploy"
$bodyObj  = @{ clearCache = $(if ($ClearCache) { 'clear' } else { 'do_not_clear' }) }
$bodyJson = $bodyObj | ConvertTo-Json
$deploy   = Invoke-RestMethod -Method Post -Uri "$base/deploys" -Headers $headers -Body $bodyJson -ContentType 'application/json'
$deployId = $deploy.id
Write-Ok "Deploy creado: $deployId (status inicial: $($deploy.status))"

# ── 5. Polling hasta estado terminal ────────────────────────────────────────────
Write-Step "Siguiendo el deploy (Ctrl+C deja de mirar; el deploy sigue corriendo en Render)"
$terminalOk   = @('live')
$terminalFail = @('build_failed','update_failed','canceled','pre_deploy_failed','deactivated')
$deadline = (Get-Date).AddMinutes(25)
$last = ''
while ($true) {
    Start-Sleep -Seconds 10
    try {
        $d = Invoke-RestMethod -Method Get -Uri "$base/deploys/$deployId" -Headers $headers
    } catch {
        Write-Warn2 "Error consultando estado, reintento..."
        continue
    }
    if ($d.status -ne $last) {
        Write-Host ("  [{0:HH:mm:ss}] {1}" -f (Get-Date), $d.status)
        $last = $d.status
    }
    if ($d.status -in $terminalOk)   { Write-Ok "Deploy LIVE."; break }
    if ($d.status -in $terminalFail) {
        Write-Err2 "Deploy terminó en '$($d.status)'. Revisá los logs en el dashboard de Render."
        exit 1
    }
    if ((Get-Date) -gt $deadline) {
        Write-Warn2 "Timeout local (25 min). El deploy puede seguir; revisá el dashboard."
        exit 1
    }
}

# ── 6. Health check ─────────────────────────────────────────────────────────────
if ($HealthUrl) {
    Write-Step "Health check: $HealthUrl"
    $healthy = $false
    for ($i = 1; $i -le 6; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec 15 -SkipHttpErrorCheck
            if ($r.StatusCode -eq 200) { Write-Ok "Health 200: $($r.Content)"; $healthy = $true; break }
            Write-Warn2 "Health $($r.StatusCode), reintento $i/6..."
        } catch {
            Write-Warn2 "Health sin respuesta (cold start?), reintento $i/6..."
        }
        Start-Sleep -Seconds 10
    }
    if (-not $healthy) { Write-Warn2 "El health no respondió 200. Verificá a mano: $HealthUrl" }
}

Write-Host "`nListo. Deploy $deployId desplegado y LIVE." -ForegroundColor Green
Write-Host "Smoke manual sugerido: login coach + atleta, drill-down, entreno, recorrido, ciclo de Mara." -ForegroundColor Green
