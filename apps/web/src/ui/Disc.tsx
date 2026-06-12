import { useId } from "react";
import { perSide, DISC_COLORS, type Disc as DiscW } from "@holy-oly/core";

/**
 * El disco IWF canónico — kg manda, los discos aproximan (solo 10/15/20/25 de core).
 *
 * Dos vistas (decisión owner 2026-06-12):
 *  - "3q" (default): perspectiva ¾ portada de `holyOlyIconSvg` (misma geometría, pared de goma
 *    a la izquierda) — es la vista de TODAS las filas de entrenamiento.
 *  - "front": frontal plana ajustada — el número va SIEMPRE en blanco (el 15 amarillo incluido).
 * Los números nunca cambian de color por peso; el color del disco viene de DISC_COLORS de core.
 */
export type DiscView = "front" | "3q";

/** Tono oscuro del rim por peso — derivado visual del edge, solo para el gradiente de la pared ¾. */
const RIM_DARK: Record<DiscW, string> = {
  10: "#1c5c24",
  15: "#8a6c00",
  20: "#12365a",
  25: "#6e0f14",
};

/** Perspectiva del ícono: giro sobre el eje vertical, pared visible a la izquierda. */
const T = "translate(256 268) rotate(-5) scale(0.82 0.985) translate(-256 -268)";

function FrontDisc({ w, size, uid }: { w: DiscW; size: number; uid: string }) {
  const [fill, edge, light] = DISC_COLORS[w];
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} style={{ display: "block" }} data-view="front">
      <defs><radialGradient id={uid} cx="42%" cy="34%" r="75%">
        <stop offset="0" stopColor={light} /><stop offset="55%" stopColor={fill} /><stop offset="100%" stopColor={edge} />
      </radialGradient></defs>
      <circle cx="16" cy="16" r="15" fill={edge} />
      <circle cx="16" cy="16" r="14" fill={`url(#${uid})`} />
      <circle cx="16" cy="16" r="6" fill="#dde0e4" stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      <circle cx="16" cy="16" r="1.9" fill="#33363a" />
      <text x="16" y="10.5" textAnchor="middle" fontSize="6.4" fontWeight="800" fill="#fff" fontFamily="Saira Condensed, sans-serif">{w}</text>
    </svg>
  );
}

function ThreeQuarterDisc({ w, size, uid }: { w: DiscW; size: number; uid: string }) {
  const [fill, edge, light] = DISC_COLORS[w];
  return (
    <svg viewBox="34 66 410 410" width={size} height={size} style={{ display: "block" }} data-view="3q">
      <defs>
        <radialGradient id={`b${uid}`} cx="40%" cy="33%" r="80%">
          <stop offset="0" stopColor={light} /><stop offset="50%" stopColor={fill} /><stop offset="100%" stopColor={edge} />
        </radialGradient>
        <linearGradient id={`r${uid}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={RIM_DARK[w]} /><stop offset="55%" stopColor={edge} /><stop offset="100%" stopColor={fill} />
        </linearGradient>
        <radialGradient id={`s${uid}`} cx="38%" cy="32%" r="84%">
          <stop offset="0" stopColor="#ffffff" /><stop offset="45%" stopColor="#dadde0" /><stop offset="100%" stopColor="#9da1a6" />
        </radialGradient>
        <radialGradient id={`o${uid}`} cx="42%" cy="36%" r="80%">
          <stop offset="0" stopColor="#8c9096" /><stop offset="100%" stopColor="#303236" />
        </radialGradient>
      </defs>
      <g transform="translate(-34 7)"><g transform={T}>
        <circle cx="256" cy="268" r="192" fill={`url(#r${uid})`} />
      </g></g>
      <g transform="translate(-35 7)"><g transform={T}>
        <circle cx="256" cy="268" r="192" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="3" />
      </g></g>
      <g transform={T}>
        <circle cx="256" cy="268" r="192" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="2" />
        <circle cx="256" cy="268" r="192" fill={edge} />
        <circle cx="256" cy="268" r="186" fill={`url(#b${uid})`} />
        <circle cx="256" cy="268" r="186" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3" />
        <circle cx="256" cy="268" r="100" fill="none" stroke="rgba(0,0,0,.18)" strokeWidth="3" />
        <circle cx="256" cy="268" r="96" fill={`url(#s${uid})`} stroke="rgba(0,0,0,.16)" strokeWidth="1.5" />
        <circle cx="256" cy="268" r="88" fill="none" stroke="rgba(0,0,0,.10)" strokeWidth="1.5" />
        <circle cx="256" cy="268" r="30" fill={`url(#o${uid})`} />
        <circle cx="256" cy="268" r="30" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="2" />
        <text x="256" y="158" textAnchor="middle" fontSize="100" fontWeight="800" fill="#fff" fontFamily="Saira Condensed, sans-serif">{w}</text>
      </g>
    </svg>
  );
}

export function Disc({ w, size = 28, view = "3q" }: { w: DiscW; size?: number; view?: DiscView }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return view === "front"
    ? <FrontDisc w={w} size={size} uid={uid} />
    : <ThreeQuarterDisc w={w} size={size} uid={uid} />;
}

export function DiscRow({ kg, barKg = 20, view = "3q" }: { kg: number; barKg?: number; view?: DiscView }) {
  const discs = perSide(kg, barKg);
  return <div style={{ display: "flex", gap: 3, alignItems: "center" }}>{discs.map((d, i) => <Disc key={i} w={d} view={view} />)}</div>;
}
