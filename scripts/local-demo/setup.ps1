<#
  Holy Oly - setup del DEMO LOCAL PERMANENTE (offline).

  Crea C:\HolyOlyDemo con el demo compilado, un servidor estatico de cero
  dependencias, el icono oficial, un lanzador silencioso y accesos directos.
  Idempotente: re-ejecutar reconstruye el build y refresca los archivos.
  El icono solo se regenera si falta (o con -Force) porque requiere internet.

  Uso:   pwsh -File scripts\local-demo\setup.ps1 [-Force]
  Ver:   docs\superpowers\DEPLOY-LOCAL.md
#>
param([switch]$Force)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$Repo = (Resolve-Path "$PSScriptRoot\..\..").Path
$Base = "C:\HolyOlyDemo"
$IconDir = "$Base\icon"
$Port = 8765

# --- 0) Prerrequisitos --------------------------------------------------------
foreach ($t in 'node','pnpm','git') {
  if (-not (Get-Command $t -ErrorAction SilentlyContinue)) { throw "Falta '$t' en el PATH." }
}
$Edge = @("$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
          "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") |
        Where-Object { Test-Path $_ } | Select-Object -First 1
New-Item -ItemType Directory -Force -Path $Base, $IconDir | Out-Null

# --- 1) Instalar dependencias + compilar el demo (modo standalone) ------------
# El build por defecto (sin VITE_API_*) usa LocalRepository -> datos sembrados,
# sin backend ni internet.
Write-Host "==> pnpm install (checkout principal)" -ForegroundColor Cyan
pnpm -C $Repo install
Write-Host "==> build web (demo)" -ForegroundColor Cyan
pnpm -C $Repo --filter '@holy-oly/web' build

# --- 2) Publicar el build en la carpeta permanente ----------------------------
$null = robocopy "$Repo\apps\web\dist" "$Base\app" /MIR /NJH /NJS /NFL /NDL
Copy-Item "$PSScriptRoot\server.mjs" "$Base\server.mjs" -Force

# --- 3) Icono oficial (solo si falta o -Force) --------------------------------
if ($Force -or -not (Test-Path "$Base\Holy Oly.ico")) {
  if (-not $Edge) { throw "No encontre Edge para renderizar el icono." }
  Write-Host "==> generando icono oficial" -ForegroundColor Cyan
  Copy-Item "$PSScriptRoot\make-html.mjs","$PSScriptRoot\pack-ico.mjs" $IconDir -Force

  # 3a) Saira Condensed 800 (subset latin) embebida -> render fiel y offline
  $ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
  $css = (Invoke-WebRequest "https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@800" -UserAgent $ua -UseBasicParsing).Content
  $idx = $css.IndexOf("/* latin */"); $tail = if ($idx -ge 0) { $css.Substring($idx) } else { $css }
  $woff = [regex]::Match($tail, "src:\s*url\((https://[^)]+\.woff2)\)").Groups[1].Value
  Invoke-WebRequest $woff -UserAgent $ua -UseBasicParsing -OutFile "$IconDir\saira-800.woff2"
  [IO.File]::WriteAllText("$IconDir\saira-800.b64.txt",
    [Convert]::ToBase64String([IO.File]::ReadAllBytes("$IconDir\saira-800.woff2")))

  # 3b) Render de los dos masters 1024 (con y sin wordmark) con Edge headless
  node "$IconDir\make-html.mjs" "$IconDir" | Out-Null
  Get-Process msedge -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  foreach ($m in @("text","notext")) {
    $uri = "file:///" + ("$IconDir\master-$m.html" -replace '\\','/')
    Start-Process -FilePath $Edge -Wait -NoNewWindow -ArgumentList @(
      "--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check",
      "--hide-scrollbars","--force-device-scale-factor=1",
      "--run-all-compositor-stages-before-draw","--virtual-time-budget=8000",
      "--user-data-dir=$IconDir\prof_$m","--window-size=1024,1024",
      "--screenshot=$IconDir\master-$m.png",$uri)
  }

  # 3c) Reescalar (bicubico) y empaquetar el .ico multi-tamano
  function Resize-Png($src, $size, $dst) {
    $i = [System.Drawing.Image]::FromFile($src)
    $b = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($b)
    $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($i, 0, 0, $size, $size)
    $b.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $b.Dispose(); $i.Dispose()
  }
  Resize-Png "$IconDir\master-text.png"   256 "$IconDir\icon-256.png"
  Resize-Png "$IconDir\master-text.png"   128 "$IconDir\icon-128.png"
  Resize-Png "$IconDir\master-text.png"   64  "$IconDir\icon-64.png"
  Resize-Png "$IconDir\master-notext.png" 48  "$IconDir\icon-48.png"
  Resize-Png "$IconDir\master-notext.png" 32  "$IconDir\icon-32.png"
  Resize-Png "$IconDir\master-notext.png" 16  "$IconDir\icon-16.png"
  node "$IconDir\pack-ico.mjs" "$Base\Holy Oly.ico" `
    "16:$IconDir\icon-16.png" "32:$IconDir\icon-32.png" "48:$IconDir\icon-48.png" `
    "64:$IconDir\icon-64.png" "128:$IconDir\icon-128.png" "256:$IconDir\icon-256.png"
  Copy-Item "$IconDir\master-text.png" "$Base\holy-oly-1024.png" -Force
}

