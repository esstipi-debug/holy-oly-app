/**
 * Demo-only (T2): the prospect tour as a single on-brand bottom guide card (NOT a spotlight cutout —
 * that's the AI-slop look the system avoids). Lists the 5-step path that ends in the money shot, then
 * dismisses (persisting `ho:tourSeen` so it doesn't reappear; the T4 reset clears it). The interactive
 * step-by-step choreography across screens is a follow-up (T2b); the plan says start with this card.
 */
import { useState } from "react";
import { isTourSeen, markTourSeen } from "../../../data/demoTour";

const STEPS = [
  "Mirá el plantel y quién está en riesgo — la guía de arriba dice por qué mirar a cada uno.",
  "Tocá un atleta para abrir su detalle.",
  "Mirá su año de datos: carga, recuperación, IMR vs fase.",
  "Cambiale un peso o el plan, como coach.",
  "Tocá «Atleta» en el detalle y mirá cómo lo recibe, con los discos.",
];

export function DemoTourCard({ storage = window.localStorage, onDismiss }: { storage?: Storage; onDismiss?: () => void }) {
  const [open, setOpen] = useState(() => !isTourSeen(storage));
  if (!open) return null;

  const dismiss = () => { markTourSeen(storage); setOpen(false); onDismiss?.(); };

  return (
    <section
      aria-label="Recorrido de la demo"
      data-testid="demo-tour-card"
      style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, width: "min(92vw, 400px)", zIndex: 50, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", borderRadius: 12, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}
    >
      <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--wl-muted)" }}>Recorrido de la demo</div>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 17, margin: "4px 0 10px", lineHeight: 1.05 }}>En 5 pasos mostrás el corazón del producto</div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
        {STEPS.map((s, i) => (
          <li key={i} style={{ display: "flex", gap: 9, alignItems: "baseline", fontSize: 12.5, color: "var(--wl-text)", lineHeight: 1.35 }}>
            <span style={{ flex: "0 0 auto", fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 12, color: "var(--wl-accent)" }}>{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={dismiss}
        style={{ minHeight: 44, width: "100%", marginTop: 12, borderRadius: 9, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
      >
        Entendido, empezar
      </button>
    </section>
  );
}
