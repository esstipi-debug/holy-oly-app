import type { CSSProperties } from "react";
import {
  isComplexId, getComplex, complexLoads, complexComplexity, complexPctCeiling,
  complexWeakRmRef, complexWeakRmKg, type RM, type RmRef,
} from "@holy-oly/core";
import { DiscRow } from "../../../ui/Disc";

/** Análisis de carga neural de un complejo (COACH-ONLY): lo que el core ya computa pero hasta hoy
 *  no se veía. SNC/axial/metabólica + complejidad técnica + tope % programable + eslabón débil.
 *  Sólo aparece cuando el movimiento es un `cx.*` real; cualquier otro id → null (oculto honesto). */

const RM_LABEL: Record<RmRef, string> = {
  arranque: "Arranque", envion: "Envión", sentadilla: "Sentadilla", frente: "Frente", none: "—",
};

const wrap: CSSProperties = {
  marginTop: 6, padding: "6px 8px", borderRadius: 8,
  background: "color-mix(in srgb,var(--wl-accent) 7%,transparent)",
  border: "1px solid color-mix(in srgb,var(--wl-accent) 22%,transparent)",
};
const row: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" };
const label: CSSProperties = { textTransform: "uppercase", letterSpacing: ".08em", fontSize: 8.5, color: "var(--wl-muted)" };
const val: CSSProperties = { color: "var(--wl-text)", fontWeight: 700 };

function Metric({ name, value }: { name: string; value: number | string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 3 }}>
      <span style={label}>{name}</span><span style={val}>{value}</span>
    </span>
  );
}

export function ComplexAnalysis({ movementId, rms }: { movementId: string; rms?: RM }) {
  if (!isComplexId(movementId)) return null;
  const c = getComplex(movementId);
  if (!c) return null;

  const loads = complexLoads(c);
  const cx = complexComplexity(c);
  const ceiling = complexPctCeiling(c);
  const weakRef = rms ? complexWeakRmRef(c, rms) : "none";
  const weakKg = rms ? complexWeakRmKg(c, rms) : undefined;

  return (
    <div style={wrap} aria-label={`análisis del complejo ${c.name}`}>
      <div style={row}>
        <span style={{ ...label, color: "var(--wl-accent)" }}>Carga neural</span>
        <Metric name="SNC" value={`${loads.snc}/10`} />
        <Metric name="Axial" value={`${loads.axial}/10`} />
        <Metric name="Metab" value={`${loads.metabolica}/10`} />
      </div>
      <div style={{ ...row, marginTop: 4 }}>
        <Metric name="Complej" value={`${cx}/12`} />
        <Metric name="Tope" value={`${ceiling}%`} />
      </div>
      {weakRef !== "none" && (
        <div style={{ ...row, marginTop: 4, alignItems: "center" }}>
          <span style={label}>Eslabón débil</span>
          <span style={val}>{RM_LABEL[weakRef]}</span>
          {weakKg != null && (
            <>
              <span style={val}>{weakKg} kg</span>
              <DiscRow kg={weakKg} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
