import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("coach");
  if (!isComplexId(movementId)) return null;
  const c = getComplex(movementId);
  if (!c) return null;

  const loads = complexLoads(c);
  const cx = complexComplexity(c);
  const ceiling = complexPctCeiling(c);
  const weakRef = rms ? complexWeakRmRef(c, rms) : "none";
  const weakKg = rms ? complexWeakRmKg(c, rms) : undefined;

  return (
    <div style={wrap} aria-label={t("cxAnalysisAria", { name: c.name })}>
      <div style={row}>
        <span style={{ ...label, color: "var(--wl-accent)" }}>{t("cxNeuralLoad")}</span>
        <Metric name={t("cxSnc")} value={`${loads.snc}/10`} />
        <Metric name={t("cxAxial")} value={`${loads.axial}/10`} />
        <Metric name={t("cxMetab")} value={`${loads.metabolica}/10`} />
      </div>
      <div style={{ ...row, marginTop: 4 }}>
        <Metric name={t("cxComplexity")} value={`${cx}/12`} />
        <Metric name={t("cxCeiling")} value={`${ceiling}%`} />
      </div>
      {weakRef !== "none" && (
        <div style={{ ...row, marginTop: 4, alignItems: "center" }}>
          <span style={label}>{t("cxWeakLink")}</span>
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