# --- 4) Lanzador silencioso (VBS) ---------------------------------------------
$vbs = @'
Option Explicit
Dim sh, fso, edge, base, q
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
q = Chr(34)
base = "C:\HolyOlyDemo"
sh.Run "node " & q & base & "\server.mjs" & q, 0, False
WScript.Sleep 900
edge = "__EDGE__"
If Not fso.FileExists(edge) Then edge = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then edge = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
If fso.FileExists(edge) Then
  sh.Run q & edge & q & " --app=http://127.0.0.1:8765/ --window-size=430,860 --user-data-dir=" & q & base & "\browser" & q, 1, False
Else
  sh.Run "http://127.0.0.1:8765/", 1, False
End If
'@
$vbs = $vbs -replace '__EDGE__', ($Edge ?? '')
Set-Content -Path "$Base\Holy Oly.vbs" -Value $vbs -Encoding ASCII

# --- 4b) Lanzador del ATLETA (Kevin) — abre directo en /atleta ----------------
$vbsK = @'
Option Explicit
Dim sh, fso, edge, base, q
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
q = Chr(34)
base = "C:\HolyOlyDemo"
sh.Run "node " & q & base & "\server.mjs" & q, 0, False
WScript.Sleep 900
edge = "__EDGE__"
If Not fso.FileExists(edge) Then edge = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"
If Not fso.FileExists(edge) Then edge = sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
If fso.FileExists(edge) Then
  sh.Run q & edge & q & " --app=http://127.0.0.1:8765/atleta --window-size=430,860 --user-data-dir=" & q & base & "\browser-kevin" & q, 1, False
Else
  sh.Run "http://127.0.0.1:8765/atleta", 1, False
End If
'@
$vbsK = $vbsK -replace '__EDGE__', ($Edge ?? '')
Set-Content -Path "$Base\Holy Oly - Kevin.vbs" -Value $vbsK -Encoding ASCII

# --- 5) Script de actualizacion -----------------------------------------------
Copy-Item "$PSScriptRoot\actualizar.ps1" "$Base\actualizar.ps1" -Force

# --- 6) Accesos directos (escritorio + menu inicio) ---------------------------
$ws = New-Object -ComObject WScript.Shell
function New-Lnk($path, $target, $arguments, $icon, $desc) {
  $s = $ws.CreateShortcut($path)
  $s.TargetPath = $target
  if ($arguments) { $s.Arguments = $arguments }
  $s.IconLocation = $icon
  $s.WorkingDirectory = "C:\HolyOlyDemo"
  $s.Description = $desc
  $s.Save()
}
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
  New-Lnk "$dir\Holy Oly.lnk" "C:\HolyOlyDemo\Holy Oly.vbs" $null "C:\HolyOlyDemo\Holy Oly.ico" "Holy Oly - demo local (coach)"
  New-Lnk "$dir\Holy Oly - Kevin.lnk" "C:\HolyOlyDemo\Holy Oly - Kevin.vbs" $null "C:\HolyOlyDemo\Holy Oly.ico" "Holy Oly - vista del atleta Kevin (demo)"
  New-Lnk "$dir\Actualizar Holy Oly.lnk" "powershell.exe" `
    '-NoProfile -ExecutionPolicy Bypass -File "C:\HolyOlyDemo\actualizar.ps1"' `
    "C:\HolyOlyDemo\Holy Oly.ico" "Actualizar el demo de Holy Oly"
}

Write-Host ""
Write-Host "LISTO. Abri 'Holy Oly' desde el escritorio o el menu inicio." -ForegroundColor Green
Write-Host "Demo en http://127.0.0.1:$Port  (offline, datos en el navegador)."
