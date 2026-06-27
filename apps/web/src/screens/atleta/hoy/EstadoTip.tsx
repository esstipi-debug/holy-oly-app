import { useTranslation } from "react-i18next";
import type { CellState, DayLog } from "@holy-oly/core";
import { lowestWellnessItem, pickWellnessTip } from "@holy-oly/core";

/**
 * Tip de "Mi estado de hoy": una píldora de bienestar elegida por el estado de recuperación + el
 * ítem más flojo del check-in del día (contenido PARAFRASEADO de divulgación científica). Advisory —
 * complementa el estado, nunca prescribe ni cambia el plan. Se oculta sin estado o sin tip aplicable.
 * `seed` (derivado de la fecha) hace que el tip varíe día a día de forma determinística.
 */
export function EstadoTip({ state, entry, seed = 0 }: { state: CellState; entry: DayLog | null; seed?: number }) {
  const { t } = useTranslation("atleta");
  if (state === "none") return null;
  const item = lowestWellnessItem(entry);
  const tip = pickWellnessTip({ state, item, seed });
  if (!tip) return null;
  return (
    <section
      aria-label={t("tipAria")}
      style={{
        marginTop: 10, padding: "12px 14px", borderRadius: "var(--wl-radius, 12px)",
        background: "color-mix(in srgb, var(--wl-accent) 8%, transparent)",
        borderLeft: "2px solid color-mix(in srgb, var(--wl-accent) 55%, transparent)",
      }}
    >
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--wl-accent)" }}>
        {t("tipEyebrow", { topic: tip.topic })}
      </div>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 15, color: "var(--wl-text)", marginTop: 5 }}>{tip.title}</div>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--wl-text)", opacity: 0.9, margin: "6px 0 0" }}>{tip.body}</p>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 8 }}>
        {t("tipFooter", { source: tip.source })}
      </div>
    </section>
  );
}
