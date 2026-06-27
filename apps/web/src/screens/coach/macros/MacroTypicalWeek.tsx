import { useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import type { Macrocycle } from "@holy-oly/core";
import { typicalWeek } from "./composition";

const chipRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 };
const chipBase: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".04em", padding: "5px 10px", borderRadius: 99,
  cursor: "pointer", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "transparent",
};
const chipActive: CSSProperties = {
  ...chipBase, color: "var(--wl-bg)", background: "var(--wl-accent)", borderColor: "var(--wl-accent)", fontWeight: 700,
};
const chipIdle: CSSProperties = { ...chipBase, color: "var(--wl-muted)" };
const note: CSSProperties = { fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginBottom: 8 };
const card: CSSProperties = { background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "9px 11px" };
const dayHead: CSSProperties = {
  fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 7,
};
const exRow: CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "5px 0",
};
const exName: CSSProperties = {
  fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, color: "var(--wl-text)",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
const doseCol: CSSProperties = { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.1 };
const exPct: CSSProperties = { fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 14, color: "var(--wl-accent)", fontVariantNumeric: "tabular-nums" };
const exSets: CSSProperties = { fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 2 };
const kgNote: CSSProperties = { fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 8, lineHeight: 1.45 };

/**
 * «Semana tipo» del macro para el coach: la primera semana de la fase elegida, sesión por sesión,
 * con cada movimiento y su % — sin tener que tocar día por día. El % ES la intensidad del template
 * (los kg nacen recién al asignar, derivados de los RMs). Chips para recorrer las fases y ver cómo
 * evoluciona la composición. Sin receta sesión-por-sesión → no se monta (el mapa de calor de abajo
 * ya muestra su empty-state).
 */
export function MacroTypicalWeek({ macro }: { macro: Macrocycle }) {
  const { t } = useTranslation("macros");
  const phases = macro.phaseProfile;
  const [sel, setSel] = useState(() => phases[0]?.key ?? "");
  const sessions = useMemo(() => typicalWeek(macro, sel), [macro, sel]);
  if (!sessions) return null;

  const selPhase = phases.find((p) => p.key === sel);
  const span = selPhase && selPhase.weeks[0] !== selPhase.weeks[1] ? `${selPhase.weeks[0]}–${selPhase.weeks[1]}` : `${selPhase?.weeks[0] ?? ""}`;

  return (
    <div>
      {phases.length > 1 && (
        <div style={chipRow}>
          {phases.map((p) => (
            <button key={p.key} type="button" onClick={() => setSel(p.key)} style={p.key === sel ? chipActive : chipIdle}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      <div style={note}>{t("mtwRepWeek")}{selPhase ? ` · ${selPhase.name} · ${t("mtwWeekSpan", { span })}` : ""}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map((s) => (
          <div key={s.day} style={card}>
            <div style={dayHead}>{t("mtwDay", { day: s.day + 1 })}</div>
            {s.exercises.map((e, i) => (
              <div key={`${s.day}-${i}`} style={exRow}>
                <span style={exName}>{e.name}</span>
                <span style={doseCol}>
                  {e.pct != null && <span style={exPct}>{e.pct}%</span>}
                  <span style={exSets}>{e.sets}×{e.reps}</span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={kgNote}>{t("kgOnAssign")}</div>
    </div>
  );
}
