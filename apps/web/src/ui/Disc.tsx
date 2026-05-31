import { perSide, DISC_COLORS, type Disc as DiscW } from "@holy-oly/core";

export function Disc({ w, size = 28 }: { w: DiscW; size?: number }) {
  const [fill, edge, light] = DISC_COLORS[w];
  const id = `d${w}-${Math.round(size)}`;
  const numColor = w === 15 ? "#3a2a00" : "#fff";
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} style={{ display: "block" }}>
      <defs><radialGradient id={id} cx="42%" cy="34%" r="75%">
        <stop offset="0" stopColor={light} /><stop offset="55%" stopColor={fill} /><stop offset="100%" stopColor={edge} />
      </radialGradient></defs>
      <circle cx="16" cy="16" r="15" fill={edge} />
      <circle cx="16" cy="16" r="14" fill={`url(#${id})`} />
      <circle cx="16" cy="16" r="6" fill="#dde0e4" stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      <circle cx="16" cy="16" r="1.9" fill="#33363a" />
      <text x="16" y="10.5" textAnchor="middle" fontSize="6.4" fontWeight="800" fill={numColor} fontFamily="Saira Condensed, sans-serif">{w}</text>
    </svg>
  );
}

export function DiscRow({ kg, barKg = 20 }: { kg: number; barKg?: number }) {
  const discs = perSide(kg, barKg);
  return <div style={{ display: "flex", gap: 3, alignItems: "center" }}>{discs.map((d, i) => <Disc key={i} w={d} />)}</div>;
}
