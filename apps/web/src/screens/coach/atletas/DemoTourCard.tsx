/**
 * Demo-only (T2): the prospect tour as a single on-brand bottom guide card (NOT a spotlight cutout —
 * that's the AI-slop look the system avoids). Lists the 5-step path that ends in the money shot, then
 * dismisses (persisting `ho:tourSeen` so it doesn't reappear; the T4 reset clears it). The interactive
 * step-by-step choreography across screens is a follow-up (T2b); the plan says start with this card.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isTourSeen, markTourSeen } from "../../../data/demoTour";

export function DemoTourCard({ storage = window.localStorage, onDismiss }: { storage?: Storage; onDismiss?: () => void }) {
  const { t } = useTranslation("roster");
  const [open, setOpen] = useState(() => !isTourSeen(storage));
  if (!open) return null;

  const steps = [t("tourStep1"), t("tourStep2"), t("tourStep3"), t("tourStep4"), t("tourStep5")];

  const dismiss = () => { markTourSeen(storage); setOpen(false); onDismiss?.(); };

  return (
    <>
      {/* In-flow spacer so the `position:fixed` card never traps the last roster cards underneath
          it (Kevin — the money-shot athlete — is the last card). Sits next to the card in the
          scroll flow, so it appears/vanishes WITH the card on dismiss (no `seen` desync). */}
      <div aria-hidden style={{ height: 280 }} />
      <section
        aria-label={t("tourEyebrow")}
        data-testid="demo-tour-card"
      style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 16, width: "min(92vw, 400px)", zIndex: 50, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 12%,transparent)", borderRadius: 12, padding: "14px 16px", boxShadow: "0 10px 30px rgba(0,0,0,.45)" }}
    >
      <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "var(--wl-muted)" }}>{t("tourEyebrow")}</div>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 17, margin: "4px 0 10px", lineHeight: 1.05 }}>{t("tourTitle")}</div>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
        {steps.map((s, i) => (
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
        {t("tourCta")}
      </button>
      </section>
    </>
  );
}
