import type { ReactNode } from "react";

const MOUTHS: Record<number, string> = {
  1: "M12.5 26 Q20 20.5 27.5 26",
  2: "M12.5 26 Q20 23 27.5 26",
  3: "M12.5 25.5 L27.5 25.5",
  4: "M12.5 25 Q20 29 27.5 25",
  5: "M12 24.5 Q20 31.5 28 24.5",
};

/** Monochrome 1-5 face (5 = happiest). Uses currentColor only — never a state color. */
export function Face({ level }: { level: number }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" style={{ display: "block" }}>
      <g fill="currentColor">
        <circle cx="15" cy="17" r="2.1" />
        <circle cx="25" cy="17" r="2.1" />
      </g>
      <path d={MOUTHS[level] ?? MOUTHS[3]} stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export const NavIcon: Record<"hoy" | "prog" | "cuenta", ReactNode> = {
  hoy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  ),
  prog: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19V5M4 19h16" />
      <path d="M7 15l3.5-4 3 2.5L20 7" />
    </svg>
  ),
  cuenta: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
};

export function Check({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}
