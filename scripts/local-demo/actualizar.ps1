# Holy Oly - actualiza el demo local con lo ultimo de main.
# Lo copia setup.ps1 a C:\HolyOlyDemo\actualizar.ps1 y lo invoca el icono "Actualizar Holy Oly".
# Traer lo ultimo necesita internet (git fetch); compilar y servir es 100% local.
$ErrorActionPreference = "Stop"
$repo = "C:\Holy Oly 0017"
$dest = "C:\HolyOlyDemo\app"
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
  Write-Host "  - Compilando el demo..."
  pnpm --filter @holy-oly/web build | Out-Null
  Write-Host "  - Copiando..."
  $null = robocopy "$repo\apps\web\dist" $dest /MIR /NJH /NJS /NFL /NDL
  Write-Host ""
  Write-Host "  LISTO. Reabri Holy Oly para ver los cambios." -ForegroundColor Green
} catch {
  Write-Host ""
  Write-Host "  No se pudo actualizar: $_" -ForegroundColor Red
  Write-Host "  (Para traer lo ultimo necesitas conexion a internet.)" -ForegroundColor Yellow
}
Write-Host ""
Read-Host "  Enter para cerrar"
