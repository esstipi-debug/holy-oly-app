import { useTranslation } from "react-i18next";
import type { RosterRow } from "../roster";

/**
 * Alerta del coach (slice macro-history): atletas SIN RM cargado. Sin RM el motor no puede derivar
 * kg ni prescribir → "no se puede avanzar". Lista los afectados como chips que llevan al drill-down
 * (donde el coach asigna un macro = fija los RM). Tono de atención (dorado), NO el semáforo de
 * readiness ni la paleta del ciclo. Si no falta RM en nadie → no renderiza.
 */
export function RmFaltanteBanner({ rows, onPick }: { rows: RosterRow[]; onPick: (id: string) => void }) {
  const { t } = useTranslation("roster");
  const faltan = rows.filter((r) => r.needsRm);
  if (faltan.length === 0) return null;

  const titulo = t("bannerTitle", { count: faltan.length });
  return (
    <section
      role="alert"
      aria-label={t("bannerAria")}
      style={{
        marginBottom: 14, padding: "12px 14px", borderRadius: 14,
        background: "color-mix(in srgb, var(--wl-accent) 9%, var(--wl-surface))",
        border: "1px solid color-mix(in srgb, var(--wl-accent) 45%, transparent)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 14 }}>⚠</span>
        <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 13.5, color: "var(--wl-text)" }}>{titulo}</span>
      </div>
      <p style={{ margin: "5px 0 0", fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", lineHeight: 1.45 }}>
        {t("bannerBody")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
        {faltan.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onPick(r.id)}
            style={{
              minHeight: 30, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 99,
              border: "1px solid color-mix(in srgb, var(--wl-accent) 55%, transparent)",
              background: "color-mix(in srgb, var(--wl-accent) 14%, transparent)",
              color: "var(--wl-text)", fontFamily: "var(--wl-cond, var(--wl-display))", fontWeight: 700, fontSize: 12, letterSpacing: .2, cursor: "pointer",
            }}
          >
            {r.nombre} <span aria-hidden="true" style={{ color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 10 }}>{t("bannerChipCta")}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
