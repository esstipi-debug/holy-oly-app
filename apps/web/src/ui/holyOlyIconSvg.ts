/**
 * HOLY OLY — App Icon (faithful port of the claude.ai/design handoff).
 *
 * A single red 25 KG bumper plate in ¾ perspective, HOLY arced over the top, OLY beneath,
 * on a dark radial background. Returns a self-contained SVG **string** so it can drive both:
 *   - the in-app <HolyOlyIcon> brand mark (curved text renders against the app's Saira
 *     Condensed, which `theme.css` already loads), and
 *   - the standalone favicon / PWA icon (`withText: false` → no web-font dependency).
 *
 * Geometry, gradients and the final config values are copied verbatim from the design's
 * `Holy Oly App Icon.html` (the Tweaks panel's landed defaults).
 */

const VB = 512; // viewBox
const CX = 256; // plate centre x
const CY = 268; // plate centre y (nudged down a hair, per the design)

// Red competition-plate palette (the design's #d8262d with its derived rim/highlight shades).
const PAL = { color: "#d8262d", edge: "#9f1219", dark: "#680a10", light: "#f0726f" };

// Final landed config from the design's Tweaks panel.
const CFG = {
  topRadius: 116, topSpan: 110, // HOLY arc (centred north)
  botRadius: 160, botSpan: 78, //  OLY arc (centred south, smile)
  fontSize: 66, weight: 800, tracking: 1, botTracking: 8,
};

function pt(deg: number, r: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}
// Arc across the TOP, centred on 270° (north) — bigger span wraps the letters wider.
function arcTop(r: number, span: number): string {
  const half = span / 2;
  const [x1, y1] = pt(270 - half, r);
  const [x2, y2] = pt(270 + half, r);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
// Arc across the BOTTOM, centred on 90° (south) — a smile so the text reads upright.
function arcBottom(r: number, span: number): string {
  const half = span / 2;
  const [x1, y1] = pt(90 + half, r);
  const [x2, y2] = pt(90 - half, r);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function defs(uid: string): string {
  return (
    `<radialGradient id="band${uid}" cx="40%" cy="33%" r="80%">` +
      `<stop offset="0" stop-color="${PAL.light}"/><stop offset="50%" stop-color="${PAL.color}"/><stop offset="100%" stop-color="${PAL.edge}"/>` +
    `</radialGradient>` +
    `<linearGradient id="rim${uid}" x1="0" y1="1" x2="1" y2="0">` +
      `<stop offset="0" stop-color="${PAL.dark}"/><stop offset="55%" stop-color="${PAL.edge}"/><stop offset="100%" stop-color="${PAL.color}"/>` +
    `</linearGradient>` +
    `<radialGradient id="steel${uid}" cx="38%" cy="32%" r="84%">` +
      `<stop offset="0" stop-color="#ffffff"/><stop offset="45%" stop-color="#dadde0"/><stop offset="100%" stop-color="#9da1a6"/>` +
    `</radialGradient>` +
    `<radialGradient id="bore${uid}" cx="42%" cy="36%" r="80%">` +
      `<stop offset="0" stop-color="#8c9096"/><stop offset="100%" stop-color="#303236"/>` +
    `</radialGradient>` +
    `<radialGradient id="bg${uid}" cx="50%" cy="40%" r="78%">` +
      `<stop offset="0" stop-color="#2c2f34"/><stop offset="58%" stop-color="#191b1e"/><stop offset="100%" stop-color="#0c0d0f"/>` +
    `</radialGradient>` +
    `<radialGradient id="glow${uid}" cx="50%" cy="46%" r="50%">` +
      `<stop offset="0" stop-color="${PAL.color}" stop-opacity=".34"/><stop offset="100%" stop-color="${PAL.color}" stop-opacity="0"/>` +
    `</radialGradient>`
  );
}

function face(uid: string, withText: boolean): string {
  let s = "";
  s += `<circle cx="${CX}" cy="${CY}" r="192" fill="${PAL.edge}"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="186" fill="url(#band${uid})"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="186" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="3"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="100" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="3"/>`; // inner shadow toward the hub
  s += `<circle cx="${CX}" cy="${CY}" r="96" fill="url(#steel${uid})" stroke="rgba(0,0,0,.16)" stroke-width="1.5"/>`; // steel insert
  s += `<circle cx="${CX}" cy="${CY}" r="88" fill="none" stroke="rgba(0,0,0,.10)" stroke-width="1.5"/>`;
  s += `<circle cx="${CX}" cy="${CY}" r="30" fill="url(#bore${uid})"/>`; // bore
  s += `<circle cx="${CX}" cy="${CY}" r="30" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="2"/>`;
  if (withText) {
    const tp = `top${uid}`;
    const bp = `bot${uid}`;
    const common = `font-family="'Saira Condensed',sans-serif" fill="#ffffff" font-size="${CFG.fontSize}" font-weight="${CFG.weight}"`;
    s += `<path id="${tp}" d="${arcTop(CFG.topRadius, CFG.topSpan)}" fill="none"/>`;
    s += `<path id="${bp}" d="${arcBottom(CFG.botRadius, CFG.botSpan)}" fill="none"/>`;
    s += `<text ${common} letter-spacing="${CFG.tracking}"><textPath href="#${tp}" startOffset="50%" text-anchor="middle">HOLY</textPath></text>`;
    s += `<text ${common} letter-spacing="${CFG.botTracking}"><textPath href="#${bp}" startOffset="50%" text-anchor="middle">OLY</textPath></text>`;
  }
  return s;
}

export interface HolyOlyIconOpts {
  /** Unique suffix for gradient/clip ids so multiple instances don't collide. */
  uid: string;
  /** Render the curved HOLY/OLY wordmark (default true). Drop it for tiny standalone sizes. */
  withText?: boolean;
}

/** Build the full HOLY OLY app-icon `<svg>` markup as a string. */
export function holyOlyIconSvg({ uid, withText = true }: HolyOlyIconOpts): string {
  // ¾ perspective: the plate turns about a vertical axis, the rubber edge wall shows on the left.
  const sx = 0.82;
  const sy = 0.985;
  const R = -5;
  const T = `translate(${CX} ${CY}) rotate(${R}) scale(${sx} ${sy}) translate(${-CX} ${-CY})`;
  const ox = -34;
  const oy = 7;

  const wall =
    `<g transform="translate(${ox} ${oy})"><g transform="${T}">` +
      `<circle cx="${CX}" cy="${CY}" r="192" fill="url(#rim${uid})"/>` +
    `</g></g>` +
    `<g transform="translate(${ox - 1} ${oy})"><g transform="${T}">` +
      `<circle cx="${CX}" cy="${CY}" r="192" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3"/>` +
    `</g></g>`;

  const plate =
    `${wall}<g transform="${T}">` +
    `<circle cx="${CX}" cy="${CY}" r="192" fill="none" stroke="rgba(0,0,0,.22)" stroke-width="2"/>` +
    `${face(uid, withText)}</g>`;

  const bg =
    `<rect width="${VB}" height="${VB}" fill="url(#bg${uid})"/>` +
    `<ellipse cx="${CX - 6}" cy="${CY + 2}" rx="220" ry="206" fill="url(#glow${uid})"/>` +
    `<ellipse cx="${CX - 10}" cy="${CY + 196}" rx="176" ry="30" fill="rgba(0,0,0,.5)"/>`; // contact shadow

  return (
    `<svg viewBox="0 0 ${VB} ${VB}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" ` +
    `role="img" aria-label="HOLY OLY app icon"><defs>${defs(uid)}</defs>${bg}${plate}</svg>`
  );
}
