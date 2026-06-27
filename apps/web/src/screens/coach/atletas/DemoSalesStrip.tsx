/**
 * Demo-only (T3): a "por qué mirar a cada uno" sales cheat-sheet at the top of the coach roster.
 * Each seeded athlete that has a hint becomes a deliberate talking point (triage / pico / ciclo /
 * onboarding / sin-datos). Hints MATCH each athlete's real readiness cell — we annotate the pinned
 * seeds, we don't re-steer them. Gated to demo mode (`!API_ENABLED`) by the caller.
 */
import { useTranslation } from "react-i18next";
import type { RosterRow } from "../roster";
import { ROSTER_HINTS } from "../../../data/seeds";
import { Badge } from "../../../ui/Badge";

export function DemoSalesStrip({ rows }: { rows: RosterRow[] }) {
  const { t } = useTranslation(["roster", "common"]);
  const annotated = rows.filter((r) => ROSTER_HINTS[r.id]);
  if (annotated.length === 0) return null;

  return (
    <section
      data-testid="demo-sales-strip"
      style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 9, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}
    >
      <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--wl-muted)", marginBottom: 8 }}>
        {t("salesStripTitle")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {annotated.map((r) => (
          <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, minWidth: 74 }}>{r.nombre}</span>
            {r.cell === "none"
              ? <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", padding: "2px 7px", borderRadius: 99 }}>{t("common:readiness.none")}</span>
              : <Badge tone={r.cell}>{t(`common:readiness.${r.cell}`)}</Badge>}
            <span style={{ flex: "1 1 60%", fontSize: 12, color: "var(--wl-muted)", lineHeight: 1.35 }}>{ROSTER_HINTS[r.id]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
