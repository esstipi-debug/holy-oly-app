import { useTranslation } from "react-i18next";
import type { RosterRow } from "../roster";
import { LEGEND_NOISE } from "./legendNoise";

/** Carta "modo leyenda" del mejor readiness del plantel (oro/holo/noise). El oro es
 *  identidad decorativa, NO color de estado. Tap → drill-down del atleta. */
export function AtletasHero({ row, onPick }: { row: RosterRow; onPick: (id: string) => void }) {
  const { t } = useTranslation("roster");
  const stats: [string, string][] = [
    ["ACWR", row.acwr != null ? row.acwr.toFixed(2) : "—"],
    [t("heroRecup"), row.rec != null ? `${row.rec}%` : "—"],
    [t("heroStreak"), row.trend != null ? `${row.trend >= 0 ? "+" : ""}${row.trend}` : "—"],
  ];
  return (
    <button type="button" onClick={() => onPick(row.id)} aria-label={t("heroAria", { name: row.nombre, readiness: row.readiness })}
      style={{ position: "relative", width: "100%", height: 196, borderRadius: 22, overflow: "hidden", cursor: "pointer", textAlign: "left", border: 0, padding: 0, boxShadow: "0 18px 40px -12px rgba(233,196,106,.4), inset 0 0 0 1px rgba(255,240,200,.5)", background: "#C7A14C" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#6E561F 0%,#C7A14C 24%,#F8E7AE 47%,#C49A41 66%,#8A6E2C 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, transparent 30%, rgba(255,120,180,.28) 44%, rgba(120,200,255,.28) 52%, rgba(180,255,170,.24) 60%, transparent 72%)", mixBlendMode: "overlay" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 80% at 80% -10%, rgba(255,255,255,.55), transparent 50%)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: LEGEND_NOISE, backgroundSize: "120px", opacity: .12, mixBlendMode: "overlay" }} />
      <div style={{ position: "relative", height: "100%", padding: "14px 18px", display: "flex", flexDirection: "column", color: "#241A04" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: 1, padding: "4px 9px", borderRadius: 999, background: "rgba(36,26,4,.16)" }}>{t("heroBest")}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{row.metodo}</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, marginTop: 4 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "var(--wl-display)", fontWeight: 900, fontSize: 62, lineHeight: .85, letterSpacing: -2 }}>{row.readiness}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: 2, marginTop: 2 }}>{t("heroReadinessLabel")}</div>
            {row.cat && <div style={{ fontFamily: "var(--wl-cond, var(--wl-display))", fontWeight: 700, fontSize: 15, marginTop: 6, letterSpacing: .5 }}>{row.cat}</div>}
          </div>
          <div style={{ width: 1, alignSelf: "stretch", background: "rgba(36,26,4,.25)", margin: "6px 0" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--wl-cond, var(--wl-display))", fontWeight: 800, fontSize: 30, lineHeight: .95, textTransform: "uppercase", letterSpacing: .3 }}>{row.nombre}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
              {stats.map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 19, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 8, fontWeight: 700, letterSpacing: 1, opacity: .7 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
