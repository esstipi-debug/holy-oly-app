import type { ReactNode } from "react";
import type { CellState } from "@holy-oly/core";
import { STATUS } from "../../../ui/status";

// Color = estado (the ONLY place color = estado on Hoy) — derivado de la paleta oficial ui/status.ts.
const ST: Record<"ok" | "warn" | "alert", string> = { ok: STATUS.ok, warn: STATUS.warn, alert: STATUS.alert };
const COPY: Record<"ok" | "warn" | "alert", { st: string; msg: ReactNode }> = {
  ok: { st: "Vas bien", msg: <>Tu recuperación está <b>en tu rango normal</b>. Seguí el plan como viene.</> },
  warn: { st: "Cuidate hoy", msg: <>Tu recuperación está algo por debajo de tu normal. Hoy bajá un escalón la intensidad y <b>priorizá dormir</b>.</> },
  alert: { st: "Pará la oreja", msg: <>Tu recuperación está bastante por debajo de tu normal. Hoy conviene <b>aflojar</b> — hablalo con tu coach.</> },
};

/** Estado de hoy. `none` → honest empty variant (new athlete); never a false-green. */
export function Titular({ state }: { state: CellState }) {
  if (state === "none") {
    return (
      <div className="ho-titular" style={{ background: "color-mix(in srgb, var(--wl-text) 5%, transparent)", borderColor: "color-mix(in srgb, var(--wl-text) 14%, transparent)" }}>
        <div className="ho-titular__row">
          <span className="ho-titular__dot" style={{ background: "color-mix(in srgb, var(--wl-text) 20%, transparent)" }} />
          <div>
            <div className="ho-titular__lbl">Mi estado de hoy</div>
            <div className="ho-titular__st" style={{ color: "var(--wl-muted)" }}>Sin datos aún</div>
          </div>
        </div>
        <p className="ho-titular__msg">Todavía no hay registros para leer tu estado. Tu primer <b>check-in</b> empieza a construir tu normal — sin historial, no inventamos un estado.</p>
      </div>
    );
  }
  const col = ST[state];
  const c = COPY[state];
  return (
    <div className="ho-titular" style={{ background: `color-mix(in srgb, ${col} 14%, transparent)`, borderColor: `color-mix(in srgb, ${col} 45%, transparent)` }}>
      <div className="ho-titular__row">
        <span className="ho-titular__dot" style={{ background: col, boxShadow: `0 0 18px ${col}99` }} />
        <div>
          <div className="ho-titular__lbl">Mi estado de hoy</div>
          <div className="ho-titular__st" style={{ color: col }}>{c.st}</div>
        </div>
      </div>
      <p className="ho-titular__msg">{c.msg}</p>
    </div>
  );
}
