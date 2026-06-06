// Emits render-<size>[-notext].html files that draw the OFFICIAL Holy Oly app icon
// (verbatim port of apps/web/src/ui/holyOlyIconSvg.ts) with Saira Condensed 800 embedded,
// sized full-bleed so Edge headless --screenshot at --window-size=N,N yields an N×N icon.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.argv[2] || ".";
const b64 = readFileSync(join(DIR, "saira-800.b64.txt"), "utf8").trim();

/* ---- verbatim port of holyOlyIconSvg (pure: Math + string building only) ---- */
const VB = 512, CX = 256, CY = 268;
const PAL = { color: "#d8262d", edge: "#9f1219", dark: "#680a10", light: "#f0726f" };
const CFG = { topRadius: 116, topSpan: 110, botRadius: 160, botSpan: 78, fontSize: 66, weight: 800, tracking: 1, botTracking: 8 };
function pt(deg, r) { const a = (deg * Math.PI) / 180; return [CX + r * Math.cos(a), CY + r * Math.sin(a)]; }
function arcTop(r, span) { const h = span / 2; const [x1, y1] = pt(270 - h, r); const [x2, y2] = pt(270 + h, r); return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`; }
function arcBottom(r, span) { const h = span / 2; const [x1, y1] = pt(90 + h, r); const [x2, y2] = pt(90 - h, r); return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`; }
function defs(uid) {
  return `<radialGradient id="band${uid}" cx="40%" cy="33%" r="80%"><stop offset="0" stop-color="${PAL.light}"/><stop offset="50%" stop-color="${PAL.color}"/><stop offset="100%" stop-color="${PAL.edge}"/></radialGradient>` +
    `<linearGradient id="rim${uid}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${PAL.dark}"/><stop offset="55%" stop-color="${PAL.edge}"/><stop offset="100%" stop-color="${PAL.color}"/></linearGradient>` +
    `<radialGradient id="steel${uid}" cx="38%" cy="32%" r="84%"><stop offset="0" stop-color="#ffffff"/><stop offset="45%" stop-color="#dadde0"/><stop offset="100%" stop-color="#9da1a6"/></radialGradient>` +
    `<radialGradient id="bore${uid}" cx="42%" cy="36%" r="80%"><stop offset="0" stop-color="#8c9096"/><stop offset="100%" stop-color="#303236"/></radialGradient>` +
    `<radialGradient id="bg${uid}" cx="50%" cy="40%" r="78%"><stop offset="0" stop-color="#2c2f34"/><stop offset="58%" stop-color="#191b1e"/><stop offset="100%" stop-color="#0c0d0f"/></radialGradient>` +
    `<radialGradient id="glow${uid}" cx="50%" cy="46%" r="50%"><stop offset="0" stop-color="${PAL.color}" stop-opacity=".34"/><stop offset="100%" stop-color="${PAL.color}" stop-opacity="0"/></radialGradient>`;
}
function face(uid, withText) {
  let s = "";
  s += `<circle cx="${CX}" cy="${CY}" r="192" fill="${PAL.edge}"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="186" fill="url(#band${uid})"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="186" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="100" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="3"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="96" fill="url(#steel${uid})" stroke="rgba(0,0,0,.16)" stroke-width="1.5"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="88" fill="none" stroke="rgba(0,0,0,.10)" stroke-width="1.5"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="30" fill="url(#bore${uid})"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="30" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2"/>`;
  if (withText) {
    const tp = `top${uid}`, bp = `bot${uid}`;
    const common = `font-family="'Saira Condensed',sans-serif" fill="#ffffff" font-size="${CFG.fontSize}" font-weight="${CFG.weight}"`;
    s += `<path id="${tp}" d="${arcTop(CFG.topRadius, CFG.topSpan)}" fill="none"/>`;
    s += `<path id="${bp}" d="${arcBottom(CFG.botRadius, CFG.botSpan)}" fill="none"/>`;
    s += `<text ${common} letter-spacing="${CFG.tracking}"><textPath href="#${tp}" startOffset="50%" text-anchor="middle">HOLY</textPath></text>`;
    s += `<text ${common} letter-spacing="${CFG.botTracking}"><textPath href="#${bp}" startOffset="50%" text-anchor="middle">OLY</textPath></text>`;
  }
  return s;
}
function holyOlyIconSvg(uid, withText) {
  const sx = 0.82, sy = 0.985, R = -5;
  const T = `translate(${CX} ${CY}) rotate(${R}) scale(${sx} ${sy}) translate(${-CX} ${-CY})`;
  const ox = -34, oy = 7;
  const wall = `<g transform="translate(${ox} ${oy})"><g transform="${T}"><circle cx="${CX}" cy="${CY}" r="192" fill="url(#rim${uid})"/></g></g>` +
    `<g transform="translate(${ox - 1} ${oy})"><g transform="${T}"><circle cx="${CX}" cy="${CY}" r="192" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/></g></g>`;
  const plate = `${wall}<g transform="${T}"><circle cx="${CX}" cy="${CY}" r="192" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="2"/>${face(uid, withText)}</g>`;
  const bg = `<rect width="${VB}" height="${VB}" fill="url(#bg${uid})"/>` +
    `<ellipse cx="${CX - 6}" cy="${CY + 2}" rx="220" ry="206" fill="url(#glow${uid})"/>` +
    `<ellipse cx="${CX - 10}" cy="${CY + 196}" rx="176" ry="30" fill="rgba(0,0,0,.5)"/>`;
  return `<svg viewBox="0 0 ${VB} ${VB}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="HOLY OLY app icon"><defs>${defs(uid)}</defs>${bg}${plate}</svg>`;
}
/* ---- end port ---- */

const fontFace = `@font-face{font-family:'Saira Condensed';font-style:normal;font-weight:800;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2')}`;

const SIZE = 1024; // master render size; smaller icons are downscaled from these

// Two masters: full wordmark (large sizes) and text-free disc (tiny sizes, for crispness).
const masters = [
  { withText: true,  file: "master-text.html" },
  { withText: false, file: "master-notext.html" },
];

for (const m of masters) {
  // Force explicit pixel dimensions + fixed full-bleed positioning so the square SVG
  // exactly fills the SIZE×SIZE viewport (100vw/vh let it drift in headless).
  const svg = holyOlyIconSvg("app", m.withText)
    .replace('width="100%" height="100%"', `width="${SIZE}" height="${SIZE}"`);
  const html = `<!doctype html><html style="margin:0"><head><meta charset="utf-8"><style>${fontFace}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${SIZE}px;height:${SIZE}px;overflow:hidden;background:#0c0d0f}
#warm{position:absolute;left:-9999px;font-family:'Saira Condensed';font-weight:800;font-size:120px}
svg{position:fixed;top:0;left:0;display:block;width:${SIZE}px;height:${SIZE}px}</style></head>
<body><span id="warm">HOLYOLY</span>${svg}</body></html>`;
  writeFileSync(join(DIR, m.file), html, "utf8");
}
console.log(JSON.stringify({ size: SIZE, masters }));
