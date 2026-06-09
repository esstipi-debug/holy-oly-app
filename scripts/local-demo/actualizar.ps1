# Holy Oly - actualiza el demo local operacional (api + web modo API).
# Lo copia setup.ps1 a C:\HolyOlyDemo\actualizar.ps1 y lo invoca el icono "Actualizar Holy Oly".
$ErrorActionPreference = "Stop"
$repo = (Resolve-Path "$PSScriptRoot\..\..").Path
Write-Host ""
Write-Host "  Actualizando Holy Oly..." -ForegroundColor Cyan
Write-Host ""
try {
  Set-Location $repo
  Write-Host "  - Trayendo lo ultimo de GitHub (necesita internet)..."
  git fetch origin --quiet
  git pull --ff-only origin main
  Write-Host "  - Instalando dependencias..."
  pnpm install --frozen-lockfile | Out-Null
  Write-Host "  - Generando Prisma client..."
  pnpm --filter @holy-oly/api exec prisma generate | Out-Null
  Write-Host "  - Compilando web (modo API)..."
  $env:VITE_API_ENABLED = "true"
  pnpm --filter @holy-oly/web build | Out-Null
  Remove-Item Env:VITE_API_ENABLED -ErrorAction SilentlyContinue
  Write-Host "  - Compilando API..."
  pnpm --filter @holy-oly/api build | Out-Null
  Write-Host "  - Empaquetando SPA en dist/public..."
  Remove-Item -Recurse -Force "$repo\apps\api\dist\public" -ErrorAction SilentlyContinue
  Copy-Item -Recurse "$repo\apps\web\dist" "$repo\apps\api\dist\public"
  Write-Host ""
  Write-Host "  LISTO. Reabri Holy Oly o Holy Oly - Kevin para ver los cambios." -ForegroundColor Green
} catch {
  Write-Host ""
  Write-Host "  No se pudo actualizar: $_" -ForegroundColor Red
  Write-Host "  (Para traer lo ultimo necesitas conexion a internet.)" -ForegroundColor Yellow
}
Write-Host ""
Read-Host "  Enter para cerrar"
