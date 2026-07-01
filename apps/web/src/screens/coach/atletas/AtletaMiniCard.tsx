import { useTranslation } from "react-i18next";
import type { CellState, CoachRisk } from "@holy-oly/core";
import type { RosterRow } from "../roster";
import { STATUS } from "../../../ui/status";
import { LEGEND_NOISE } from "./legendNoise";

export const ITEM_SHORT: Record<string, string> = {
  sueno: "Sueño", estres: "Estrés", fatiga: "Fatiga", dolor: "Dolor", motivacion: "Motiv.",
};

function riskLabel(r: CoachRisk): string {
  return r.loadNote === "sobrecarga" ? "Riesgo sobrecarga" : `${ITEM_SHORT[r.item] ?? r.item} ${r.days}d`;
}

/** Tendencia de readiness (Δ vs. semana previa, signo+valor): ▲ sube · ▼ baja · → estable.
 *  Sin dato (trend == null) → no se pinta (sin-dato honesto, nunca una flecha inventada). */
function TrendChip({ trend }: { trend: number | undefined }) {
  const { t } = useTranslation("roster");
  if (trend == null) return null;
  const dir = trend > 0 ? "up" : trend < 0 ? "down" : "flat";
  const glyph = dir === "up" ? "▲" : dir === "down" ? "▼" : "→";
  const color = dir === "up" ? "var(--ok)" : dir === "down" ? "var(--alert)" : "var(--wl-muted)";
  const mag = Math.abs(trend);
  const dirLabel = t(dir === "up" ? "trendUp" : dir === "down" ? "trendDown" : "trendFlat");
  return (
    <span
      aria-label={t("trendAria", { dir: dirLabel, mag })}
      title={t("trendTitle", { delta: `${trend > 0 ? "+" : ""}${trend}` })}
      style={{ display: "inline-flex", alignItems: "center", gap: 2, fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color, lineHeight: 1 }}
    >
      <span style={{ fontSize: 9 }}>{glyph}</span>{mag > 0 ? mag : ""}
    </span>
  );
}

function HeatStrip({ history }: { history: CellState[] }) {
  const last7 = history.slice(-7);
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {last7.map((k, i) => (
        <div key={i} style={{
          width: 11, height: 11, borderRadius: 3,
          background: k === "none" ? "transparent" : STATUS[k],
          border: k === "none" ? `1px dashed ${STATUS.none}` : "none",
        }} />
      ))}
    </div>
  );
}

/** Mini-card de atleta (estilo FUT): initials + readiness + nombre + heat-strip. Tap → drill-down.
 *  El color de la barra/initials sale del estado (STATUS); sin-dato → "—" (nunca un número inventado). */
export function AtletaMiniCard({ row, onPick }: { row: RosterRow; onPick: (id: string) => void }) {
  const { t } = useTranslation(["roster", "common"]);
  const nd = row.cell === "none";
  const st = STATUS[row.cell];
  return (
    <button type="button" onClick={() => onPick(row.id)}
      aria-label={t("miniAria", { name: row.nombre, readiness: nd ? t("miniNoData") : row.readiness })}
      style={{
        position: "relative", textAlign: "left", borderRadius: 16, overflow: "hidden", padding: "12px 13px",
        cursor: "pointer", color: "var(--wl-text)",
        background: "linear-gradient(158deg, var(--wl-surface-2) 0%, var(--wl-surface) 55%, var(--wl-bg) 100%)", border: "1px solid rgba(255,255,255,.08)",
      }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: LEGEND_NOISE, backgroundSize: "90px", opacity: .05, mixBlendMode: "overlay", pointerEvents: "none" }} />
      <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${st}, transparent)` }} />
      <div style={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `color-mix(in srgb, ${st} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${st} 45%, transparent)`, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: nd ? "var(--wl-muted)" : st }}>{row.iniciales}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 28, lineHeight: .9, color: nd ? "var(--wl-muted)" : "var(--wl-text)" }}>{nd ? "—" : row.readiness}</span>
          {!nd && <TrendChip trend={row.trend} />}
        </div>
      </div>
      <div style={{ position: "relative", marginTop: 10 }}>
        <div style={{ fontFamily: "var(--wl-cond, var(--wl-display))", fontWeight: 700, fontSize: 17, letterSpacing: .2, textTransform: "uppercase", lineHeight: 1, color: "var(--wl-text)" }}>{row.nombre}</div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, color: "var(--wl-muted)", textTransform: "uppercase", marginTop: 3 }}>{row.metodo}{row.cat ? ` · ${row.cat}` : ""}</div>
      </div>
      {/* Alerta: sin RM no se puede prescribir. El coach lo ve sin entrar al drill-down. */}
      {row.needsRm && (
        <div style={{ position: "relative", marginTop: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 99,
            background: "color-mix(in srgb, var(--wl-accent) 16%, transparent)",
            border: "1px solid color-mix(in srgb, var(--wl-accent) 50%, transparent)",
            color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
          }}>
            <span aria-hidden="true">⚠</span> {t("common:missingRm")}
          </span>
        </div>
      )}
      {/* Riesgo predictivo de bienestar (coach-only). Reusar estilo needsRm pill, color por severidad. */}
      {row.risk && (
        <div style={{ position: "relative", marginTop: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 99,
            background: `color-mix(in srgb, ${STATUS[row.risk.severity === "alert" ? "alert" : "warn"]} 16%, transparent)`,
            border: `1px solid color-mix(in srgb, ${STATUS[row.risk.severity === "alert" ? "alert" : "warn"]} 50%, transparent)`,
            color: STATUS[row.risk.severity === "alert" ? "alert" : "warn"],
            fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
          }}>
            <span aria-hidden="true">⚠</span> {riskLabel(row.risk)}
          </span>
        </div>
      )}
      <div style={{ position: "relative", marginTop: 9 }}><HeatStrip history={row.history} /></div>
    </button>
  );
}
