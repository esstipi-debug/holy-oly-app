import { useState } from "react";
import type { WarmupSet } from "@holy-oly/core";
import { DiscRow } from "../../../ui/Disc";

/** Calentamiento: volumen de base + afinación técnica (decisión owner 2026-06-11 — el copy
 *  jamás lo desestima). Sigue salteable (colapsable) y fuera de la gamificación. Discos vía
 *  DiscRow. Su tonelaje se reporta aparte (warmupTonnage) y JAMÁS entra al monitor. */
export function WarmupSection({ sets, barKg }: { sets: WarmupSet[]; barKg: number }) {
  const [open, setOpen] = useState(true);
  if (sets.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <button
        type="button"
        aria-label="calentamiento"
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", border: 0, background: "transparent", padding: 0, cursor: "pointer", fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)" }}
      >
        <span>Calentamiento · técnica + volumen de base</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {sets.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontFamily: "var(--wl-display)", fontSize: 12, color: "var(--wl-muted)", minWidth: 44 }}>
                {s.label === "barra" ? "Barra" : `${s.pct}%`}
              </span>
              <DiscRow kg={s.kg} barKg={barKg} />
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 15, color: "var(--wl-text)", whiteSpace: "nowrap" }}>
                {s.kg}<span style={{ fontSize: 11, color: "var(--wl-muted)" }}> kg × {s.reps}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
