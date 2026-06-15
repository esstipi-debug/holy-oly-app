/**
 * Mi Progreso (rediseño) — carrusel de slides: flechas infinitas + swipe táctil + dots.
 * Una sola presentación (las 5 variantes del mock no se portan — YAGNI). Recuerda la última slide
 * en localStorage por `key`. El track desliza con transform/translate (compositor-friendly).
 */
import { useCallback, useRef, useState, type ReactNode } from "react";

export interface CarouselSlide {
  key: string;
  node: ReactNode;
}

const EASE = "transform .35s cubic-bezier(.16,1,.3,1)";

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute", top: "42%", [side]: 2, transform: "translateY(-50%)",
    width: 34, height: 34, borderRadius: 99, border: "1px solid color-mix(in srgb, var(--wl-muted) 70%, transparent)",
    background: "color-mix(in srgb, var(--wl-surface) 82%, transparent)", color: "var(--wl-text)",
    fontSize: 22, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", zIndex: 2, padding: 0, backdropFilter: "blur(4px)",
  };
}

export function ProgresoCarousel({ slides, storageKey }: { slides: CarouselSlide[]; storageKey?: string }) {
  const n = slides.length;
  const [idx, setIdxRaw] = useState(() => {
    if (!storageKey) return 0;
    try {
      const k = localStorage.getItem(storageKey);
      const found = slides.findIndex((s) => s.key === k);
      return found >= 0 ? found : 0;
    } catch { return 0; }
  });
  const i = n > 0 ? Math.min(idx, n - 1) : 0;
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [snap, setSnap] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const gesture = useRef({ active: false, sx: 0, sy: 0, locked: null as null | "x" | "y", w: 0 });

  const go = useCallback((next: number) => {
    setIdxRaw(next);
    if (storageKey) { try { localStorage.setItem(storageKey, slides[next]?.key ?? ""); } catch { /* noop */ } }
  }, [storageKey, slides]);

  const commit = useCallback((dir: number) => {
    if (n === 0) return;
    const next = (i + dir + n) % n;
    // salto de borde (infinito): aplicar sin transición para que se sienta continuo.
    if ((i === n - 1 && dir > 0) || (i === 0 && dir < 0)) {
      setSnap(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setSnap(false)));
    }
    go(next);
  }, [n, i, go]);

  const onDown = (e: React.PointerEvent) => {
    gesture.current = { active: true, sx: e.clientX, sy: e.clientY, locked: null, w: wrapRef.current?.offsetWidth ?? 320 };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g.active) return;
    const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    if (g.locked == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) g.locked = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (g.locked === "x") setDrag(dx);
  };
  const end = () => {
    const g = gesture.current;
    if (!g.active) return;
    if (g.locked === "x") {
      const threshold = Math.min(g.w * 0.2, 90);
      if (drag <= -threshold) commit(1);
      else if (drag >= threshold) commit(-1);
    }
    g.active = false; g.locked = null;
    setDrag(0); setDragging(false);
  };

  if (n === 0) return null;

  const tx = `calc(${-i * 100}% + ${drag}px)`;
  return (
    <div className="pg-carousel">
      <div className="pg-body" style={{ position: "relative" }}>
        <div
          className="pg-track-wrap"
          ref={wrapRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={() => { if (gesture.current.active) end(); }}
          style={{ overflow: "hidden", touchAction: "pan-y" }}
        >
          <div
            className={"pg-track" + (dragging ? " is-dragging" : "") + (snap ? " is-snap" : "")}
            style={{ display: "flex", transform: `translateX(${tx})`, transition: dragging || snap ? "none" : EASE }}
          >
            {slides.map((s, k) => (
              <div key={s.key} className="pg-slide" aria-hidden={k !== i} style={{ flex: "0 0 100%", minWidth: 0 }}>
                {s.node}
              </div>
            ))}
          </div>
        </div>
        {n > 1 && (
          <>
            <button type="button" aria-label="Anterior" onClick={() => commit(-1)} style={arrowStyle("left")}>‹</button>
            <button type="button" aria-label="Siguiente" onClick={() => commit(1)} style={arrowStyle("right")}>›</button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="pg-dots" role="tablist" style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
          {slides.map((s, k) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={s.key}
              onClick={() => go(k)}
              style={{
                width: k === i ? 18 : 7, height: 7, borderRadius: 99, border: "none", cursor: "pointer", padding: 0,
                background: k === i ? "var(--wl-accent)" : "color-mix(in srgb, var(--wl-text) 22%, transparent)",
                transition: "width .2s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
