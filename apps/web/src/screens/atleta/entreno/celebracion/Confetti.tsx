import { useMemo } from "react";

const PALETTE = ["var(--wl-accent)", "var(--wl-accent-2)", "var(--ok)", "var(--warn)", "var(--wl-text)"];

/** Confeti que cae al montar — compositor-friendly (transform/opacity); prefers-reduced-motion lo apaga. */
export function Confetti({ count = 50 }: { count?: number }) {
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      bg: PALETTE[i % PALETTE.length]!,
      delay: Math.random() * 0.9,
      dur: 2.1 + Math.random() * 1.4,
      rot: Math.random() * 360,
      w: 6 + Math.random() * 5,
      h: 9 + Math.random() * 7,
      round: Math.random() > 0.7,
    })),
    [count], // palette es estable
  );
  return (
    <div className="cf-layer" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="cf-piece"
          style={{
            left: `${p.left}%`, background: p.bg, width: `${p.w}px`, height: `${p.h}px`,
            borderRadius: p.round ? "50%" : "1.5px", transform: `rotate(${p.rot}deg)`,
            animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
