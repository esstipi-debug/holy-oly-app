/* Holy Oly · PWA bootstrap — install (Android prompt + iOS A2HS) + viewport metrics.
   Completa el snippet: define los CTA, agrega la rama iOS y registra el service worker. */

let deferredPrompt = null;

const isAndroid = () => /Android/i.test(navigator.userAgent);
const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS se hace pasar por Mac
const isSafariIOS = () =>
  isIOS() &&
  /Safari/i.test(navigator.userAgent) &&
  !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

function updateViewportMetrics() {
  const vv = window.visualViewport;
  const width = vv ? vv.width : window.innerWidth;
  const height = vv ? vv.height : window.innerHeight;
  const r = document.documentElement.style;
  r.setProperty('--vvw', `${width}px`);
  r.setProperty('--vvh', `${height}px`);
  r.setProperty('--app-width', `${width}px`);
  r.setProperty('--app-height', `${height}px`);
}

/* ---- install CTA UI (se inyecta; estilada por la página anfitriona vía .ho-install) ---- */
function ctaEl() {
  let el = document.getElementById('ho-install');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ho-install';
    el.className = 'ho-install';
    document.body.appendChild(el);
  }
  return el;
}

function showAndroidInstallCTA() {
  const el = ctaEl();
  el.innerHTML =
    '<span class="ho-install__t">Instalá <b>Holy Oly</b> en tu teléfono</span>' +
    '<button class="ho-install__go" id="ho-install-btn">Instalar</button>' +
    '<button class="ho-install__x" id="ho-install-x" aria-label="Cerrar">✕</button>';
  el.classList.add('show');
  document.getElementById('ho-install-btn').onclick = installApp;
  document.getElementById('ho-install-x').onclick = hideInstallCTA;
}

function showIOSInstallCTA() {
  const el = ctaEl();
  el.innerHTML =
    '<span class="ho-install__t">Instalá <b>Holy Oly</b>: tocá Compartir ' +
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M12 3v13M12 3l-4 4M12 3l4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>' +
    ' → <b>Agregar a inicio</b></span>' +
    '<button class="ho-install__x" id="ho-install-x" aria-label="Cerrar">✕</button>';
  el.classList.add('show');
  document.getElementById('ho-install-x').onclick = hideInstallCTA;
}

function hideInstallCTA() {
  const el = document.getElementById('ho-install');
  if (el) el.classList.remove('show');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (!isStandalone()) showAndroidInstallCTA(); // Android + desktop Chromium
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  hideInstallCTA();
});

window.addEventListener('resize', updateViewportMetrics);
window.visualViewport?.addEventListener('resize', updateViewportMetrics);
updateViewportMetrics();

async function installApp() {
  if (!deferredPrompt) return;
  await deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  hideInstallCTA();
}

/* iOS Safari no dispara beforeinstallprompt → instrucción manual de "Agregar a inicio" */
window.addEventListener('load', () => {
  if (isSafariIOS() && !isStandalone()) setTimeout(showIOSInstallCTA, 1200);
});

/* service worker (requisito de instalabilidad). ?nosw lo desactiva (solo para captura/depuración). */
if ('serviceWorker' in navigator && !/[?&]nosw\b/.test(location.search)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
