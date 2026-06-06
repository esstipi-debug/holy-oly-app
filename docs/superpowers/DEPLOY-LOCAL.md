# Holy Oly — Demo local permanente (offline)

Una copia **100% local y offline** de Holy Oly, que se siente instalada en la PC:
abre con un ícono en su propia ventana (sin barra del navegador), arranca al
instante, **nunca depende de internet ni de Render**, y nunca expira.

- **Dónde vive:** `C:\HolyOlyDemo\` (fuera del repo; no se borra al limpiar worktrees).
- **Cómo abre:** ícono **"Holy Oly"** (escritorio + menú inicio) → ventana modo-app de Edge.
- **Datos:** modo demo (`LocalRepository`, `localStorage`) — se auto-siembra con los
  8 atletas (Mara V. full-instrumentada, Tomás L. sin-datos). **Sin backend.**
- **Actualización:** la refresca el equipo al cerrar cada sesión, y vos con el ícono
  **"Actualizar Holy Oly"** (eso sí necesita internet para traer lo último; usar el
  demo nunca lo necesita).

## Arquitectura (por qué así)

Se descartó un `.exe` (Tauri/Electron: toolchain pesado) y un service-worker PWA
(obligaría a tocar la app de producción y su lógica de caché). En su lugar:

| Pieza | Qué hace |
|------|----------|
| `C:\HolyOlyDemo\app\` | El SPA ya compilado en **modo demo** (build por defecto, sin `VITE_API_*`). |
| `C:\HolyOlyDemo\server.mjs` | Servidor estático de **cero dependencias** (`node:http`), `127.0.0.1:8765`, con *fallback SPA*. Si el puerto ya está tomado, asume que el demo corre y sale sin error. |
| `C:\HolyOlyDemo\Holy Oly.vbs` | Lanzador silencioso: arranca el server oculto y abre Edge en `--app` (ventana sin barra, perfil propio en `\browser` → su `localStorage` persiste). |
| `C:\HolyOlyDemo\actualizar.ps1` | `git pull --ff-only origin main` + `pnpm build` + copia el `dist`. |
| `C:\HolyOlyDemo\Holy Oly.ico` / `holy-oly-1024.png` | Ícono oficial (disco rojo 25KG con HOLY/OLY), generado desde `apps/web/src/ui/holyOlyIconSvg.ts`. |

Local = `localhost`, así que **funciona sin internet**. El servidor, una vez abierto,
queda corriendo hasta apagar la PC (reabrir es instantáneo); **no** toca el arranque de
Windows (se inicia recién cuando abrís el ícono).

## Setup (una vez)

```powershell
pwsh -File scripts\local-demo\setup.ps1
```

Hace todo: `pnpm install` en el checkout principal (`C:\Holy Oly 0017`), compila el demo,
lo publica en `C:\HolyOlyDemo\app`, genera el ícono (baja Saira Condensed 800, renderiza
con Edge headless, empaqueta el `.ico` multi-tamaño), escribe el lanzador y crea los 4
accesos directos. Idempotente: re-ejecutar reconstruye el build; el ícono solo se
regenera con `-Force`.

> **Costo único:** instala `node_modules` en `C:\Holy Oly 0017` (hoy no los tiene) para
> que el botón "Actualizar" pueda compilar solo. Es la única huella fuera de `C:\HolyOlyDemo\`.

## Generar solo el ícono

```powershell
# 1) baja y embebe la fuente, 2) emite los HTML, 3) Edge headless -> PNG, 4) empaqueta .ico
node scripts\local-demo\make-html.mjs <dir-con-saira-800.b64.txt>
node scripts\local-demo\pack-ico.mjs "<out.ico>" "16:..png" "32:..png" ... "256:..png"
```

El ícono usa el wordmark completo en 64/128/256 y el disco sin texto (más legible) en
16/32/48. El maestro `holy-oly-1024.png` es la versión "App Store".

## Gotchas

- **Edge headless + `--screenshot`:** usar `--headless=new` (el legacy no escribe) y un
  `--user-data-dir` **único por render** (con perfil compartido, Chrome reenvía al primer
  proceso y no captura). Render full-bleed con tamaño/posición **explícitos** (no `100vw/vh`,
  que descentra en headless).
- **Saira Condensed** viene de Google Fonts (no está en el repo) → el render del ícono
  necesita internet la primera vez. Va embebida en base64 para fidelidad y para evitar la
  carrera de carga de la fuente.
- **`git pull --ff-only`** en "Actualizar": el checkout principal está en `main` y limpio
  (se trabaja en worktrees). Si divergiera, falla fuerte en vez de pisar nada.
- **Puerto 8765 zombi:** si el server queda colgado, `Get-CimInstance Win32_Process -Filter`
  `"name='node.exe'" | ? { $_.CommandLine -like '*HolyOlyDemo*' } | % { Stop-Process $_.ProcessId }`.
- Edge `--app` sigue siendo el navegador por debajo: da el look "instalado" sin un `.exe`.
