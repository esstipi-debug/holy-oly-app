import { useId } from "react";

type Metal = "oro" | "plata" | "bronce";

const METALS: Record<Metal, {
  rim: [string, string, string];
  face: [string, string, string];
  plate: [string, string];
  sheen: string;
  sw: string;
  name: string;
}> = {
  oro: {
    rim:   ["#ffedb0", "#d59b2c", "#875812"],
    face:  ["#fff8da", "#f6c94f", "#a96d12"],
    plate: ["#b78c2c", "#946818"],
    sheen: "#fff6d8",
    sw:    "#e7b53a",
    name:  "Oro",
  },
  plata: {
    rim:   ["#f4f7fa", "#abb7c3", "#5d6975"],
    face:  ["#ffffff", "#cad3dd", "#717e8c"],
    plate: ["#aab4bf", "#8b97a4"],
    sheen: "#ffffff",
    sw:    "#b9c2cc",
    name:  "Plata",
  },
  bronce: {
    rim:   ["#eec197", "#b1713b", "#693b18"],
    face:  ["#f8d6b1", "#d18a4f", "#7d451a"],
    plate: ["#b07a48", "#8a5a2e"],
    sheen: "#ffe3c6",
    sw:    "#c07f49",
    name:  "Bronce",
  },
};

const RIBBON_COLS = ["#1f47bf", "#fbfcfe", "#1f47bf", "#fbfcfe", "#1f47bf"] as const;

export function Medal({ metal, size = 40 }: { metal: Metal; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const fid = `f${uid}`;
  const rid = `r${uid}`;
  const pid = `p${uid}`;

  const m = METALS[metal] ?? METALS.oro;

  // Ribbon geometry
  const rx = 21, rw = 22, ry = 1, rh = 36;
  const sw = rw / RIBBON_COLS.length; // = 4.4

  // Disc geometry
  const cx = 32, cy = 54, r = 24;

  return (
    <svg
      viewBox="0 0 64 80"
      width={size}
      height={Math.round(size * 1.25)}
      style={{ display: "block" }}
      role="img"
      aria-label={m.name}
    >
      <defs>
        {/* Face radial gradient: cx=38% cy=30% r=78% */}
        <radialGradient id={fid} cx="38%" cy="30%" r="78%">
          <stop offset="0"    stopColor={m.face[0]} />
          <stop offset="45%"  stopColor={m.face[1]} />
          <stop offset="100%" stopColor={m.face[2]} />
        </radialGradient>
        {/* Rim linear gradient: x1=0 y1=0 x2=1 y2=1 */}
        <linearGradient id={rid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0"    stopColor={m.rim[0]} />
          <stop offset="50%"  stopColor={m.rim[1]} />
          <stop offset="100%" stopColor={m.rim[2]} />
        </linearGradient>
        {/* Plate radial gradient: cx=50% cy=50% r=62% */}
        <radialGradient id={pid} cx="50%" cy="50%" r="62%">
          <stop offset="0"    stopColor={m.plate[0]} />
          <stop offset="100%" stopColor={m.plate[1]} />
        </radialGradient>
      </defs>

      {/* Ribbon (behind disc) */}
      {RIBBON_COLS.map((col, i) => (
        <rect
          key={i}
          x={parseFloat((rx + i * sw).toFixed(2))}
          y={ry}
          width={parseFloat((sw + 0.3).toFixed(2))}
          height={rh}
          fill={col}
        />
      ))}
      {/* Ribbon border */}
      <rect
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        fill="none"
        stroke="#0e2a73"
        strokeWidth={0.6}
        strokeOpacity={0.45}
      />

      {/* Disc */}
      {/* Rim fill */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#${rid})`} />
      {/* Rim edge shadow */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#000" strokeWidth={0.5} strokeOpacity={0.35} />
      {/* Face */}
      <circle cx={cx} cy={cy} r={parseFloat((r * 0.84).toFixed(2))} fill={`url(#${fid})`} />
      {/* Plate fill */}
      <circle cx={cx} cy={cy} r={parseFloat((r * 0.5).toFixed(2))} fill={`url(#${pid})`} />
      {/* Plate inner shadow */}
      <circle cx={cx} cy={cy} r={parseFloat((r * 0.5).toFixed(2))} fill="none" stroke="#000" strokeWidth={1.6} strokeOpacity={0.14} />
      {/* Plate sheen */}
      <circle cx={cx} cy={cy} r={parseFloat((r * 0.5).toFixed(2))} fill="none" stroke={m.sheen} strokeWidth={0.7} strokeOpacity={0.5} />
    </svg>
  );
}
